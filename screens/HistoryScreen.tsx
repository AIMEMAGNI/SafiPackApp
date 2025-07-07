// HistoryScreen.tsx
import { ref as dbRef, off, onValue } from 'firebase/database';
import React, { useEffect, useState } from 'react';
import {
    ActivityIndicator,
    FlatList,
    Image,
    StyleSheet,
    Text,
    View
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
    timestamp: number | object; // timestamp can be serverTimestamp placeholder
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
            // Convert object to array and sort by timestamp descending
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

        return () => {
            off(scansRef, 'value', handleValue);
        };
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
            <Image
                source={{ uri: item.productImageUrl }}
                style={styles.productImage}
                resizeMode="cover"
            />
            <View style={styles.info}>
                <Text style={styles.category}>{item.prediction.category ?? 'Unknown'}</Text>
                <View style={styles.ecoRow}>
                    <Text>Eco-Score:</Text>
                    <View style={[styles.ecoBadge, { backgroundColor: getEcoScoreColor(item.prediction.ecoScore) }]}>
                        <Text style={styles.ecoText}>{item.prediction.ecoScore?.toUpperCase() ?? 'N/A'}</Text>
                    </View>
                </View>
                {item.prediction.packaging && item.prediction.packaging.length > 0 && (
                    <Text>Packaging: {item.prediction.packaging.join(', ')}</Text>
                )}
            </View>

            {item.greenerAlternative && (
                <View style={styles.altContainer}>
                    <Text style={styles.altTitle}>Better Alternative</Text>
                    <Text>Brand: {item.greenerAlternative.brand ?? 'N/A'}</Text>
                    <View style={styles.ecoRow}>
                        <Text>Eco-Score:</Text>
                        <View style={[styles.ecoBadge, { backgroundColor: getEcoScoreColor(item.greenerAlternative.ecoScore) }]}>
                            <Text style={styles.ecoText}>{item.greenerAlternative.ecoScore?.toUpperCase() ?? 'N/A'}</Text>
                        </View>
                    </View>
                    <Text>Packaging: {item.greenerAlternative.packaging ?? 'Unknown'}</Text>
                    {item.greenerAlternative.imageUrl && (
                        <Image
                            source={{ uri: item.greenerAlternative.imageUrl }}
                            style={styles.altImage}
                            resizeMode="cover"
                        />
                    )}
                </View>
            )}
        </View>
    );

    if (loading) {
        return (
            <View style={styles.loading}>
                <ActivityIndicator size="large" color="#000" />
                <Text>Loading your scans...</Text>
            </View>
        );
    }

    if (scans.length === 0) {
        return (
            <View style={styles.empty}>
                <Text>No scans found yet.</Text>
            </View>
        );
    }

    return (
        <FlatList
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
    },
    card: {
        borderRadius: 10,
        backgroundColor: '#f0f0f0',
        marginBottom: 20,
        padding: 15,
    },
    productImage: {
        width: '100%',
        height: 220,
        borderRadius: 10,
        marginBottom: 12,
    },
    info: {
        marginBottom: 12,
    },
    category: {
        fontWeight: 'bold',
        fontSize: 16,
        marginBottom: 6,
    },
    ecoRow: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 6,
    },
    ecoBadge: {
        marginLeft: 8,
        paddingHorizontal: 8,
        paddingVertical: 3,
        borderRadius: 12,
    },
    ecoText: {
        color: 'white',
        fontWeight: 'bold',
        fontSize: 12,
    },
    altContainer: {
        borderTopWidth: 1,
        borderTopColor: '#ccc',
        paddingTop: 12,
    },
    altTitle: {
        fontWeight: 'bold',
        fontSize: 15,
        marginBottom: 6,
    },
    altImage: {
        width: '100%',
        height: 180,
        marginTop: 10,
        borderRadius: 10,
    },
    loading: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
    },
    empty: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
    },
});
