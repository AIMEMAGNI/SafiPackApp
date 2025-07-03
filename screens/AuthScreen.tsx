import {
    createUserWithEmailAndPassword,
    sendPasswordResetEmail,
    signInAnonymously,
    signInWithEmailAndPassword,
} from 'firebase/auth';
import React, { useState } from 'react';
import {
    ActivityIndicator,
    Alert,
    Button,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    View,
} from 'react-native';
import { auth } from '../firebaseConfig';

export default function AuthScreen() {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [loading, setLoading] = useState(false);

    const validateInputs = (): boolean => {
        if (!email && !password) {
            Alert.alert('Validation Error', 'Please enter email and password.');
            return false;
        }
        if (!email) {
            Alert.alert('Validation Error', 'Please enter your email.');
            return false;
        }
        if (!password) {
            Alert.alert('Validation Error', 'Please enter your password.');
            return false;
        }
        return true;
    };

    const handleLogin = async () => {
        if (!validateInputs()) return;
        setLoading(true);
        try {
            await signInWithEmailAndPassword(auth, email, password);
        } catch (err: any) {
            Alert.alert('Login Error', err.message || 'Login failed.');
        } finally {
            setLoading(false);
        }
    };

    const handleSignup = async () => {
        if (!validateInputs()) return;
        setLoading(true);
        try {
            await createUserWithEmailAndPassword(auth, email, password);
            Alert.alert('Signup Success', 'Your account has been created!');
        } catch (err: any) {
            Alert.alert('Signup Error', err.message || 'Signup failed.');
        } finally {
            setLoading(false);
        }
    };

    const handlePasswordReset = async () => {
        if (!email) {
            Alert.alert('Reset Password', 'Please enter your email to reset password.');
            return;
        }
        setLoading(true);
        try {
            await sendPasswordResetEmail(auth, email);
            Alert.alert(
                'Password Reset',
                'Password reset email sent! Please check your inbox.'
            );
        } catch (err: any) {
            Alert.alert('Reset Error', err.message || 'Failed to send reset email.');
        } finally {
            setLoading(false);
        }
    };

    const handleGuestLogin = async () => {
        setLoading(true);
        try {
            await signInAnonymously(auth);
        } catch (err: any) {
            Alert.alert('Guest Login Error', err.message || 'Failed to login as guest.');
        } finally {
            setLoading(false);
        }
    };

    return (
        <View style={styles.container}>
            <TextInput
                placeholder="Email"
                value={email}
                onChangeText={setEmail}
                autoCapitalize="none"
                keyboardType="email-address"
                style={styles.input}
            />
            <TextInput
                placeholder="Password"
                value={password}
                onChangeText={setPassword}
                secureTextEntry
                style={styles.input}
            />

            {loading ? (
                <ActivityIndicator size="large" color="#000" style={{ marginVertical: 20 }} />
            ) : (
                <>
                    <Button title="Login" onPress={handleLogin} />
                    <View style={{ height: 10 }} />
                    <Button title="Sign Up" onPress={handleSignup} />
                    <View style={{ height: 10 }} />
                    <Button title="Continue as Guest" onPress={handleGuestLogin} />
                    <TouchableOpacity onPress={handlePasswordReset} style={{ marginTop: 15 }}>
                        <Text style={styles.forgotText}>Forgot Password?</Text>
                    </TouchableOpacity>
                </>
            )}
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        justifyContent: 'center',
        padding: 20,
    },
    input: {
        borderBottomWidth: 1,
        marginBottom: 20,
        paddingVertical: 8,
        fontSize: 16,
    },
    forgotText: {
        color: '#1565C0',
        textAlign: 'center',
        textDecorationLine: 'underline',
    },
});
