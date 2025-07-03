import { onValue, ref, set } from 'firebase/database';
import React, { useEffect, useState } from 'react';
import { Alert, Button, StyleSheet, Text, TextInput, View } from 'react-native';
import { auth, database } from '../firebaseConfig';

export default function DataScreen() {
    const [text, setText] = useState('');
    const [savedText, setSavedText] = useState('');
    const [loading, setLoading] = useState(false);

    const saveData = async () => {
        if (!text.trim()) {
            Alert.alert('Validation', 'Please enter some text before saving.');
            return;
        }

        const uid = auth.currentUser?.uid;
        if (!uid) {
            Alert.alert('Error', 'User not authenticated.');
            return;
        }

        setLoading(true);
        try {
            await set(ref(database, 'users/' + uid), { note: text });
            Alert.alert('Success', 'Note saved successfully!');
        } catch (error: any) {
            Alert.alert('Error', error.message || 'Failed to save note.');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        const uid = auth.currentUser?.uid;
        if (!uid) return;

        const userRef = ref(database, 'users/' + uid);
        const unsub = onValue(userRef, (snapshot) => {
            const data = snapshot.val();
            setSavedText(data?.note ?? '');
        });

        return () => unsub();
    }, []);

    return (
        <View style={styles.container}>
            <TextInput
                placeholder="Write a note"
                value={text}
                onChangeText={setText}
                style={styles.input}
                multiline
                editable={!loading}
            />
            <Button title={loading ? 'Saving...' : 'Save'} onPress={saveData} disabled={loading} />
            <Text style={styles.savedText}>Saved Note:</Text>
            <Text style={styles.savedNote}>{savedText || 'No note saved yet.'}</Text>
        </View>
    );
}

const styles = StyleSheet.create({
    container: { padding: 20, flex: 1, backgroundColor: 'white' },
    input: {
        borderWidth: 1,
        borderColor: '#ccc',
        padding: 10,
        minHeight: 80,
        marginBottom: 15,
        borderRadius: 6,
        textAlignVertical: 'top',
    },
    savedText: {
        marginTop: 20,
        fontWeight: 'bold',
        fontSize: 16,
    },
    savedNote: {
        marginTop: 5,
        fontSize: 14,
        color: '#555',
    },
});
