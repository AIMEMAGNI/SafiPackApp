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

            // Always process the image to ensure compatibility
            const operations = [];

            try {
                // Get image dimensions safely
                const dimensions = await new Promise<{ width: number; height: number }>((resolve, reject) => {
                    const timeout = setTimeout(() => reject(new Error('Timeout getting image size')), 5000);
                    Image.getSize(
                        uri,
                        (width, height) => {
                            clearTimeout(timeout);
                            resolve({ width, height });
                        },
                        (error) => {
                            clearTimeout(timeout);
                            reject(error);
                        }
                    );
                });

                const { width, height } = dimensions;
                const maxSize = 1000;

                // Resize if image is too large
                if (width > maxSize || height > maxSize) {
                    const ratio = Math.min(maxSize / width, maxSize / height);
                    operations.push({
                        resize: {
                            width: Math.round(width * ratio),
                            height: Math.round(height * ratio),
                        },
                    });
                }
            } catch (dimensionError) {
                console.warn('Could not get image dimensions, applying default resize:', dimensionError);
                // Apply a safe default resize
                operations.push({
                    resize: {
                        width: 800,
                    },
                });
            }

            // Always manipulate the image to ensure proper format and compression
            const manipulated = await manipulateAsync(uri, operations, {
                compress: 0.8,
                format: SaveFormat.JPEG,
            });

            return manipulated.uri;
        } catch (error) {
            console.error('Image compression failed:', error);
            // Return original URI if compression fails
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
        if (grade === 'a-plus' || grade === 'a' || grade === 'b') return '#4CAF50';
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
            // Always compress/process the image first to ensure compatibility
            const processedUri = await compressImage(imageUri);

            // Check if processed file exists
            const fileInfo = await FileSystem.getInfoAsync(processedUri);
            if (!fileInfo.exists) {
                throw new Error('Processed image file not found');
            }

            const formData = new FormData();
            const filename = `image_${Date.now()}.jpg`; // Use consistent naming

            // Always use JPEG format for maximum compatibility
            formData.append('file', {
                uri: processedUri,
                name: filename,
                type: 'image/jpeg',
            } as any);

            console.log('Uploading image:', { uri: processedUri, filename, size: fileInfo.size });

            const apiUrl = 'https://aimemagni-SafiPack.hf.space/predict';
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 45000); // Increased timeout

            const apiResponse = await fetch(apiUrl, {
                method: 'POST',
                body: formData,
                signal: controller.signal,
                headers: {
                    'Content-Type': 'multipart/form-data',
                },
            });

            clearTimeout(timeoutId);

            console.log('API Response Status:', apiResponse.status);

            if (!apiResponse.ok) {
                const errorText = await apiResponse.text();
                console.error('API Error Response:', errorText);
                throw new Error(`API Error: ${apiResponse.status} - ${errorText}`);
            }

            const data = await apiResponse.json();
            console.log('API Response Data:', data);

            if (!data || !data.prediction) {
                throw new Error('No prediction data returned.');
            }

            if (!isValidFoodProduct(data.prediction)) {
                Alert.alert('Invalid Product', 'Please scan a food/beverage product with clear labels.');
                return;
            }

            setResult(data);
        } catch (error: any) {
            console.error('Scan error:', error);
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
                            // Reset screen after user acknowledges
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
                <Button title="Take Photo" onPress={takePhoto} />
                <View style={{ width: 10 }} />
                <Button title="Pick from Gallery" onPress={pickImage} />
            </View>

            <View style={{ height: 20 }} />
            <Button title="Scan Image" onPress={uploadAndScan} disabled={!imageUri || loading} />

            {loading && (
                <View style={styles.loadingContainer}>
                    <ActivityIndicator size="large" color="#000" />
                    <Text style={styles.loadingText}>Analyzing...</Text>
                </View>
            )}

            {result && !preferred && (
                <View style={{ marginTop: 30 }}>
                    <Text style={{ fontSize: 16, fontWeight: 'bold', marginBottom: 10, textAlign: 'center' }}>
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
                <Text style={{
                    marginTop: 20,
                    padding: 10,
                    backgroundColor: '#E8F5E9',
                    borderRadius: 8,
                    color: '#388E3C',
                    textAlign: 'center',
                    fontWeight: 'bold'
                }}>
                    ✅ You selected the {preferred === 'product' ? 'Scanned Product' : 'Greener Alternative'} as your preference.
                </Text>
            )}
        </ScrollView>
    );
}

const styles = StyleSheet.create({
    container: { flexGrow: 1, padding: 20, alignItems: 'center', backgroundColor: 'white' },
    title: { fontSize: 24, marginBottom: 20, fontWeight: 'bold' },
    instructionsContainer: { backgroundColor: '#e8f5e8', padding: 12, borderRadius: 8, marginBottom: 20, width: '100%' },
    instructionsText: { fontSize: 14, fontWeight: '500', textAlign: 'center', color: '#2d5a2d' },
    instructionsSubText: { fontSize: 12, textAlign: 'center', color: '#5a7a5a', marginTop: 4 },
    image: { width: 250, height: 250, borderRadius: 12, marginBottom: 20 },
    altImage: { width: 150, height: 150, marginTop: 10, borderRadius: 10 },
    buttonRow: { flexDirection: 'row', marginBottom: 10 },
    loadingContainer: { alignItems: 'center', marginTop: 20 },
    loadingText: { marginTop: 10, fontSize: 16, fontWeight: '500' },
    resultText: { fontSize: 14, marginBottom: 6, color: '#333' },
    preferenceCard: {
        borderWidth: 1.5,
        borderRadius: 12,
        padding: 15,
        marginBottom: 20,
        backgroundColor: '#F9F9F9',
        alignItems: 'center',
    },
    preferenceTitle: {
        fontSize: 16,
        fontWeight: 'bold',
        marginBottom: 10,
        textAlign: 'center',
    },
});
