import { Picker } from '@react-native-picker/picker';
import * as FileSystem from 'expo-file-system';
import { manipulateAsync, SaveFormat } from 'expo-image-manipulator';
import * as ImagePicker from 'expo-image-picker';
import { ref as dbRef, push, serverTimestamp } from 'firebase/database';
import { getDownloadURL, ref as storageRef, uploadBytes } from 'firebase/storage';
import React, { useCallback, useMemo, useState } from 'react';
import {
    ActivityIndicator,
    Alert,
    Button,
    Image,
    Modal,
    ScrollView,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
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

const TOP_CATEGORIES = [
    'Beverages',
    'Snacks',
    'Dairy products',
    'Meat alternatives',
    'Breakfast cereals',
    'Frozen foods',
    'Canned goods',
    'Bakery products',
    'Condiments',
    'Fresh produce'
];

const TOP_PACKAGING = [
    'Plastic bottle',
    'Glass bottle',
    'Aluminum can',
    'Cardboard box',
    'Plastic container',
    'Paper bag',
    'Tetra pack',
    'Metal can',
    'Plastic wrapper',
    'Glass jar'
];

const TOP_LABELS = [
    'Organic',
    'Fair trade',
    'Recyclable',
    'Non-GMO',
    'Gluten-free',
    'Vegan',
    'Sugar-free',
    'Low sodium',
    'Natural',
    'Sustainable'
];

const ALTERNATIVE_FEEDBACK_OPTIONS = [
    'Not the right product category',
    'Different packaging type needed',
    'Price point too high',
    'Brand preference',
    'Availability issues',
    'Nutritional concerns',
    'Not environmentally better',
    'Other'
];

export default function ScanScreen() {
    const [imageUri, setImageUri] = useState<string | null>(null);
    const [result, setResult] = useState<any | null>(null);
    const [loading, setLoading] = useState(false);
    const [preferred, setPreferred] = useState<string | null>(null);
    const [currentScanId, setCurrentScanId] = useState<string | null>(null);

    // Cache for uploaded images to avoid re-uploading
    const [imageCache, setImageCache] = useState({
        productImageUrl: null as string | null,
        alternativeImageUrl: null as string | null
    });

    // Feedback form states
    const [showProductFeedback, setShowProductFeedback] = useState(false);
    const [showAlternativeFeedback, setShowAlternativeFeedback] = useState(false);
    const [productFeedback, setProductFeedback] = useState({
        category: '',
        packaging: '',
        label: ''
    });
    const [alternativeFeedback, setAlternativeFeedback] = useState({
        reasons: [] as string[],
        comment: ''
    });

    // Optimized image compression with better settings
    const compressImage = useCallback(async (uri: string) => {
        try {
            const info = await FileSystem.getInfoAsync(uri);
            if (!info.exists) {
                console.error('Image file does not exist at:', uri);
                return uri;
            }

            // More aggressive compression for faster uploads
            const manipulated = await manipulateAsync(
                uri,
                [{ resize: { width: 600 } }], // Smaller size for faster upload
                {
                    compress: 0.5, // More compression
                    format: SaveFormat.JPEG,
                }
            );

            return manipulated.uri;
        } catch (error) {
            console.error('Image compression failed:', error);
            return uri;
        }
    }, []);

    // Optimized Firebase image upload with retry logic
    const uploadImageToStorage = useCallback(async (
        uri: string,
        userId: string,
        prefix: string = 'scans'
    ): Promise<string> => {
        const maxRetries = 2;
        let attempt = 0;

        while (attempt < maxRetries) {
            try {
                const response = await fetch(uri);
                const blob = await response.blob();

                // Generate unique filename to avoid conflicts
                const timestamp = Date.now();
                const randomId = Math.random().toString(36).substr(2, 9);
                const fileName = `${timestamp}_${randomId}.jpg`;

                const imageRef = storageRef(storage, `${prefix}/${userId}/${fileName}`);
                await uploadBytes(imageRef, blob);
                return await getDownloadURL(imageRef);
            } catch (error) {
                attempt++;
                console.error(`Upload attempt ${attempt} failed:`, error);

                if (attempt >= maxRetries) {
                    throw new Error(`Failed to upload after ${maxRetries} attempts`);
                }

                // Wait before retry
                await new Promise(resolve => setTimeout(resolve, 1000 * attempt));
            }
        }
        throw new Error('Upload failed');
    }, []);

    // Parallel image processing for better performance
    const processImages = useCallback(async (
        productUri: string,
        alternativeUrl: string | null,
        userId: string
    ) => {
        try {
            const uploadPromises = [];

            // Compress and upload product image
            const compressedProductUri = await compressImage(productUri);
            uploadPromises.push(
                uploadImageToStorage(compressedProductUri, userId, 'products')
                    .then(url => ({ type: 'product', url }))
            );

            // Process alternative image if available
            if (alternativeUrl) {
                uploadPromises.push(
                    fetch(alternativeUrl)
                        .then(response => response.blob())
                        .then(blob => {
                            const imageRef = storageRef(
                                storage,
                                `alternatives/${userId}/${Date.now()}.jpg`
                            );
                            return uploadBytes(imageRef, blob);
                        })
                        .then(snapshot => getDownloadURL(snapshot.ref))
                        .then(url => ({ type: 'alternative', url }))
                        .catch(() => ({ type: 'alternative', url: alternativeUrl }))
                );
            }

            // Wait for all uploads to complete
            const results = await Promise.all(uploadPromises);

            const urls = {
                productImageUrl: results.find(r => r.type === 'product')?.url || null,
                alternativeImageUrl: results.find(r => r.type === 'alternative')?.url || null
            };

            setImageCache(urls);
            return urls;
        } catch (error) {
            console.error('Image processing error:', error);
            throw error;
        }
    }, [compressImage, uploadImageToStorage]);

    // Helper function to generate unique scan ID
    const generateScanId = useCallback((userId: string): string => {
        const timestamp = Date.now();
        const randomSuffix = Math.random().toString(36).substr(2, 9);
        return `${userId}_${timestamp}_${randomSuffix}`;
    }, []);

    const resetScreen = useCallback(() => {
        setImageUri(null);
        setResult(null);
        setPreferred(null);
        setCurrentScanId(null);
        setImageCache({ productImageUrl: null, alternativeImageUrl: null });
        setShowProductFeedback(false);
        setShowAlternativeFeedback(false);
        setProductFeedback({ category: '', packaging: '', label: '' });
        setAlternativeFeedback({ reasons: [], comment: '' });
    }, []);

    const copyImageToLocalCache = useCallback(async (uri: string): Promise<string> => {
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
    }, []);

    // Optimized save function with background processing
    const saveScanResults = useCallback(async (
        localImageUri: string,
        scanData: any,
        preferredChoice: string | null = null
    ) => {
        try {
            const userId = auth.currentUser?.uid;
            if (!userId) throw new Error('User not authenticated');

            const scanId = currentScanId || generateScanId(userId);

            // Start image processing in background (don't await immediately)
            const imageProcessingPromise = processImages(
                localImageUri,
                scanData.greener_alternative?.image_url,
                userId
            );

            // Prepare scan data while images are uploading
            const packaging = Array.isArray(scanData.prediction?.packaging_en)
                ? scanData.prediction.packaging_en
                : [];

            const baseScanRecord = {
                scanId,
                userId,
                prediction: {
                    category: scanData.prediction?.main_category_en || 'Unknown',
                    ecoScore: scanData.prediction?.environmental_score_grade || 'N/A',
                    packaging,
                },
                greenerAlternative: scanData.greener_alternative
                    ? {
                        ecoScore: scanData.greener_alternative.environmental_score_grade || 'N/A',
                        packaging: scanData.greener_alternative.packaging_en || 'Unknown',
                    }
                    : null,
                preferred: preferredChoice ?? null,
                timestamp: serverTimestamp(),
                status: 'active',
                feedbackCount: 0,
            };

            // Wait for images to finish uploading
            const urls = await imageProcessingPromise;

            // Complete the scan record with image URLs
            const completeScanRecord = {
                ...baseScanRecord,
                productImageUrl: urls.productImageUrl,
                greenerAlternative: baseScanRecord.greenerAlternative
                    ? {
                        ...baseScanRecord.greenerAlternative,
                        imageUrl: urls.alternativeImageUrl,
                    }
                    : null,
            };

            // Save to database
            const scanRef = dbRef(database, `scans/${userId}/${scanId}`);
            await push(scanRef, completeScanRecord);

            setCurrentScanId(scanId);
            console.log('Scan saved with ID:', scanId);
        } catch (error) {
            console.error('Save error:', error);
            throw new Error('Saving scan failed');
        }
    }, [currentScanId, generateScanId, processImages]);

    // Optimized feedback save with cached images
    const saveFeedback = useCallback(async (feedbackData: any, type: 'product' | 'alternative') => {
        try {
            const userId = auth.currentUser?.uid;
            if (!userId) throw new Error('User not authenticated');

            if (!currentScanId) {
                throw new Error('No scan ID available - please scan a product first');
            }

            // Use cached image URLs if available, otherwise upload
            let imageUrls = { ...imageCache };

            if (!imageUrls.productImageUrl && imageUri) {
                try {
                    const compressedUri = await compressImage(imageUri);
                    imageUrls.productImageUrl = await uploadImageToStorage(compressedUri, userId, 'feedback');
                } catch (error) {
                    console.error('Error uploading product image for feedback:', error);
                }
            }

            const feedbackRecord = {
                userId,
                scanId: currentScanId,
                type,
                scanData: result,
                feedback: feedbackData,
                imageUrls,
                timestamp: serverTimestamp(),
                modelVersion: 'v1.0',
                feedbackSource: 'mobile_app',
            };

            const feedbackRef = dbRef(database, `feedback/${userId}/${currentScanId}`);
            await push(feedbackRef, feedbackRecord);

            console.log('Feedback saved with scan ID:', currentScanId);
        } catch (error) {
            console.error('Save feedback error:', error);
            throw new Error('Saving feedback failed');
        }
    }, [currentScanId, imageCache, imageUri, compressImage, uploadImageToStorage, result]);

    const takePhoto = useCallback(async () => {
        try {
            const { status } = await ImagePicker.requestCameraPermissionsAsync();
            if (status !== 'granted') {
                Alert.alert('Permission Denied', 'Camera access is required.');
                return;
            }

            const photo = await ImagePicker.launchCameraAsync({
                quality: 0.6, // Reduced quality for faster processing
                base64: false,
                allowsEditing: false,
                mediaTypes: ImagePicker.MediaTypeOptions.Images,
            });

            if (!photo.canceled && photo.assets?.length > 0) {
                const originalUri = photo.assets[0].uri;
                const localPath = await copyImageToLocalCache(originalUri);

                setImageUri(localPath);
                setResult(null);
                setPreferred(null);
                setCurrentScanId(null);
                setImageCache({ productImageUrl: null, alternativeImageUrl: null });
            }
        } catch (error) {
            console.error('Error taking photo:', error);
            Alert.alert('Error', 'Failed to take photo. Please try again.');
        }
    }, [copyImageToLocalCache]);

    const pickImage = useCallback(async () => {
        try {
            const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
            if (status !== 'granted') {
                Alert.alert('Permission Denied', 'Gallery access is required.');
                return;
            }

            const picked = await ImagePicker.launchImageLibraryAsync({
                quality: 0.6, // Reduced quality for faster processing
                base64: false,
                allowsEditing: false,
                mediaTypes: ImagePicker.MediaTypeOptions.Images,
            });

            if (!picked.canceled && picked.assets?.length > 0) {
                const originalUri = picked.assets[0].uri;
                const localPath = await copyImageToLocalCache(originalUri);

                setImageUri(localPath);
                setResult(null);
                setPreferred(null);
                setCurrentScanId(null);
                setImageCache({ productImageUrl: null, alternativeImageUrl: null });
            }
        } catch (error) {
            console.error('Error picking image:', error);
            Alert.alert('Error', 'Failed to select image. Please try again.');
        }
    }, [copyImageToLocalCache]);

    const getEcoScoreColor = useCallback((score: string) => {
        const grade = score?.toUpperCase();
        if (grade === 'A+' || grade === 'A' || grade === 'B') return '#2C5B3F';
        if (grade === 'C' || grade === 'D') return '#FF9800';
        if (grade === 'E' || grade === 'F') return '#F44336';
        return '#9E9E9E';
    }, []);

    const isValidFoodProduct = useCallback((prediction: any) => {
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
    }, []);

    const uploadAndScan = useCallback(async () => {
        if (!imageUri) {
            Alert.alert('No Image', 'Please select or take a photo first.');
            return;
        }

        setLoading(true);
        setResult(null);
        setPreferred(null);
        setCurrentScanId(null);
        setImageCache({ productImageUrl: null, alternativeImageUrl: null });

        try {
            const imageInfo = await FileSystem.getInfoAsync(imageUri);
            if (!imageInfo.exists) {
                throw new Error('Image file not found. Please try again.');
            }

            // Compress image before sending to API
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

            // Generate scan ID immediately after successful scan
            const userId = auth.currentUser?.uid;
            if (userId) {
                const newScanId = generateScanId(userId);
                setCurrentScanId(newScanId);
                console.log('Generated scan ID:', newScanId);
            }
        } catch (error: any) {
            console.error('Scan error:', error);
            Alert.alert('Scan Failed', error.message || 'Something went wrong. Please try again.');
        } finally {
            setLoading(false);
        }
    }, [imageUri, compressImage, isValidFoodProduct, generateScanId]);

    // Non-blocking preference selection
    const handlePreferenceSelection = useCallback(async (choice: string) => {
        setPreferred(choice);

        Alert.alert(
            "Thank you!",
            `You selected the ${choice === 'product' ? 'Scanned Product' : 'Greener Alternative'}. Saving your choice...`,
            [{ text: "OK", onPress: () => setTimeout(resetScreen, 500) }]
        );

        // Save in background without blocking UI
        try {
            await saveScanResults(imageUri!, result, choice);
        } catch (error) {
            console.error('Error saving preference:', error);
            // Don't show error to user since they already got confirmation
        }
    }, [imageUri, result, saveScanResults, resetScreen]);

    const handleProductFeedbackSubmit = useCallback(async () => {
        try {
            await saveFeedback(productFeedback, 'product');
            setShowProductFeedback(false);
            Alert.alert("Thank you!", "Your feedback helps us improve product recognition.");
        } catch (error) {
            Alert.alert("Error", "Could not save feedback.");
        }
    }, [saveFeedback, productFeedback]);

    const handleAlternativeFeedbackSubmit = useCallback(async () => {
        try {
            await saveFeedback(alternativeFeedback, 'alternative');
            setShowAlternativeFeedback(false);
            Alert.alert("Thank you!", "Your feedback helps us suggest better alternatives.");
        } catch (error) {
            Alert.alert("Error", "Could not save feedback.");
        }
    }, [saveFeedback, alternativeFeedback]);

    const toggleAlternativeReason = useCallback((reason: string) => {
        setAlternativeFeedback(prev => ({
            ...prev,
            reasons: prev.reasons.includes(reason)
                ? prev.reasons.filter(r => r !== reason)
                : [...prev.reasons, reason]
        }));
    }, []);

    // Memoized components for better performance
    const renderProductFeedbackModal = useMemo(() => (
        <Modal
            visible={showProductFeedback}
            animationType="slide"
            transparent={true}
        >
            <View style={styles.modalOverlay}>
                <View style={styles.modalContent}>
                    <Text style={styles.modalTitle}>🔍 Help Us Improve Recognition</Text>
                    <Text style={styles.modalSubtitle}>What should this product be classified as?</Text>

                    {currentScanId && (
                        <Text style={styles.scanIdText}>Scan ID: {currentScanId.slice(-8)}</Text>
                    )}

                    <View style={styles.pickerContainer}>
                        <Text style={styles.pickerLabel}>Category:</Text>
                        <Picker
                            selectedValue={productFeedback.category}
                            style={styles.picker}
                            onValueChange={(value: string) =>
                                setProductFeedback(prev => ({ ...prev, category: value }))
                            }
                        >
                            <Picker.Item label="Select category..." value="" />
                            {TOP_CATEGORIES.map(cat => (
                                <Picker.Item key={cat} label={cat} value={cat} />
                            ))}
                        </Picker>
                    </View>

                    <View style={styles.pickerContainer}>
                        <Text style={styles.pickerLabel}>Packaging:</Text>
                        <Picker
                            selectedValue={productFeedback.packaging}
                            style={styles.picker}
                            onValueChange={(value: string) =>
                                setProductFeedback(prev => ({ ...prev, packaging: value }))
                            }
                        >
                            <Picker.Item label="Select packaging..." value="" />
                            {TOP_PACKAGING.map(pack => (
                                <Picker.Item key={pack} label={pack} value={pack} />
                            ))}
                        </Picker>
                    </View>

                    <View style={styles.pickerContainer}>
                        <Text style={styles.pickerLabel}>Main Label/Claim:</Text>
                        <Picker
                            selectedValue={productFeedback.label}
                            style={styles.picker}
                            onValueChange={(value: string) =>
                                setProductFeedback(prev => ({ ...prev, label: value }))
                            }
                        >
                            <Picker.Item label="Select label..." value="" />
                            {TOP_LABELS.map(label => (
                                <Picker.Item key={label} label={label} value={label} />
                            ))}
                        </Picker>
                    </View>

                    <View style={styles.modalButtonRow}>
                        <TouchableOpacity
                            style={[styles.modalButton, styles.cancelButton]}
                            onPress={() => setShowProductFeedback(false)}
                        >
                            <Text style={styles.cancelButtonText}>Cancel</Text>
                        </TouchableOpacity>
                        <TouchableOpacity
                            style={[styles.modalButton, styles.submitButton]}
                            onPress={handleProductFeedbackSubmit}
                        >
                            <Text style={styles.submitButtonText}>Submit</Text>
                        </TouchableOpacity>
                    </View>
                </View>
            </View>
        </Modal>
    ), [showProductFeedback, currentScanId, productFeedback, handleProductFeedbackSubmit]);

    const renderAlternativeFeedbackModal = useMemo(() => (
        <Modal
            visible={showAlternativeFeedback}
            animationType="slide"
            transparent={true}
        >
            <View style={styles.modalOverlay}>
                <View style={styles.modalContent}>
                    <Text style={styles.modalTitle}>🤔 Why isn't this alternative helpful?</Text>
                    <Text style={styles.modalSubtitle}>Select all that apply:</Text>


                    <ScrollView style={styles.reasonsList}>
                        {ALTERNATIVE_FEEDBACK_OPTIONS.map(reason => (
                            <TouchableOpacity
                                key={reason}
                                style={[
                                    styles.reasonOption,
                                    alternativeFeedback.reasons.includes(reason) && styles.selectedReason
                                ]}
                                onPress={() => toggleAlternativeReason(reason)}
                            >
                                <Text style={[
                                    styles.reasonText,
                                    alternativeFeedback.reasons.includes(reason) && styles.selectedReasonText
                                ]}>
                                    {alternativeFeedback.reasons.includes(reason) ? '✓ ' : ''}{reason}
                                </Text>
                            </TouchableOpacity>
                        ))}
                    </ScrollView>

                    <Text style={styles.commentLabel}>Additional comments (optional):</Text>
                    <TextInput
                        style={styles.commentInput}
                        multiline
                        numberOfLines={3}
                        value={alternativeFeedback.comment}
                        onChangeText={(text) =>
                            setAlternativeFeedback(prev => ({ ...prev, comment: text }))
                        }
                        placeholder="Tell us more about what you'd prefer..."
                    />

                    <View style={styles.modalButtonRow}>
                        <TouchableOpacity
                            style={[styles.modalButton, styles.cancelButton]}
                            onPress={() => setShowAlternativeFeedback(false)}
                        >
                            <Text style={styles.cancelButtonText}>Cancel</Text>
                        </TouchableOpacity>
                        <TouchableOpacity
                            style={[styles.modalButton, styles.submitButton]}
                            onPress={handleAlternativeFeedbackSubmit}
                        >
                            <Text style={styles.submitButtonText}>Submit</Text>
                        </TouchableOpacity>
                    </View>
                </View>
            </View>
        </Modal>
    ), [showAlternativeFeedback, currentScanId, alternativeFeedback, toggleAlternativeReason, handleAlternativeFeedbackSubmit]);

    const renderProductCard = useCallback((isAlternative = false) => {
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

                <TouchableOpacity
                    style={[styles.feedbackButton, {
                        backgroundColor: isAlternative ? '#FFF3E0' : '#E3F2FD'
                    }]}
                    onPress={() => {
                        if (isAlternative) {
                            setShowAlternativeFeedback(true);
                        } else {
                            setShowProductFeedback(true);
                        }
                    }}
                >
                    <Text style={[styles.feedbackButtonText, {
                        color: isAlternative ? '#FF9800' : '#1976D2'
                    }]}>
                        {isAlternative ? '🚫 Not what I need' : '⚠️ Looks wrong to me'}
                    </Text>
                </TouchableOpacity>
            </View>
        );
    }, [result, imageUri, getEcoScoreColor, handlePreferenceSelection]);


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
                    {result.greener_alternative ? (
                        renderProductCard(true)
                    ) : (
                        <View style={[styles.noAlternativeContainer, { backgroundColor: '#E8F5E9' }]}>
                            <Text style={styles.noAlternativeText}>
                                🌱 No greener alternative found for this product.
                            </Text>
                        </View>
                    )}
                </View>
            )}

            {preferred && (
                <Text style={styles.selectedText}>
                    ✅ You selected the {preferred === 'product' ? 'Scanned Product' : 'Greener Alternative'}.
                </Text>
            )}

            {renderProductFeedbackModal}
            {renderAlternativeFeedbackModal}
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
    feedbackButton: {
        marginTop: 12,
        paddingVertical: 8,
        paddingHorizontal: 12,
        borderRadius: 8,
        alignItems: 'center',
    },
    feedbackButtonText: {
        fontSize: 13,
        fontWeight: '600',
    },
    modalOverlay: {
        flex: 1,
        backgroundColor: 'rgba(0, 0, 0, 0.5)',
        justifyContent: 'center',
        alignItems: 'center',
    },
    modalContent: {
        backgroundColor: 'white',
        borderRadius: 16,
        padding: 20,
        width: '90%',
        maxHeight: '80%',
    },
    modalTitle: {
        fontSize: 18,
        fontWeight: 'bold',
        textAlign: 'center',
        marginBottom: 8,
        color: '#2C5B3F',
    },
    modalSubtitle: {
        fontSize: 14,
        textAlign: 'center',
        marginBottom: 20,
        color: '#666',
    },
    pickerContainer: {
        marginBottom: 16,
    },
    pickerLabel: {
        fontSize: 16,
        fontWeight: '600',
        marginBottom: 4,
        color: '#333',
    },
    picker: {
        backgroundColor: '#F5F5F5',
        borderRadius: 8,
    },
    reasonsList: {
        maxHeight: 200,
        marginBottom: 16,
    },
    reasonOption: {
        paddingVertical: 12,
        paddingHorizontal: 16,
        marginBottom: 8,
        borderRadius: 8,
        borderWidth: 1,
        borderColor: '#E0E0E0',
        backgroundColor: '#F9F9F9',
    },
    selectedReason: {
        backgroundColor: '#E8F5E9',
        borderColor: '#4CAF50',
    },
    reasonText: {
        fontSize: 14,
        color: '#333',
    },
    selectedReasonText: {
        color: '#2C5B3F',
        fontWeight: '600',
    },
    commentLabel: {
        fontSize: 16,
        fontWeight: '600',
        marginBottom: 8,
        color: '#333',
    },
    commentInput: {
        borderWidth: 1,
        borderColor: '#E0E0E0',
        borderRadius: 8,
        padding: 12,
        fontSize: 14,
        textAlignVertical: 'top',
        backgroundColor: '#F9F9F9',
        marginBottom: 20,
    },
    modalButtonRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        gap: 12,
    },
    modalButton: {
        flex: 1,
        paddingVertical: 12,
        borderRadius: 8,
        alignItems: 'center',
    },
    cancelButton: {
        backgroundColor: '#F5F5F5',
        borderWidth: 1,
        borderColor: '#E0E0E0',
    },
    submitButton: {
        backgroundColor: '#2C5B3F',
    },
    cancelButtonText: {
        fontSize: 16,
        fontWeight: '600',
        color: '#666',
    },
    submitButtonText: {
        fontSize: 16,
        fontWeight: '600',
        color: 'white',
    },
    scanIdText: {
        fontSize: 12,
        color: '#999',
        textAlign: 'center',
        marginBottom: 12,
        fontFamily: 'monospace',
    },
    noAlternativeContainer: {
        backgroundColor: '#E8F5E9', // Changed from #FFF8E1 to light green
        borderRadius: 12,
        padding: 16,
        marginTop: 16,
        borderLeftWidth: 4,
        borderLeftColor: '#4CAF50', // Changed from #FFB300 to green
        width: '90%',
        alignItems: 'center',
    },
    noAlternativeText: {
        fontSize: 15,
        fontWeight: '600',
        color: '#2E7D32', // Changed from #FF8F00 to dark green
        textAlign: 'center',
        marginBottom: 6,
    },
    noAlternativeSubtext: {
        fontSize: 13,
        color: '#388E3C', // Changed from #F57C00 to medium green
        textAlign: 'center',
        fontStyle: 'italic',
    },
});