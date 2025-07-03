import * as ImagePicker from 'expo-image-picker';
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

export default function ScanScreen() {
    const [imageUri, setImageUri] = useState<string | null>(null);
    const [result, setResult] = useState<any | null>(null);
    const [loading, setLoading] = useState(false);

    const takePhoto = async () => {
        const { status } = await ImagePicker.requestCameraPermissionsAsync();
        if (status !== 'granted') {
            Alert.alert('Permission Denied', 'Camera access is required to take photos.');
            return;
        }

        const photo = await ImagePicker.launchCameraAsync({
            quality: 0.7,
            base64: false,
        });

        if (!photo.canceled && photo.assets.length > 0) {
            setImageUri(photo.assets[0].uri);
            setResult(null);
        }
    };

    const pickImage = async () => {
        const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
        if (status !== 'granted') {
            Alert.alert('Permission Denied', 'Gallery access is required to pick photos.');
            return;
        }

        const picked = await ImagePicker.launchImageLibraryAsync({
            quality: 0.7,
            base64: false,
        });

        if (!picked.canceled && picked.assets.length > 0) {
            setImageUri(picked.assets[0].uri);
            setResult(null);
        }
    };

    const uploadAndScan = async () => {
        if (!imageUri) {
            Alert.alert('No Image', 'Please select or take a photo first.');
            return;
        }

        setLoading(true);
        setResult(null);

        try {
            const response = await fetch(imageUri);
            const blob = await response.blob();

            const formData = new FormData();
            formData.append('file', {
                uri: imageUri,
                name: 'photo.jpg',
                type: blob.type || 'image/jpeg',
            } as any);

            const apiUrl = 'http://127.0.0.1:8000/predict';

            const apiResponse = await fetch(apiUrl, {
                method: 'POST',
                headers: {
                    'Content-Type': 'multipart/form-data',
                },
                body: formData,
            });

            if (!apiResponse.ok) {
                throw new Error(`API Error: ${apiResponse.status}`);
            }

            const data = await apiResponse.json();
            setResult(data);
        } catch (error: any) {
            Alert.alert('Scan Failed', error.message || 'Unknown error occurred.');
        } finally {
            setLoading(false);
        }
    };

    return (
        <ScrollView contentContainerStyle={styles.container}>
            <Text style={styles.title}>Scan Product</Text>

            {imageUri && <Image source={{ uri: imageUri }} style={styles.image} />}

            <View style={styles.buttonRow}>
                <Button title="Take Photo" onPress={takePhoto} />
                <View style={{ width: 10 }} />
                <Button title="Pick from Gallery" onPress={pickImage} />
            </View>

            <View style={{ height: 20 }} />
            <Button title="Scan Image" onPress={uploadAndScan} disabled={!imageUri || loading} />

            {loading && <ActivityIndicator size="large" color="#000" style={{ marginTop: 20 }} />}

            {result && (
                <View style={styles.resultContainer}>
                    <Text style={styles.resultLabel}>🧾 Product Prediction</Text>
                    <Text>Main Category: {result.prediction.main_category_en}</Text>
                    <Text>Eco-Score: {result.prediction.environmental_score_grade.toUpperCase()}</Text>
                    <Text>Nutri-Score: {result.prediction.nutriscore_grade.toUpperCase()}</Text>
                    <Text>Labels: {result.prediction.labels_en.join(', ') || 'None'}</Text>
                    <Text>Packaging: {result.prediction.packaging_en.join(', ') || 'Unknown'}</Text>

                    <View style={styles.divider} />

                    <Text style={styles.resultLabel}>🌱 Greener Alternative</Text>
                    <Text>Brands: {result.greener_alternative.brands_en}</Text>
                    <Text>Eco-Score: {result.greener_alternative.environmental_score_grade.toUpperCase()}</Text>
                    <Text>Nutri-Score: {result.greener_alternative.nutriscore_grade.toUpperCase()}</Text>
                    <Text>Labels: {result.greener_alternative.labels_en}</Text>
                    <Text>Packaging: {result.greener_alternative.packaging_en}</Text>

                    {result.greener_alternative.image_url && (
                        <Image
                            source={{ uri: result.greener_alternative.image_url }}
                            style={styles.altImage}
                        />
                    )}
                </View>
            )}
        </ScrollView>
    );
}

const styles = StyleSheet.create({
    container: { flexGrow: 1, padding: 20, alignItems: 'center', backgroundColor: 'white' },
    title: { fontSize: 24, marginBottom: 20 },
    image: { width: 250, height: 250, borderRadius: 12, marginBottom: 20 },
    altImage: { width: 150, height: 150, marginTop: 10, borderRadius: 10 },
    buttonRow: { flexDirection: 'row', marginBottom: 10 },
    resultContainer: {
        marginTop: 30,
        padding: 15,
        backgroundColor: '#f0f0f0',
        borderRadius: 10,
        width: '100%',
    },
    resultLabel: { fontWeight: 'bold', marginBottom: 8, fontSize: 16 },
    divider: {
        height: 1,
        backgroundColor: '#ccc',
        marginVertical: 15,
    },
});
