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
            const info = await new Promise<{ width: number; height: number }>((resolve, reject) => {
                Image.getSize(
                    uri,
                    (width, height) => resolve({ width, height }),
                    reject
                );
            });

            const isSquare = Math.abs(info.width - info.height) < 30;
            const needsResize = info.width > 1000 || info.height > 1000;

            if (!isSquare || needsResize) {
                const ops = [];
                if (needsResize) ops.push({ resize: { width: 800 } });
                if (!isSquare) {
                    const size = Math.min(info.width, info.height);
                    ops.push({ crop: { originX: 0, originY: 0, width: size, height: size } });
                }

                const manipulated = await manipulateAsync(uri, ops, {
                    compress: 0.6,
                    format: SaveFormat.JPEG,
                });
                return manipulated.uri;
            }

            return uri;
        } catch (error) {
            console.error('Image manipulation failed:', error);
            return uri;
        }
    };

    const uploadImageToStorage = async (uri: string, userId: string): Promise<string> => {
        const response = await fetch(uri);
        const blob = await response.blob();
        const imageRef = storageRef(storage, `scans/${userId}/${Date.now()}.jpg`);
        await uploadBytes(imageRef, blob);
        return await getDownloadURL(imageRef);
    };

    const saveScanResults = async (localImageUri: string, scanData: any) => {
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
                } catch (err) {
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
                },
                greenerAlternative: scanData.greener_alternative
                    ? {
                        brand: scanData.greener_alternative.brands_en || 'N/A',
                        ecoScore: scanData.greener_alternative.environmental_score_grade || 'N/A',
                        packaging: scanData.greener_alternative.packaging_en || 'Unknown',
                        imageUrl: alternativeImageUrl,
                    }
                    : null,
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
            quality: 0.7,
            base64: false,
            allowsEditing: false,
        });

        if (!photo.canceled && photo.assets?.length > 0) {
            const localPath = await copyImageToLocalCache(photo.assets[0].uri);
            const compressedUri = await compressImage(localPath);
            setImageUri(compressedUri);
            setResult(null);
        }
    };

    const pickImage = async () => {
        const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
        if (status !== 'granted') {
            Alert.alert('Permission Denied', 'Gallery access is required.');
            return;
        }

        const picked = await ImagePicker.launchImageLibraryAsync({
            quality: 0.7,
            base64: false,
            allowsEditing: false,
            mediaTypes: ImagePicker.MediaTypeOptions.Images,
        });

        if (!picked.canceled && picked.assets?.length > 0) {
            const localPath = await copyImageToLocalCache(picked.assets[0].uri);
            const compressedUri = await compressImage(localPath);
            setImageUri(compressedUri);
            setResult(null);
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

        try {
            const formData = new FormData();
            const filename = imageUri.split('/').pop() || 'photo.jpg';
            const match = /\.(\w+)$/.exec(filename);
            const type = match ? `image/${match[1]}` : 'image/jpeg';

            formData.append('file', {
                uri: imageUri,
                name: filename,
                type: type,
            } as any);

            const apiUrl = 'https://aimemagni-SafiPack.hf.space/predict';
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 30000);

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
            await saveScanResults(imageUri, data);

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

    return (
        <ScrollView contentContainerStyle={styles.container}>
            <Text style={styles.title}>Scan Product</Text>

            <View style={styles.instructionsContainer}>
                <Text style={styles.instructionsText}>📸 Scan food/beverage packaging</Text>
                <Text style={styles.instructionsSubText}>Make sure labels are visible</Text>
            </View>

            {imageUri && (
                <Image
                    source={{ uri: imageUri }}
                    style={styles.image}
                    resizeMode="cover"
                />
            )}

            <View style={styles.buttonRow}>
                <Button title="Take Photo" onPress={takePhoto} />
                <View style={{ width: 10 }} />
                <Button title="Pick from Gallery" onPress={pickImage} />
            </View>

            <View style={{ height: 20 }} />

            <Button
                title="Scan Image"
                onPress={uploadAndScan}
                disabled={!imageUri || loading}
            />

            {loading && (
                <View style={styles.loadingContainer}>
                    <ActivityIndicator size="large" color="#000" />
                    <Text style={styles.loadingText}>Analyzing...</Text>
                </View>
            )}

            {result && (
                <View style={styles.resultContainer}>
                    <Text style={styles.resultLabel}>🧾 Product Info</Text>
                    <Text style={styles.resultText}>
                        Category: {result.prediction?.main_category_en ?? 'Unknown'}
                    </Text>

                    <View style={styles.ecoScoreRow}>
                        <Text style={styles.resultText}>Eco-Score:</Text>
                        <View style={[styles.ecoScoreBadge, {
                            backgroundColor: getEcoScoreColor(result.prediction?.environmental_score_grade),
                        }]}>
                            <Text style={styles.ecoScoreText}>
                                {(result.prediction?.environmental_score_grade ?? 'N/A').toUpperCase()}
                            </Text>
                        </View>
                    </View>

                    {Array.isArray(result.prediction?.packaging_en) && result.prediction.packaging_en.length > 0 && (
                        <Text style={styles.resultText}>
                            Packaging: {result.prediction.packaging_en.join(', ')}
                        </Text>
                    )}

                    <View style={styles.divider} />

                    <Text style={styles.resultLabel}>🌱 Better Alternative</Text>
                    {result.greener_alternative ? (
                        <>
                            <Text style={styles.resultText}>
                                Brand: {result.greener_alternative.brands_en ?? 'N/A'}
                            </Text>

                            <View style={styles.ecoScoreRow}>
                                <Text style={styles.resultText}>Eco-Score:</Text>
                                <View style={[styles.ecoScoreBadge, {
                                    backgroundColor: getEcoScoreColor(result.greener_alternative.environmental_score_grade),
                                }]}>
                                    <Text style={styles.ecoScoreText}>
                                        {(result.greener_alternative.environmental_score_grade ?? 'N/A').toUpperCase()}
                                    </Text>
                                </View>
                            </View>

                            {typeof result.greener_alternative.packaging_en === 'string' && (
                                <Text style={styles.resultText}>
                                    Packaging: {result.greener_alternative.packaging_en}
                                </Text>
                            )}

                            {result.greener_alternative.image_url && (
                                <Image
                                    source={{ uri: result.greener_alternative.image_url }}
                                    style={styles.altImage}
                                    resizeMode="cover"
                                />
                            )}
                        </>
                    ) : (
                        <Text style={styles.resultText}>No better alternative found.</Text>
                    )}
                </View>
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
    resultContainer: { marginTop: 30, padding: 15, backgroundColor: '#f0f0f0', borderRadius: 10, width: '100%' },
    resultLabel: { fontWeight: 'bold', marginBottom: 8, fontSize: 16 },
    resultText: { fontSize: 14, marginBottom: 6, color: '#333' },
    ecoScoreRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 6 },
    ecoScoreBadge: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 12, marginLeft: 8 },
    ecoScoreText: { color: 'white', fontSize: 12, fontWeight: 'bold' },
    divider: { height: 1, backgroundColor: '#ccc', marginVertical: 15 },
});
