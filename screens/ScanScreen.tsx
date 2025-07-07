import * as FileSystem from 'expo-file-system';
import { manipulateAsync, SaveFormat } from 'expo-image-manipulator';
import * as ImagePicker from 'expo-image-picker';
import { ref as dbRef, push, serverTimestamp } from 'firebase/database';
import { getDownloadURL, ref as storageRef, uploadBytes } from 'firebase/storage';
import React, { useState } from 'react';
import {
    ActivityIndicator,
    Alert,
    Button,
    Image,
    ScrollView,
    StyleSheet,
    Text,
    View,
} from 'react-native';
import { auth, database, storage } from '../firebaseConfig';

export default function ScanScreen() {
    const [imageUri, setImageUri] = useState<string | null>(null);
    const [result, setResult] = useState<any | null>(null);
    const [loading, setLoading] = useState(false);
    const [preferred, setPreferred] = useState<string | null>(null);

    const resetScreen = () => {
        setImageUri(null);
        setResult(null);
        setPreferred(null);
    };

    const copyImageToLocalCache = async (uri: string): Promise<string> => {
        const filename = uri.split('/').pop() || `photo_${Date.now()}.jpg`;
        const newPath = `${FileSystem.cacheDirectory}${filename}`;
        try {
            await FileSystem.copyAsync({ from: uri, to: newPath });
            return newPath;
        } catch (error) {
            console.error('Error copying image to local cache:', error);
            return uri;
        }
    };

    const compressImage = async (uri: string) => {
        try {
            const info = await FileSystem.getInfoAsync(uri);
            if (!info.exists) {
                console.error('Image file does not exist');
                return uri;
            }
            const manipulated = await manipulateAsync(uri, [], {
                compress: 0.8,
                format: SaveFormat.JPEG,
            });
            return manipulated.uri;
        } catch (error) {
            console.error('Image compression failed:', error);
            return uri;
        }
    };

    const uploadImageToStorage = async (uri: string, userId: string): Promise<string> => {
        const response = await fetch(uri);
        const blob = await response.blob();
        const imageRef = storageRef(storage, `scans/${userId}/${Date.now()}.jpg`);
        await uploadBytes(imageRef, blob);
        const downloadUrl = await getDownloadURL(imageRef);
        return downloadUrl;
    };

    const saveScanResults = async (localImageUri: string, scanData: any, preferredChoice: string | null = null) => {
        try {
            const userId = auth.currentUser?.uid;
            if (!userId) throw new Error('User not authenticated');

            const productImageUrl = await uploadImageToStorage(localImageUri, userId);

            let alternativeImageUrl: string | null = null;
            if (scanData.greener_alternative?.image_url) {
                try {
                    const altRes = await fetch(scanData.greener_alternative.image_url);
                    const altBlob = await altRes.blob();
                    const altRef = storageRef(storage, `scans/${userId}/alternative_${Date.now()}.jpg`);
                    await uploadBytes(altRef, altBlob);
                    alternativeImageUrl = await getDownloadURL(altRef);
                } catch {
                    console.warn('Alternative image upload failed. Using original URL.');
                    alternativeImageUrl = scanData.greener_alternative.image_url;
                }
            }

            const packaging = Array.isArray(scanData.prediction?.packaging_en)
                ? scanData.prediction.packaging_en
                : [];

            const scanRecord = {
                userId,
                productImageUrl,
                prediction: {
                    category: scanData.prediction?.main_category_en || 'Unknown',
                    ecoScore: scanData.prediction?.environmental_score_grade || 'N/A',
                    packaging,
                    brands_en: scanData.prediction?.brands_en || 'N/A',
                },
                greenerAlternative: scanData.greener_alternative
                    ? {
                        brand: scanData.greener_alternative.brands_en || 'N/A',
                        ecoScore: scanData.greener_alternative.environmental_score_grade || 'N/A',
                        packaging: scanData.greener_alternative.packaging_en || 'Unknown',
                        imageUrl: alternativeImageUrl,
                    }
                    : null,
                preferred: preferredChoice ?? null,
                timestamp: serverTimestamp(),
            };

            const scansRef = dbRef(database, `scans/${userId}`);
            await push(scansRef, scanRecord);
            console.log('Scan saved successfully');
        } catch (error) {
            console.error('Save error:', error);
            throw new Error('Saving scan failed');
        }
    };

    const takePhoto = async () => {
        const { status } = await ImagePicker.requestCameraPermissionsAsync();
        if (status !== 'granted') {
            Alert.alert('Permission Denied', 'Camera access is required.');
            return;
        }

        const photo = await ImagePicker.launchCameraAsync({
            quality: 0.8,
            base64: false,
            allowsEditing: false,
            mediaTypes: ImagePicker.MediaTypeOptions.Images,
            aspect: undefined,
            exif: false,
        });

        if (!photo.canceled && photo.assets?.length > 0) {
            try {
                const localPath = await copyImageToLocalCache(photo.assets[0].uri);
                const compressedUri = await compressImage(localPath);
                setImageUri(compressedUri);
                setResult(null);
                setPreferred(null);
                console.log('Camera image processed successfully:', compressedUri);
            } catch (error) {
                console.error('Error processing camera image:', error);
                Alert.alert('Error', 'Failed to process the image. Please try again.');
            }
        }
    };

    const pickImage = async () => {
        const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
        if (status !== 'granted') {
            Alert.alert('Permission Denied', 'Gallery access is required.');
            return;
        }

        const picked = await ImagePicker.launchImageLibraryAsync({
            quality: 0.8,
            base64: false,
            allowsEditing: false,
            mediaTypes: ImagePicker.MediaTypeOptions.Images,
            aspect: undefined,
            exif: false,
        });

        if (!picked.canceled && picked.assets?.length > 0) {
            try {
                const localPath = await copyImageToLocalCache(picked.assets[0].uri);
                const compressedUri = await compressImage(localPath);
                setImageUri(compressedUri);
                setResult(null);
                setPreferred(null);
                console.log('Gallery image processed successfully:', compressedUri);
            } catch (error) {
                console.error('Error processing gallery image:', error);
                Alert.alert('Error', 'Failed to process the image. Please try again.');
            }
        }
    };

    const getEcoScoreColor = (score: string) => {
        const grade = score?.toLowerCase();
        if (grade === 'a-plus' || grade === 'a' || grade === 'b') return '#2C5B3F';
        if (grade === 'c' || grade === 'd') return '#FF9800';
        if (grade === 'e' || grade === 'f') return '#F44336';
        return '#9E9E9E';
    };

    const isValidFoodProduct = (prediction: any) => {
        const category = prediction?.main_category_en?.toLowerCase();
        const ecoScore = prediction?.environmental_score_grade;
        const nutriScore = prediction?.nutriscore_grade;

        const foodCategories = [
            'beverages', 'dairy', 'fruits', 'vegetables', 'snacks', 'cereals',
            'meat', 'fish', 'bread', 'pasta', 'rice', 'oils', 'sauces',
            'sweets', 'chocolate', 'coffee', 'tea', 'water', 'juice',
            'milk', 'cheese', 'yogurt', 'cookies', 'crackers', 'chips',
            'nuts', 'seeds', 'spices', 'condiments', 'baby-food',
            'breakfast', 'desserts', 'frozen', 'canned', 'dried',
        ];

        return foodCategories.some(f =>
            category?.includes(f) || f.includes(category || '')
        ) && (ecoScore || nutriScore);
    };

    const uploadAndScan = async () => {
        if (!imageUri) {
            Alert.alert('No Image', 'Please select or take a photo first.');
            return;
        }

        setLoading(true);
        setResult(null);
        setPreferred(null);

        try {
            const processedUri = await compressImage(imageUri);

            const fileInfo = await FileSystem.getInfoAsync(processedUri);
            if (!fileInfo.exists) {
                throw new Error('Processed image file not found');
            }

            const formData = new FormData();
            const filename = `image_${Date.now()}.jpg`;

            formData.append('file', {
                uri: processedUri,
                name: filename,
                type: 'image/jpeg',
            } as any);

            const apiUrl = 'https://aimemagni-SafiPack.hf.space/predict';
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 45000);

            const apiResponse = await fetch(apiUrl, {
                method: 'POST',
                body: formData,
                signal: controller.signal,
                headers: {
                    'Content-Type': 'multipart/form-data',
                },
            });

            clearTimeout(timeoutId);

            if (!apiResponse.ok) {
                const errorText = await apiResponse.text();
                throw new Error(`API Error: ${apiResponse.status} - ${errorText}`);
            }

            const data = await apiResponse.json();

            if (!data || !data.prediction) {
                throw new Error('No prediction data returned.');
            }

            if (!isValidFoodProduct(data.prediction)) {
                Alert.alert('Invalid Product', 'Please scan a food/beverage product with clear labels.');
                return;
            }

            setResult(data);
        } catch (error: any) {
            if (error.name === 'AbortError') {
                Alert.alert('Timeout', 'The scan took too long. Please try again.');
            } else {
                Alert.alert('Scan Failed', error.message || 'Something went wrong. Please try again.');
            }
        } finally {
            setLoading(false);
        }
    };

    const handlePreferenceSelection = async (choice: string) => {
        try {
            setLoading(true);
            await saveScanResults(imageUri!, result, choice);
            setPreferred(choice);
            Alert.alert(
                "Thank you!",
                `You selected the ${choice === 'product' ? 'Scanned Product' : 'Greener Alternative'} as preferred.`,
                [
                    {
                        text: "OK",
                        onPress: () => {
                            setTimeout(resetScreen, 500);
                        }
                    }
                ]
            );
        } catch {
            Alert.alert("Error", "Could not save your choice.");
        } finally {
            setLoading(false);
        }
    };

    return (
        <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
            <Text style={styles.title}>Scan Product</Text>

            <View style={styles.instructionsContainer}>
                <Text style={styles.instructionsText}>📸 Scan food/beverage packaging</Text>
                <Text style={styles.instructionsSubText}>Make sure labels are visible</Text>
            </View>

            {imageUri && (
                <Image source={{ uri: imageUri }} style={styles.image} resizeMode="cover" />
            )}

            <View style={styles.buttonRow}>
                <View style={styles.buttonWrapper}>
                    <Button title="Take Photo" onPress={takePhoto} color="#2C5B3F" />
                </View>
                <View style={{ width: 16 }} />
                <View style={styles.buttonWrapper}>
                    <Button title="Pick from Gallery" onPress={pickImage} color="#2C5B3F" />
                </View>
            </View>

            <View style={{ height: 20 }} />
            <Button title="Scan Image" onPress={uploadAndScan} disabled={!imageUri || loading} color="#2C5B3F" />

            {loading && (
                <View style={styles.loadingContainer}>
                    <ActivityIndicator size="large" color="#2C5B3F" />
                    <Text style={styles.loadingText}>Analyzing...</Text>
                </View>
            )}

            {result && !preferred && (
                <View style={styles.preferenceSection}>
                    <Text style={styles.preferenceQuestion}>
                        Which one would you choose?
                    </Text>

                    <View style={[styles.preferenceCard, { borderColor: '#2196F3' }]}>
                        <Text style={styles.preferenceTitle}>Scanned Product</Text>
                        {imageUri && (
                            <Image source={{ uri: imageUri }} style={styles.altImage} />
                        )}
                        <Text style={styles.resultText}>Brand: {result.prediction?.brands_en ?? 'N/A'}</Text>
                        <Text style={[styles.resultText, { color: getEcoScoreColor(result.prediction?.environmental_score_grade) }]}>
                            Eco-Score: {result.prediction?.environmental_score_grade ?? 'N/A'}
                        </Text>
                        <Button
                            title="✅ I prefer this product"
                            color="#2196F3"
                            onPress={() => handlePreferenceSelection('product')}
                        />
                    </View>

                    {result.greener_alternative && (
                        <View style={[styles.preferenceCard, { borderColor: '#4CAF50' }]}>
                            <Text style={styles.preferenceTitle}>Greener Alternative</Text>
                            <Text style={styles.resultText}>Brand: {result.greener_alternative?.brands_en ?? 'N/A'}</Text>
                            <Text style={[styles.resultText, { color: getEcoScoreColor(result.greener_alternative?.environmental_score_grade) }]}>
                                Eco-Score: {result.greener_alternative?.environmental_score_grade ?? 'N/A'}
                            </Text>
                            {result.greener_alternative.image_url && (
                                <Image source={{ uri: result.greener_alternative.image_url }} style={styles.altImage} />
                            )}
                            <Button
                                title="✅ I prefer this alternative"
                                color="#4CAF50"
                                onPress={() => handlePreferenceSelection('alternative')}
                            />
                        </View>
                    )}
                </View>
            )}

            {preferred && (
                <Text style={styles.selectedText}>
                    ✅ You selected the {preferred === 'product' ? 'Scanned Product' : 'Greener Alternative'} as your preference.
                </Text>
            )}
        </ScrollView>
    );
}

const styles = StyleSheet.create({
    container: {
        flexGrow: 1,
        padding: 20,
        alignItems: 'center',
        backgroundColor: 'white',
    },
    title: {
        fontSize: 24,
        marginBottom: 20,
        fontWeight: 'bold',
        color: '#2C5B3F',
        textAlign: 'center',
    },
    instructionsContainer: {
        backgroundColor: '#E6F1EC',
        padding: 14,
        borderRadius: 10,
        marginBottom: 20,
        width: '100%',
        borderLeftWidth: 6,
        borderLeftColor: '#2C5B3F',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 4,
        elevation: 3,
    },
    instructionsText: {
        fontSize: 15,
        fontWeight: '600',
        textAlign: 'center',
        color: '#2C5B3F',
    },
    instructionsSubText: {
        fontSize: 13,
        textAlign: 'center',
        color: '#4B755C',
        marginTop: 4,
    },
    image: {
        width: 260,
        height: 260,
        borderRadius: 14,
        marginBottom: 20,
        backgroundColor: '#F5F5F5',
    },
    altImage: {
        width: 160,
        height: 160,
        marginTop: 12,
        marginBottom: 12,
        borderRadius: 12,
        backgroundColor: '#F5F5F5',
    },
    buttonRow: {
        flexDirection: 'row',
        marginBottom: 12,
        justifyContent: 'center',
        width: '100%',
    },
    buttonWrapper: {
        flex: 1,
    },
    loadingContainer: {
        alignItems: 'center',
        marginTop: 24,
    },
    loadingText: {
        marginTop: 12,
        fontSize: 16,
        fontWeight: '600',
        color: '#2C5B3F',
    },
    resultText: {
        fontSize: 15,
        marginBottom: 8,
        color: '#333',
        textAlign: 'center',
    },
    preferenceSection: {
        marginTop: 30,
        width: '100%',
        alignItems: 'center',
    },
    preferenceCard: {
        borderWidth: 1.5,
        borderRadius: 14,
        padding: 18,
        marginBottom: 24,
        backgroundColor: '#FAFAFA',
        alignItems: 'center',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.1,
        shadowRadius: 3,
        elevation: 2,
        width: '90%',
    },
    preferenceTitle: {
        fontSize: 17,
        fontWeight: 'bold',
        marginBottom: 14,
        textAlign: 'center',
        color: '#2C5B3F',
    },
    preferenceQuestion: {
        fontSize: 17,
        fontWeight: '700',
        marginBottom: 18,
        textAlign: 'center',
        color: '#2C5B3F',
    },
    selectedText: {
        marginTop: 24,
        paddingVertical: 14,
        paddingHorizontal: 16,
        backgroundColor: '#E8F5E9',
        borderRadius: 12,
        color: '#2C5B3F',
        fontWeight: '700',
        textAlign: 'center',
        width: '90%',
        alignSelf: 'center',
        shadowColor: '#2C5B3F',
        shadowOpacity: 0.3,
        shadowOffset: { width: 0, height: 4 },
        shadowRadius: 6,
        elevation: 4,
    },
});
