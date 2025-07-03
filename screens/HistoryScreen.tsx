import React, { useState } from 'react';
import { FlatList, StyleSheet, Text, View } from 'react-native';

type ScanItem = {
    id: string;
    date: string;
    result: string;
};

export default function HistoryScreen() {
    // Mock scanned data, you can replace with real fetched data later
    const [scannedItems, setScannedItems] = useState<ScanItem[]>([
        {
            id: '1',
            date: '2025-06-28 10:15',
            result: 'Eco-friendly cardboard packaging',
        },
        {
            id: '2',
            date: '2025-06-27 15:40',
            result: 'Plastic wrapper - non-recyclable',
        },
        {
            id: '3',
            date: '2025-06-26 09:20',
            result: 'Glass bottle - recyclable',
        },
    ]);

    // You can replace above with real data fetching from local DB or API here

    const renderItem = ({ item }: { item: ScanItem }) => (
        <View style={styles.itemContainer}>
            <Text style={styles.dateText}>{item.date}</Text>
            <Text style={styles.resultText}>{item.result}</Text>
        </View>
    );

    return (
        <View style={styles.container}>
            {scannedItems.length === 0 ? (
                <Text style={styles.emptyText}>No scanned items yet.</Text>
            ) : (
                <FlatList
                    data={scannedItems}
                    keyExtractor={(item) => item.id}
                    renderItem={renderItem}
                    contentContainerStyle={styles.listContent}
                />
            )}
        </View>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, padding: 20, backgroundColor: 'white' },
    listContent: { paddingBottom: 20 },
    itemContainer: {
        backgroundColor: '#f1f1f1',
        padding: 15,
        marginBottom: 12,
        borderRadius: 10,
    },
    dateText: {
        fontSize: 12,
        color: '#666',
        marginBottom: 6,
    },
    resultText: {
        fontSize: 16,
        fontWeight: '600',
    },
    emptyText: {
        textAlign: 'center',
        marginTop: 40,
        fontSize: 18,
        color: '#999',
    },
});
