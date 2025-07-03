import {
    createUserWithEmailAndPassword,
    signInWithEmailAndPassword,
} from 'firebase/auth';
import React, { useState } from 'react';
import { Alert, Button, TextInput, View } from 'react-native';
import { auth } from '../firebaseConfig';

export default function AuthScreen({ navigation }: any) {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');

    const handleLogin = async () => {
        try {
            await signInWithEmailAndPassword(auth, email, password);
        } catch (err: any) {
            Alert.alert('Login Error', err.message || 'An error occurred while logging in.');
        }
    };

    const handleSignup = async () => {
        try {
            await createUserWithEmailAndPassword(auth, email, password);
            Alert.alert('Signup Success!');
        } catch (err: any) {
            Alert.alert('Signup Error', err.message || 'An error occurred while signing up.');
        }
    };

    return (
        <View style={{ flex: 1, justifyContent: 'center', padding: 20 }}>
            <TextInput
                placeholder="Email"
                value={email}
                onChangeText={setEmail}
                autoCapitalize="none"
                keyboardType="email-address"
                style={{ borderBottomWidth: 1, marginBottom: 12 }}
            />
            <TextInput
                placeholder="Password"
                value={password}
                onChangeText={setPassword}
                secureTextEntry
                style={{ borderBottomWidth: 1, marginBottom: 20 }}
            />
            <Button title="Login" onPress={handleLogin} />
            <View style={{ height: 10 }} />
            <Button title="Sign Up" onPress={handleSignup} />
        </View>
    );
}
