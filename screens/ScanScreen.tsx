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
import categoriesCleanedAll from '../assets/categories_cleaned_all.json';
import { auth, database, storage } from '../firebaseConfig';

const ECOSCORE_DESCRIPTIONS = {
    'A+': 'Exceptional: Lowest environmental impact with sustainable materials and minimal packaging.',
    'A': 'Excellent: Very low environmental impact with sustainable practices.',
    'B': 'Good: Good environmental performance with some sustainable practices.',
    'C': 'Moderate: Average environmental impact with room for improvement.',
    'D': 'Poor: Higher environmental impact with limited sustainability.',
    'E': 'Very Poor: Significant environmental impact, minimal sustainability.',
    'F': 'Severe: Highest environmental impact with poor sustainability.',
};

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
        try {
            const filename = uri.split('/').pop() || `photo_${Date.now()}.jpg`;
            const newPath = `${FileSystem.cacheDirectory}${filename}`;

            const sourceInfo = await FileSystem.getInfoAsync(uri);
            if (!sourceInfo.exists) {
                console.warn('Source image does not exist, using original URI');
                return uri;
            }

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
                console.error('Image file does not exist at:', uri);
                return uri;
            }

            const manipulated = await manipulateAsync(
                uri,
                [{ resize: { width: 800 } }],
                {
                    compress: 0.7,
                    format: SaveFormat.JPEG,
                }
            );

            return manipulated.uri;
        } catch (error) {
            console.error('Image compression failed:', error);
            return uri;
        }
    };

    const uploadImageToStorage = async (uri: string, userId: string): Promise<string> => {
        try {
            const response = await fetch(uri);
            const blob = await response.blob();
            const imageRef = storageRef(storage, `scans/${userId}/${Date.now()}.jpg`);
            await uploadBytes(imageRef, blob);
            return await getDownloadURL(imageRef);
        } catch (error) {
            console.error('Error uploading image to storage:', error);
            throw error;
        }
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
                },
                greenerAlternative: scanData.greener_alternative
                    ? {
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
        } catch (error) {
            console.error('Save error:', error);
            throw new Error('Saving scan failed');
        }
    };

    const takePhoto = async () => {
        try {
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
            });

            if (!photo.canceled && photo.assets?.length > 0) {
                const originalUri = photo.assets[0].uri;
                const localPath = await copyImageToLocalCache(originalUri);
                const compressedUri = await compressImage(localPath);

                setImageUri(compressedUri);
                setResult(null);
                setPreferred(null);
            }
        } catch (error) {
            console.error('Error taking photo:', error);
            Alert.alert('Error', 'Failed to take photo. Please try again.');
        }
    };

    const pickImage = async () => {
        try {
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
            });

            if (!picked.canceled && picked.assets?.length > 0) {
                const originalUri = picked.assets[0].uri;
                const localPath = await copyImageToLocalCache(originalUri);
                const compressedUri = await compressImage(localPath);

                setImageUri(compressedUri);
                setResult(null);
                setPreferred(null);
            }
        } catch (error) {
            console.error('Error picking image:', error);
            Alert.alert('Error', 'Failed to select image. Please try again.');
        }
    };

    const getEcoScoreColor = (score: string) => {
        const grade = score?.toUpperCase();
        if (grade === 'A+' || grade === 'A' || grade === 'B') return '#2C5B3F';
        if (grade === 'C' || grade === 'D') return '#FF9800';
        if (grade === 'E' || grade === 'F') return '#F44336';
        return '#9E9E9E';
    };

    const isValidFoodProduct = (prediction: any) => {
        if (!prediction) return false;

        const category = prediction?.main_category_en?.toLowerCase();
        const ecoScore = prediction?.environmental_score_grade;
        const packaging = prediction?.packaging_en;

        const foodCategories = categoriesCleanedAll.map(cat => cat.toLowerCase());

        const hasAnyFoodIndicator =
            (category && foodCategories.some(f => category.includes(f) || f.includes(category))) ||
            (packaging && packaging.length > 0) ||
            ecoScore;

        return hasAnyFoodIndicator;
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
            const imageInfo = await FileSystem.getInfoAsync(imageUri);
            if (!imageInfo.exists) {
                throw new Error('Image file not found. Please try again.');
            }

            const processedUri = await compressImage(imageUri);
            const formData = new FormData();
            formData.append('file', {
                uri: processedUri,
                name: `image_${Date.now()}.jpg`,
                type: 'image/jpeg',
            } as any);

            const apiUrl = 'https://aimemagni-SafiPack.hf.space/predict';
            const response = await fetch(apiUrl, {
                method: 'POST',
                body: formData,
                headers: {
                    'Accept': 'application/json',
                },
            });

            if (!response.ok) {
                throw new Error(`API Error: ${response.status}`);
            }

            const data = await response.json();

            if (!data || !data.prediction) {
                throw new Error('No prediction data returned.');
            }

            if (!isValidFoodProduct(data.prediction)) {
                Alert.alert(
                    'Limited Information',
                    'Showing available product information.',
                    [{ text: "OK" }]
                );
            }

            setResult(data);
        } catch (error: any) {
            console.error('Scan error:', error);
            Alert.alert('Scan Failed', error.message || 'Something went wrong. Please try again.');
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
                `You selected the ${choice === 'product' ? 'Scanned Product' : 'Greener Alternative'}.`,
                [{ text: "OK", onPress: () => setTimeout(resetScreen, 500) }]
            );
        } catch (error) {
            console.error('Error saving preference:', error);
            Alert.alert("Error", "Could not save your choice.");
        } finally {
            setLoading(false);
        }
    };

    const renderProductCard = (isAlternative = false) => {
        const data = isAlternative ? result?.greener_alternative : result?.prediction;
        if (!data) return null;

        const packaging = Array.isArray(data.packaging_en)
            ? data.packaging_en.join(', ')
            : data.packaging_en || 'Not detected';

        const ecoScore = data.environmental_score_grade;
        const ecoScoreDescription = ecoScore
            ? ECOSCORE_DESCRIPTIONS[ecoScore.toUpperCase() as keyof typeof ECOSCORE_DESCRIPTIONS]
            : 'No environmental data available';

        return (
            <View style={[styles.productCard, {
                borderColor: isAlternative ? '#4CAF50' : '#2196F3'
            }]}>
                {isAlternative && (
                    <Text style={styles.preferenceTitle}>Greener Alternative</Text>
                )}

                <Image
                    source={{ uri: isAlternative ? result.greener_alternative?.image_url : imageUri }}
                    style={styles.productImage}
                />

                <View style={styles.productInfoContainer}>
                    {ecoScore ? (
                        <>
                            <Text style={[styles.ecoScoreText, {
                                color: getEcoScoreColor(ecoScore)
                            }]}>
                                Eco-Score: {ecoScore}
                            </Text>
                            <Text style={[styles.ecoScoreDescription, {
                                color: getEcoScoreColor(ecoScore)
                            }]}>
                                {ecoScoreDescription}
                            </Text>
                        </>
                    ) : (
                        <Text style={styles.resultText}>Eco-Score: Not detected</Text>
                    )}

                    <Text style={styles.packagingText}>
                        Packaging: {packaging}
                    </Text>
                </View>

                <Button
                    title={`✅ Select ${isAlternative ? 'alternative' : 'this product'}`}
                    color={isAlternative ? '#4CAF50' : '#2196F3'}
                    onPress={() => handlePreferenceSelection(isAlternative ? 'alternative' : 'product')}
                />
            </View>
        );
    };

    return (
        <ScrollView contentContainerStyle={styles.container}>
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
            <Button
                title="Scan Image"
                onPress={uploadAndScan}
                disabled={!imageUri || loading}
                color="#2C5B3F"
            />

            {loading && (
                <View style={styles.loadingContainer}>
                    <ActivityIndicator size="large" color="#2C5B3F" />
                    <Text style={styles.loadingText}>Analyzing...</Text>
                </View>
            )}

            {result && !preferred && (
                <View style={styles.preferenceSection}>
                    <Text style={styles.preferenceQuestion}>
                        {result.prediction?.main_category_en
                            ? "Which one would you choose?"
                            : "Detected Product"}
                    </Text>

                    {renderProductCard()}
                    {result.greener_alternative && renderProductCard(true)}
                </View>
            )}

            {preferred && (
                <Text style={styles.selectedText}>
                    ✅ You selected the {preferred === 'product' ? 'Scanned Product' : 'Greener Alternative'}.
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
    productImage: {
        width: 180,
        height: 180,
        marginVertical: 12,
        borderRadius: 10,
        backgroundColor: '#F5F5F5',
        alignSelf: 'center',
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
    preferenceSection: {
        marginTop: 30,
        width: '100%',
        alignItems: 'center',
    },
    productCard: {
        borderWidth: 1.5,
        borderRadius: 14,
        padding: 18,
        marginBottom: 24,
        backgroundColor: '#FAFAFA',
        width: '90%',
    },
    productInfoContainer: {
        marginBottom: 16,
    },
    ecoScoreText: {
        fontSize: 16,
        fontWeight: 'bold',
        textAlign: 'center',
        marginBottom: 4,
    },
    ecoScoreDescription: {
        fontSize: 13,
        textAlign: 'center',
        fontStyle: 'italic',
        marginBottom: 12,
    },
    packagingText: {
        fontSize: 15,
        textAlign: 'center',
        color: '#333',
        marginBottom: 12,
    },
    preferenceTitle: {
        fontSize: 17,
        fontWeight: 'bold',
        marginBottom: 8,
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
    },
    resultText: {
        fontSize: 15,
        marginBottom: 8,
        color: '#333',
        textAlign: 'center',
    },
});