import {
    createUserWithEmailAndPassword,
    EmailAuthProvider,
    linkWithCredential,
    sendPasswordResetEmail,
    signInAnonymously,
    signInWithEmailAndPassword,
    updateProfile,
} from 'firebase/auth';
import React, { useState } from 'react';
import {
    ActivityIndicator,
    Alert,
    KeyboardAvoidingView,
    Platform,
    ScrollView,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity
} from 'react-native';
import { auth } from '../firebaseConfig';

export default function AuthScreen() {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [username, setUsername] = useState('');
    const [loading, setLoading] = useState(false);

    const validateInputs = (includeUsername = false): boolean => {
        if (includeUsername && !username.trim()) {
            Alert.alert('Validation Error', 'Please enter a username.');
            return false;
        }
        if (!email.trim() || !password.trim()) {
            Alert.alert('Validation Error', 'Please enter email and password.');
            return false;
        }
        return true;
    };

    const handleLogin = async () => {
        if (!validateInputs()) return;
        setLoading(true);
        try {
            await signInWithEmailAndPassword(auth, email.trim(), password);
        } catch (err: any) {
            Alert.alert('Login Error', err.message || 'Login failed.');
        } finally {
            setLoading(false);
        }
    };

    const handleSignup = async () => {
        if (!validateInputs(true)) return;
        setLoading(true);
        try {
            const currentUser = auth.currentUser;
            if (currentUser && currentUser.isAnonymous) {
                const credential = EmailAuthProvider.credential(email.trim(), password);
                await linkWithCredential(currentUser, credential);
                await updateProfile(currentUser, { displayName: username.trim() });
                Alert.alert('Success', 'Guest account converted to full account!');
            } else {
                const userCredential = await createUserWithEmailAndPassword(auth, email.trim(), password);
                await updateProfile(userCredential.user, { displayName: username.trim() });
                Alert.alert('Signup Success', 'Account created successfully!');
            }
        } catch (err: any) {
            Alert.alert('Signup Error', err.message || 'Signup failed.');
        } finally {
            setLoading(false);
        }
    };

    const handlePasswordReset = async () => {
        if (!email.trim()) {
            Alert.alert('Reset Password', 'Please enter your email.');
            return;
        }
        setLoading(true);
        try {
            await sendPasswordResetEmail(auth, email.trim());
            Alert.alert('Email Sent', 'Please check your inbox.');
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
            Alert.alert('Guest Login Error', err.message || 'Guest login failed.');
        } finally {
            setLoading(false);
        }
    };

    return (
        <KeyboardAvoidingView
            style={{ flex: 1 }}
            behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        >
            <ScrollView
                contentContainerStyle={styles.container}
                keyboardShouldPersistTaps="handled"
            >
                <Text style={styles.title}>Welcome</Text>

                <TextInput
                    placeholder="Username (for signup)"
                    value={username}
                    onChangeText={setUsername}
                    autoCapitalize="words"
                    style={styles.input}
                />
                <TextInput
                    placeholder="Email"
                    value={email}
                    onChangeText={setEmail}
                    keyboardType="email-address"
                    autoCapitalize="none"
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
                    <ActivityIndicator size="large" color="#2C5B3F" style={{ marginVertical: 20 }} />
                ) : (
                    <>
                        <TouchableOpacity style={styles.button} onPress={handleLogin}>
                            <Text style={styles.buttonText}>Login</Text>
                        </TouchableOpacity>

                        <TouchableOpacity style={styles.button} onPress={handleSignup}>
                            <Text style={styles.buttonText}>Sign Up</Text>
                        </TouchableOpacity>

                        <TouchableOpacity style={styles.button} onPress={handleGuestLogin}>
                            <Text style={styles.buttonText}>Continue as Guest</Text>
                        </TouchableOpacity>

                        <TouchableOpacity onPress={handlePasswordReset}>
                            <Text style={styles.forgotText}>Forgot Password?</Text>
                        </TouchableOpacity>
                    </>
                )}
            </ScrollView>
        </KeyboardAvoidingView>
    );
}

const styles = StyleSheet.create({
    container: {
        flexGrow: 1,
        justifyContent: 'center',
        padding: 20,
        backgroundColor: '#fff',
    },
    title: {
        fontSize: 26,
        fontWeight: '600',
        textAlign: 'center',
        marginBottom: 30,
        color: '#2C5B3F',
    },
    input: {
        borderBottomWidth: 1,
        borderColor: '#A1B5AB', // Softened green-tinted border
        marginBottom: 20,
        paddingVertical: 10,
        fontSize: 16,
    },
    button: {
        backgroundColor: '#2C5B3F',
        paddingVertical: 14,
        borderRadius: 8,
        marginBottom: 15,
    },
    buttonText: {
        color: '#fff',
        textAlign: 'center',
        fontSize: 16,
        fontWeight: '600',
    },
    forgotText: {
        color: '#2C5B3F',
        textAlign: 'center',
        marginTop: 15,
        textDecorationLine: 'underline',
        fontSize: 14,
    },
});

