import React from 'react';
import { Alert, Button, StyleSheet, Text, View } from 'react-native';

export default function ScanScreen() {
    return (
        <View style={styles.container}>
            <Text style={styles.text}>Scan Page</Text>
            <Button title="Scan Product" onPress={() => Alert.alert("Scan feature coming!")} />
        </View>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, justifyContent: 'center', alignItems: 'center' },
    text: { fontSize: 24, marginBottom: 20 }
});
