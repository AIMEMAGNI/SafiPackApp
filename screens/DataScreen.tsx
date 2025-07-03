import { onValue, ref, set } from 'firebase/database';
import React, { useEffect, useState } from 'react';
import { Button, Text, TextInput, View } from 'react-native';
import { auth, database } from '../firebaseConfig';

export default function DataScreen() {
    const [text, setText] = useState('');
    const [savedText, setSavedText] = useState('');

    const saveData = async () => {
        const uid = auth.currentUser?.uid;
        if (!uid) return;

        await set(ref(database, 'users/' + uid), {
            note: text,
        });
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
        <View style={{ padding: 20 }}>
            <TextInput
                placeholder="Write a note"
                value={text}
                onChangeText={setText}
                style={{ borderWidth: 1, marginBottom: 10 }}
            />
            <Button title="Save" onPress={saveData} />
            <Text style={{ marginTop: 20 }}>Saved Note: {savedText}</Text>
        </View>
    );
}
