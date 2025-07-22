import { ref as dbRef, off, onValue } from 'firebase/database';
import React, { useEffect, useState } from 'react';
import {
    ActivityIndicator,
    FlatList,
    Image,
    StyleSheet,
    Text,
    View,
} from 'react-native';
import { auth, database } from '../firebaseConfig';

type ScanRecord = {
    scanId?: string;
    productImageUrl?: string;
    prediction: {
        category?: string;
        ecoScore?: string;
        packaging?: string[];
    };
    greenerAlternative: {
        brand?: string;
        ecoScore?: string;
        packaging?: string;
        imageUrl?: string | null;
    } | null;
    timestamp?: number | null;
    [key: string]: any;
};

export default function HistoryScreen() {
    const [scans, setScans] = useState<ScanRecord[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        const userId = auth.currentUser?.uid;
        if (!userId) {
            setError('User not logged in.');
            setLoading(false);
            return;
        }

        const scansRef = dbRef(database, `scans/${userId}`);

        const handleValue = (snapshot: any) => {
            try {
                const data = snapshot.val();
                if (!data) {
                    setScans([]);
                    setLoading(false);
                    return;
                }

                // Flatten nested scan data
                const scansArray: ScanRecord[] = [];
                Object.values(data).forEach((scanGroup: any) => {
                    if (scanGroup && typeof scanGroup === 'object') {
                        Object.values(scanGroup).forEach((scan: any) => {
                            if (scan && scan.prediction) {
                                scansArray.push(scan);
                            }
                        });
                    }
                });

                // Sort by timestamp descending, fallback 0
                scansArray.sort((a, b) => {
                    const timeA = a.timestamp ?? 0;
                    const timeB = b.timestamp ?? 0;
                    return timeB - timeA;
                });

                setScans(scansArray);
                setLoading(false);
            } catch (err) {
                setError('Failed to load scans.');
                setLoading(false);
            }
        };

        onValue(scansRef, handleValue, (err) => {
            setError('Failed to load scans.');
            setLoading(false);
        });

        return () => off(scansRef, 'value', handleValue);
    }, []);

    const getEcoScoreColor = (score?: string) => {
        const grade = score?.toLowerCase();
        if (grade === 'a+' || grade === 'a-plus' || grade === 'a' || grade === 'b') return '#4CAF50';
        if (grade === 'c' || grade === 'd') return '#FF9800';
        if (grade === 'e' || grade === 'f') return '#F44336';
        return '#9E9E9E';
    };

    const renderItem = ({ item }: { item: ScanRecord }) => (
        <View style={styles.card}>
            {/* Scanned Product Title */}
            <Text style={styles.sectionTitle}>Scanned Product</Text>

            <View style={styles.row}>
                {/* Product Image with fallback */}
                <Image
                    source={{
                        uri: item.productImageUrl || 'https://via.placeholder.com/80?text=No+Image',
                    }}
                    style={styles.productImage}
                    resizeMode="cover"
                />
                <View style={styles.info}>
                    {/* Eco-Score with padding above */}
                    <View style={[styles.ecoRow, { marginTop: 8 }]}>
                        <Text style={styles.label}>Eco-Score:</Text>
                        <View
                            style={[
                                styles.ecoBadge,
                                { backgroundColor: getEcoScoreColor(item.prediction?.ecoScore) },
                            ]}
                        >
                            <Text style={styles.ecoText}>
                                {item.prediction?.ecoScore?.toUpperCase() ?? 'N/A'}
                            </Text>
                        </View>
                    </View>

                    {/* Packaging */}
                    {item.prediction?.packaging?.length ? (
                        <Text style={styles.packaging}>
                            Packaging:{' '}
                            {Array.isArray(item.prediction.packaging)
                                ? item.prediction.packaging.join(', ')
                                : item.prediction.packaging}
                        </Text>
                    ) : null}
                </View>
            </View>

            {/* Greener Alternative Section */}
            <View style={styles.altContainer}>
                <Text style={styles.altTitle}>Greener Alternative</Text>

                {item.greenerAlternative ? (
                    <View style={styles.row}>
                        {item.greenerAlternative.imageUrl ? (
                            <Image
                                source={{ uri: item.greenerAlternative.imageUrl }}
                                style={styles.altImage}
                                resizeMode="cover"
                            />
                        ) : (
                            <View style={[styles.altImage, styles.altImagePlaceholder]}>
                                <Text style={{ color: '#888' }}>No Image</Text>
                            </View>
                        )}

                        <View style={styles.altInfo}>
                            {/* Removed Brand line here */}

                            {/* Eco-Score with padding above */}
                            <View style={[styles.ecoRow, { marginTop: 8 }]}>
                                <Text style={styles.label}>Eco-Score:</Text>
                                <View
                                    style={[
                                        styles.ecoBadge,
                                        {
                                            backgroundColor: getEcoScoreColor(
                                                item.greenerAlternative.ecoScore
                                            ),
                                        },
                                    ]}
                                >
                                    <Text style={styles.ecoText}>
                                        {item.greenerAlternative.ecoScore?.toUpperCase() ?? 'N/A'}
                                    </Text>
                                </View>
                            </View>

                            <Text style={styles.packaging}>
                                Packaging: {item.greenerAlternative.packaging ?? 'Unknown'}
                            </Text>
                        </View>
                    </View>
                ) : (
                    <Text style={styles.noAlternative}>No greener alternative found.</Text>
                )}
            </View>
        </View>
    );



    if (loading) {
        return (
            <View style={styles.loading}>
                <ActivityIndicator size="large" color="#2C5B3F" />
                <Text style={styles.loadingText}>Loading your scans...</Text>
            </View>
        );
    }

    if (error) {
        return (
            <View style={styles.loading}>
                <Text style={[styles.loadingText, { color: 'red' }]}>{error}</Text>
            </View>
        );
    }

    if (scans.length === 0) {
        return (
            <View style={styles.empty}>
                <Text style={styles.emptyText}>No scans found yet.</Text>
                <Text style={styles.emptySubtext}>Start scanning products to see your history!</Text>
            </View>
        );
    }

    return (
        <FlatList
            ListHeaderComponent={<Text style={styles.title}>Your Scan History</Text>}
            data={scans}
            keyExtractor={(item, index) => `${item.scanId ?? index}`}
            renderItem={renderItem}
            contentContainerStyle={styles.container}
            showsVerticalScrollIndicator={false}
        />
    );
}

const styles = StyleSheet.create({
    container: {
        padding: 16,
        backgroundColor: '#f5f5f5',
    },
    title: {
        fontSize: 24,
        fontWeight: 'bold',
        color: '#2C5B3F',
        textAlign: 'center',
        marginBottom: 20,
    },
    card: {
        backgroundColor: 'white',
        borderRadius: 12,
        padding: 16,
        marginBottom: 16,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 4,
        elevation: 3,
    },
    row: {
        flexDirection: 'row',
        alignItems: 'flex-start',
    },
    productImage: {
        width: 80,
        height: 80,
        borderRadius: 8,
        marginRight: 12,
        backgroundColor: '#f0f0f0',
    },
    info: {
        flex: 1,
    },
    ecoRow: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 4,
    },
    label: {
        fontSize: 14,
        color: '#666',
        marginRight: 8,
    },
    ecoBadge: {
        paddingHorizontal: 8,
        paddingVertical: 2,
        borderRadius: 12,
        minWidth: 30,
        alignItems: 'center',
    },
    ecoText: {
        color: 'white',
        fontSize: 12,
        fontWeight: 'bold',
    },
    packaging: {
        fontSize: 12,
        color: '#666',
        marginTop: 4,
    },
    altContainer: {
        marginTop: 16,
        paddingTop: 16,
        borderTopWidth: 1,
        borderTopColor: '#eee',
    },
    altTitle: {
        fontSize: 14,
        fontWeight: 'bold',
        color: '#4CAF50',
        marginBottom: 8,
    },
    altImage: {
        width: 60,
        height: 60,
        borderRadius: 8,
        marginRight: 12,
        backgroundColor: '#f0f0f0',
    },
    altImagePlaceholder: {
        justifyContent: 'center',
        alignItems: 'center',
    },
    altInfo: {
        flex: 1,
    },
    altBrand: {
        fontSize: 14,
        fontWeight: '600',
        color: '#333',
        marginBottom: 4,
    },
    noAlternative: {
        fontSize: 14,
        color: '#888',
        fontStyle: 'italic',
        textAlign: 'center',
        paddingVertical: 8,
    },
    loading: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: '#f5f5f5',
    },
    loadingText: {
        marginTop: 12,
        fontSize: 16,
        color: '#666',
    },
    empty: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: '#f5f5f5',
        padding: 32,
    },
    emptyText: {
        fontSize: 18,
        fontWeight: 'bold',
        color: '#666',
        textAlign: 'center',
        marginBottom: 8,
    },
    emptySubtext: {
        fontSize: 14,
        color: '#888',
        textAlign: 'center',
    },
    sectionTitle: {
        fontSize: 15,
        fontWeight: 'bold',
        color: '#2C5B3F',
        marginBottom: 8,
    },

});
