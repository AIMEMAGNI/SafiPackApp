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
    productImageUrl: string;
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
    timestamp: number | object;
    [key: string]: any;
};

export default function HistoryScreen() {
    const [scans, setScans] = useState<ScanRecord[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const userId = auth.currentUser?.uid;
        if (!userId) {
            setLoading(false);
            return;
        }

        const scansRef = dbRef(database, `scans/${userId}`);

        const handleValue = (snapshot: any) => {
            const data = snapshot.val();
            if (!data) {
                setScans([]);
                setLoading(false);
                return;
            }
            const scansArray = Object.values(data) as ScanRecord[];
            scansArray.sort((a, b) => {
                const timeA = typeof a.timestamp === 'object' ? 0 : a.timestamp;
                const timeB = typeof b.timestamp === 'object' ? 0 : b.timestamp;
                return timeB - timeA;
            });
            setScans(scansArray);
            setLoading(false);
        };

        onValue(scansRef, handleValue);
        return () => off(scansRef, 'value', handleValue);
    }, []);

    const getEcoScoreColor = (score: string) => {
        const grade = score?.toLowerCase();
        if (grade === 'a-plus' || grade === 'a' || grade === 'b') return '#4CAF50';
        if (grade === 'c' || grade === 'd') return '#FF9800';
        if (grade === 'e' || grade === 'f') return '#F44336';
        return '#9E9E9E';
    };

    const renderItem = ({ item }: { item: ScanRecord }) => (
        <View style={styles.card}>
            <View style={styles.row}>
                <Image
                    source={{ uri: item.productImageUrl }}
                    style={styles.productImage}
                    resizeMode="cover"
                />
                <View style={styles.info}>
                    <Text style={styles.category}>{item.prediction.category ?? 'Unknown'}</Text>
                    <View style={styles.ecoRow}>
                        <Text style={styles.label}>Eco-Score:</Text>
                        <View style={[styles.ecoBadge, { backgroundColor: getEcoScoreColor(item.prediction.ecoScore) }]}>
                            <Text style={styles.ecoText}>{item.prediction.ecoScore?.toUpperCase() ?? 'N/A'}</Text>
                        </View>
                    </View>
                    {item.prediction.packaging?.length > 0 && (
                        <Text style={styles.packaging}>Packaging: {item.prediction.packaging.join(', ')}</Text>
                    )}
                </View>
            </View>

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
                            <Text style={styles.altBrand}>Brand: {item.greenerAlternative.brand ?? 'N/A'}</Text>
                            <View style={styles.ecoRow}>
                                <Text style={styles.label}>Eco-Score:</Text>
                                <View style={[styles.ecoBadge, { backgroundColor: getEcoScoreColor(item.greenerAlternative.ecoScore) }]}>
                                    <Text style={styles.ecoText}>{item.greenerAlternative.ecoScore?.toUpperCase() ?? 'N/A'}</Text>
                                </View>
                            </View>
                            <Text style={styles.packaging}>Packaging: {item.greenerAlternative.packaging ?? 'Unknown'}</Text>
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

    if (scans.length === 0) {
        return (
            <View style={styles.empty}>
                <Text style={styles.emptyText}>No scans found yet.</Text>
            </View>
        );
    }

    return (
        <FlatList
            ListHeaderComponent={
                <Text style={styles.title}>Your Scan History</Text>
            }
            data={scans}
            keyExtractor={(_, index) => index.toString()}
            renderItem={renderItem}
            contentContainerStyle={styles.container}
            showsVerticalScrollIndicator={false}
        />
    );
}

const styles = StyleSheet.create({
    container: {
        padding: 15,
        backgroundColor: 'white',
        paddingBottom: 30,
    },
    title: {
        fontSize: 22,
        fontWeight: 'bold',
        color: '#2C5B3F',
        marginBottom: 20,
        textAlign: 'center',
    },
    card: {
        borderRadius: 12,
        backgroundColor: '#F9FBF8',
        marginBottom: 22,
        padding: 18,
        borderWidth: 1,
        borderColor: '#D6EADF',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.1,
        shadowRadius: 4,
        elevation: 3,
    },
    row: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    productImage: {
        width: 100,
        height: 100,
        borderRadius: 12,
        marginRight: 15,
        backgroundColor: '#E2EAE3',
    },
    info: {
        flex: 1,
    },
    category: {
        fontWeight: '700',
        fontSize: 18,
        marginBottom: 8,
        color: '#2C5B3F',
    },
    ecoRow: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 6,
    },
    label: {
        fontSize: 14,
        color: '#555',
        fontWeight: '600',
    },
    ecoBadge: {
        marginLeft: 8,
        paddingHorizontal: 10,
        paddingVertical: 4,
        borderRadius: 15,
    },
    ecoText: {
        color: 'white',
        fontWeight: 'bold',
        fontSize: 13,
    },
    packaging: {
        fontSize: 14,
        color: '#444',
        marginTop: 4,
    },
    altContainer: {
        marginTop: 16,
        paddingTop: 14,
        borderTopWidth: 1,
        borderTopColor: '#C7D8CE',
    },
    altTitle: {
        fontWeight: '700',
        fontSize: 16,
        marginBottom: 10,
        color: '#2C5B3F',
    },
    altImage: {
        width: 90,
        height: 90,
        borderRadius: 10,
        marginRight: 15,
        backgroundColor: '#E2EAE3',
    },
    altImagePlaceholder: {
        justifyContent: 'center',
        alignItems: 'center',
    },
    altInfo: {
        flex: 1,
    },
    altBrand: {
        fontWeight: '600',
        fontSize: 15,
        marginBottom: 6,
        color: '#3A563A',
    },
    noAlternative: {
        fontStyle: 'italic',
        color: '#777',
        fontSize: 14,
        marginTop: 4,
    },
    loading: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: 'white',
    },
    loadingText: {
        marginTop: 12,
        color: '#2C5B3F',
        fontSize: 16,
        fontWeight: '600',
    },
    empty: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: 'white',
        paddingHorizontal: 20,
    },
    
    emptyText: {
        fontSize: 16,
        color: '#2C5B3F',
        fontWeight: '600',
        textAlign: 'center',
    },
});
