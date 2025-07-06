import {
    ref as dbRef,
    off,
    onValue,
} from 'firebase/database';
import {
    getDownloadURL,
    ref as storageRef,
} from 'firebase/storage';
import React, { useCallback, useEffect, useState } from 'react';
import {
    ActivityIndicator,
    Alert,
    FlatList,
    Image,
    RefreshControl,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
} from 'react-native';
import { auth, database, storage } from '../firebaseConfig';

type ScanItem = {
    id: string;
    userId: string;
    imageUrl: string;
    prediction: {
        category: string;
        ecoScore: string;
        packaging: string[];
    };
    greenerAlternative: {
        brand: string;
        ecoScore: string;
        packaging: string;
        imageUrl: string | null;
    } | null;
    timestamp: number;
    dateString: string;
};

export default function HistoryScreen() {
    const [scannedItems, setScannedItems] = useState<ScanItem[]>([]);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);

    const formatDate = (timestamp: number) => {
        try {
            const date = new Date(timestamp);
            if (isNaN(date.getTime())) return 'Invalid Date';
            return date.toLocaleDateString('en-US', {
                year: 'numeric',
                month: 'short',
                day: 'numeric',
                hour: '2-digit',
                minute: '2-digit',
            });
        } catch {
            return 'Invalid Date';
        }
    };

    const getEcoScoreColor = (score: string) => {
        const grade = score?.toLowerCase();
        if (grade === 'a-plus' || grade === 'a' || grade === 'b') return '#4CAF50';
        if (grade === 'c' || grade === 'd') return '#FF9800';
        if (grade === 'e' || grade === 'f') return '#F44336';
        return '#9E9E9E';
    };

    const fetchScanHistory = useCallback(() => {
        const user = auth.currentUser;
        if (!user) {
            Alert.alert('Not signed in', 'Please sign in to view your scan history.');
            setLoading(false);
            setRefreshing(false);
            return;
        }

        try {
            const scansRef = dbRef(database, `scans/${user.uid}`);

            const onData = async (snapshot: any) => {
                const data = snapshot.val() as Record<string, any>;
                const scansList: ScanItem[] = [];

                if (data) {
                    const entries = Object.entries(data);

                    for (const [key, value] of entries) {
                        const rawPackaging = value.prediction?.packaging;
                        const normalizedPackaging = Array.isArray(rawPackaging)
                            ? rawPackaging
                            : typeof rawPackaging === 'string'
                                ? [rawPackaging]
                                : [];

                        let timestamp = value.timestamp;
                        if (typeof timestamp !== 'number') timestamp = Date.now();

                        let imageUrl = value.imageUrl || '';

                        // 🔄 Fallback: Try to get the image from Firebase Storage if imageUrl is missing
                        if (!imageUrl) {
                            try {
                                const storagePath = `scans/${user.uid}/${key}.jpg`;
                                const imgRef = storageRef(storage, storagePath);
                                imageUrl = await getDownloadURL(imgRef);
                            } catch (err) {
                                console.warn(`No image found for ${key} in storage.`);
                            }
                        }

                        scansList.push({
                            id: key,
                            userId: user.uid,
                            imageUrl,
                            prediction: {
                                category: value.prediction?.category || 'Unknown',
                                ecoScore: value.prediction?.ecoScore || 'N/A',
                                packaging: normalizedPackaging,
                            },
                            greenerAlternative: value.greenerAlternative
                                ? {
                                    brand: value.greenerAlternative.brand || 'N/A',
                                    ecoScore: value.greenerAlternative.ecoScore || 'N/A',
                                    packaging: value.greenerAlternative.packaging || 'Unknown',
                                    imageUrl: value.greenerAlternative.imageUrl || null,
                                }
                                : null,
                            timestamp,
                            dateString: formatDate(timestamp),
                        });
                    }

                    scansList.sort((a, b) => b.timestamp - a.timestamp);
                }

                setScannedItems(scansList);
                setLoading(false);
                setRefreshing(false);
            };

            const onError = (error: any) => {
                console.error('Error fetching scan history:', error);
                Alert.alert('Error', 'Failed to load scan history. Please try again.');
                setLoading(false);
                setRefreshing(false);
            };

            const unsubscribe = onValue(scansRef, onData, onError);
            return () => {
                off(scansRef);
                unsubscribe();
            };
        } catch (error) {
            console.error('Listener error:', error);
            setLoading(false);
            setRefreshing(false);
        }
    }, []);

    useEffect(() => {
        const unsubscribe = fetchScanHistory();
        return unsubscribe;
    }, [fetchScanHistory]);

    const onRefresh = useCallback(() => {
        setRefreshing(true);
        fetchScanHistory();
    }, [fetchScanHistory]);

    const renderItem = ({ item }: { item: ScanItem }) => (
        <TouchableOpacity style={styles.itemContainer} activeOpacity={0.7}>
            <View style={styles.itemHeader}>
                <Text style={styles.dateText}>{item.dateString}</Text>
                <View
                    style={[
                        styles.ecoScoreBadge,
                        { backgroundColor: getEcoScoreColor(item.prediction.ecoScore) },
                    ]}
                >
                    <Text style={styles.ecoScoreText}>
                        {item.prediction.ecoScore.toUpperCase()}
                    </Text>
                </View>
            </View>

            <View style={styles.itemContent}>
                {item.imageUrl ? (
                    <Image source={{ uri: item.imageUrl }} style={styles.itemImage} />
                ) : (
                    <View style={[styles.itemImage, styles.placeholderImage]}>
                        <Text style={styles.placeholderText}>📷</Text>
                    </View>
                )}
                <View style={styles.itemDetails}>
                    <Text style={styles.categoryText} numberOfLines={2}>
                        {item.prediction.category}
                    </Text>
                    {item.prediction.packaging?.length > 0 && (
                        <Text style={styles.packagingText} numberOfLines={2}>
                            📦 {item.prediction.packaging.join(', ')}
                        </Text>
                    )}
                    {item.greenerAlternative && (
                        <View style={styles.alternativeContainer}>
                            <Text style={styles.alternativeLabel}>🌱 Better Alternative:</Text>
                            <Text style={styles.alternativeText} numberOfLines={1}>
                                {item.greenerAlternative.brand}
                            </Text>
                        </View>
                    )}
                </View>
            </View>
        </TouchableOpacity>
    );

    return (
        <View style={styles.container}>
            <Text style={styles.title}>Scan History</Text>

            {loading ? (
                <View style={styles.loadingContainer}>
                    <ActivityIndicator size="large" color="#4CAF50" />
                    <Text style={styles.loadingText}>Loading scan history...</Text>
                </View>
            ) : (
                <FlatList
                    data={scannedItems}
                    keyExtractor={(item) => item.id}
                    renderItem={renderItem}
                    ListEmptyComponent={
                        <View style={styles.emptyContainer}>
                            <Text style={styles.emptyText}>No scanned items yet.</Text>
                            <Text style={styles.emptySubText}>Scan a product to get started!</Text>
                        </View>
                    }
                    contentContainerStyle={scannedItems.length === 0 ? styles.emptyList : undefined}
                    refreshControl={
                        <RefreshControl
                            refreshing={refreshing}
                            onRefresh={onRefresh}
                            colors={['#4CAF50']}
                            tintColor="#4CAF50"
                        />
                    }
                    showsVerticalScrollIndicator={false}
                />
            )}
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        padding: 20,
        backgroundColor: 'white',
    },
    title: {
        fontSize: 24,
        fontWeight: 'bold',
        textAlign: 'center',
        marginBottom: 20,
        color: '#333',
    },
    loadingContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
    },
    loadingText: {
        marginTop: 10,
        fontSize: 16,
        color: '#666',
    },
    itemContainer: {
        backgroundColor: '#f0f0f0',
        padding: 15,
        borderRadius: 10,
        marginBottom: 12,
    },
    itemHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        marginBottom: 10,
    },
    dateText: {
        fontSize: 12,
        color: '#666',
    },
    ecoScoreBadge: {
        paddingHorizontal: 8,
        paddingVertical: 4,
        borderRadius: 12,
    },
    ecoScoreText: {
        color: 'white',
        fontSize: 12,
        fontWeight: 'bold',
    },
    itemContent: {
        flexDirection: 'row',
    },
    itemImage: {
        width: 60,
        height: 60,
        borderRadius: 8,
        marginRight: 12,
        backgroundColor: '#ccc',
    },
    placeholderImage: {
        justifyContent: 'center',
        alignItems: 'center',
    },
    placeholderText: {
        fontSize: 20,
        color: '#fff',
    },
    itemDetails: {
        flex: 1,
    },
    categoryText: {
        fontSize: 16,
        fontWeight: '600',
        color: '#333',
    },
    packagingText: {
        fontSize: 13,
        color: '#666',
        marginVertical: 4,
    },
    alternativeContainer: {
        marginTop: 6,
    },
    alternativeLabel: {
        fontSize: 12,
        fontWeight: '600',
        color: '#2d5a2d',
    },
    alternativeText: {
        fontSize: 12,
        color: '#2d5a2d',
    },
    emptyContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        padding: 40,
    },
    emptyText: {
        fontSize: 18,
        fontWeight: '600',
        color: '#666',
    },
    emptySubText: {
        fontSize: 14,
        color: '#999',
        marginTop: 6,
        textAlign: 'center',
    },
    emptyList: {
        flexGrow: 1,
        justifyContent: 'center',
    },
});
