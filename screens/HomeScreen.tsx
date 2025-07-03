import {
    MaterialCommunityIcons,
    MaterialIcons,
} from '@expo/vector-icons';
import React from 'react';
import {
    Button,
    Image,
    SafeAreaView,
    ScrollView,
    StyleSheet,
    Text,
    View,
} from 'react-native';
import { auth } from '../firebaseConfig';

const HomeScreen: React.FC = () => {
    return (
        <SafeAreaView style={styles.safe}>
            <ScrollView contentContainerStyle={styles.container}>
                {/* Welcome Row */}
                <View style={styles.row}>
                    <Image
                        source={require('../assets/profile.png')}
                        style={styles.avatar}
                    />
                    <View style={{ marginLeft: 10 }}>
                        <Text style={styles.welcomeText}>Welcome,</Text>
                        <Text style={styles.nameText}>User</Text>
                    </View>
                </View>

                {/* Stats Row */}
                <View style={styles.statRow}>
                    <View style={[styles.statBox, { backgroundColor: '#6D4C41' }]}>
                        <Text style={styles.statNumber}>65</Text>
                        <Text style={styles.statLabel}>Products{'\n'}Analysed</Text>
                    </View>
                    <View style={[styles.statBox, { backgroundColor: '#2E7D32' }]}>
                        <Text style={styles.statNumber}>20</Text>
                        <Text style={styles.statLabel}>Green{'\n'}Alternatives</Text>
                    </View>
                </View>

                {/* Categories */}
                <Text style={styles.sectionTitle}>Packaging Categories</Text>
                <View style={styles.iconRow}>
                    <MaterialIcons name="eco" size={40} color="black" />
                    <MaterialIcons name="person" size={40} color="black" />
                    <MaterialIcons name="restaurant" size={40} color="black" />
                    <MaterialCommunityIcons name="tree" size={40} color="black" />
                </View>

                {/* Recent Uploads */}
                <Text style={styles.sectionTitle}>Recent Uploads</Text>
                <View style={styles.uploadRow}>
                    <View style={[styles.uploadCard, { backgroundColor: '#2E7D32CC' }]}>
                        <Image
                            source={require('../assets/lime.jpg')}
                            style={styles.uploadImage}
                        />
                        <View style={styles.dateOverlay}>
                            <Text style={styles.uploadDate}>15 Sep</Text>
                        </View>
                    </View>
                    <View style={[styles.uploadCard, { backgroundColor: '#1565C0CC' }]}>
                        <Image
                            source={require('../assets/orange.png')}
                            style={styles.uploadImage}
                        />
                        <View style={styles.dateOverlay}>
                            <Text style={styles.uploadDate}>02 Sep</Text>
                        </View>
                    </View>
                </View>

                {/* Logout */}
                <View style={{ marginTop: 30 }}>
                    <Button title="Logout" color="#D32F2F" onPress={() => auth.signOut()} />
                </View>
            </ScrollView>
        </SafeAreaView>
    );
};

const styles = StyleSheet.create({
    safe: {
        flex: 1,
        backgroundColor: 'white',
    },
    container: {
        padding: 20,
    },
    row: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    avatar: {
        width: 50,
        height: 50,
        borderRadius: 25,
    },
    welcomeText: {
        fontSize: 16,
        color: 'gray',
    },
    nameText: {
        fontSize: 18,
        fontWeight: 'bold',
    },
    statRow: {
        flexDirection: 'row',
        marginTop: 20,
        justifyContent: 'space-between',
    },
    statBox: {
        flex: 0.48,
        padding: 16,
        borderRadius: 16,
        alignItems: 'center',
        justifyContent: 'center',
    },
    statNumber: {
        fontSize: 22,
        color: 'white',
        fontWeight: 'bold',
    },
    statLabel: {
        fontSize: 14,
        color: 'white',
        textAlign: 'center',
    },
    sectionTitle: {
        marginTop: 20,
        fontSize: 16,
        fontWeight: 'bold',
    },
    iconRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        marginVertical: 10,
    },
    uploadRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        marginTop: 10,
    },
    uploadCard: {
        flex: 0.48,
        height: 100,
        borderRadius: 16,
        overflow: 'hidden',
        position: 'relative',
    },
    uploadImage: {
        ...StyleSheet.absoluteFillObject,
        resizeMode: 'cover',
        opacity: 0.5,
    },
    dateOverlay: {
        position: 'absolute',
        bottom: 8,
        left: 8,
    },
    uploadDate: {
        color: 'white',
        fontWeight: 'bold',
    },
});

export default HomeScreen;
