import {
    MaterialIcons
} from '@expo/vector-icons';
import { ref as dbRef, onValue } from 'firebase/database';
import React, { useEffect, useState } from 'react';
import {
    Image,
    SafeAreaView,
    ScrollView,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
} from 'react-native';
import { auth, database } from '../firebaseConfig';

const PACKAGING_CATEGORIES = [
    'Plastic',
    'Glass',
    'Cardboard',
    'Metal',
    'Paper',
    'Other',
];

const HomeScreen: React.FC = () => {
    const [scanCount, setScanCount] = useState(0);
    const [alternativeCount, setAlternativeCount] = useState(0);
    const [scans, setScans] = useState<any[]>([]);
    const [selectedCategory, setSelectedCategory] = useState<string | null>(null);

    useEffect(() => {
        const user = auth.currentUser;
        if (!user) return;

        const userScansRef = dbRef(database, `scans/${user.uid}`);

        const unsubscribe = onValue(userScansRef, (snapshot) => {
            const data = snapshot.val();
            if (!data) {
                setScanCount(0);
                setAlternativeCount(0);
                setScans([]);
                return;
            }

            const entries = Object.values(data);
            setScanCount(entries.length);

            const alternatives = entries.filter((item: any) => item.preferred === 'alternative');

            setAlternativeCount(alternatives.length);

            setScans(entries);
        });

        return () => unsubscribe();
    }, []);

    // Filter scans based on selected packaging category
    const filteredScans = selectedCategory
        ? scans.filter(scan => {
            const packagingList = scan?.prediction?.packaging || scan?.prediction?.packaging_en || [];
            const packagingArray = Array.isArray(packagingList)
                ? packagingList.map((p: string) => p.toLowerCase())
                : [packagingList.toLowerCase()];
            return packagingArray.some((p: string) => p.includes(selectedCategory.toLowerCase()));
        })
        : [];

    const handleLogout = () => {
        auth.signOut().catch((error) => {
            console.error('Logout error:', error);
        });
    };

    return (
        <SafeAreaView style={styles.safe}>
            <ScrollView contentContainerStyle={styles.container}>
                {/* Header Row */}
                <View style={styles.header}>
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

                    <TouchableOpacity onPress={handleLogout}>
                        <MaterialIcons name="logout" size={24} color="#D32F2F" />
                    </TouchableOpacity>
                </View>

                {/* Stats Row */}
                <View style={styles.statRow}>
                    <View style={[styles.statBox, { backgroundColor: '#6D4C41' }]}>
                        <Text style={styles.statNumber}>{scanCount}</Text>
                        <Text style={styles.statLabel}>Products{'\n'}Analysed</Text>
                    </View>
                    <View style={[styles.statBox, { backgroundColor: '#2E7D32' }]}>
                        <Text style={styles.statNumber}>{alternativeCount}</Text>
                        <Text style={styles.statLabel}>Green{'\n'}Alternatives</Text>
                    </View>
                </View>

                {/* Packaging Categories */}
                <Text style={styles.sectionTitle}>Packaging Categories</Text>
                <View style={styles.packagingCategoryRow}>
                    {PACKAGING_CATEGORIES.map((category) => (
                        <TouchableOpacity
                            key={category}
                            style={[
                                styles.categoryButton,
                                selectedCategory === category && styles.categoryButtonSelected,
                            ]}
                            onPress={() =>
                                setSelectedCategory(selectedCategory === category ? null : category)
                            }
                        >
                            <Text
                                style={[
                                    styles.categoryButtonText,
                                    selectedCategory === category && styles.categoryButtonTextSelected,
                                ]}
                            >
                                {category}
                            </Text>
                        </TouchableOpacity>
                    ))}
                </View>

                {/* Filtered Scans */}
                {selectedCategory && (
                    <>
                        <Text style={[styles.sectionTitle, { marginTop: 20 }]}>
                            Scans with packaging: {selectedCategory}
                        </Text>
                        {filteredScans.length === 0 ? (
                            <Text style={styles.noScansText}>No scans found in this category.</Text>
                        ) : (
                            filteredScans.map((scan: any, index: number) => (
                                <View key={index} style={styles.scanCard}>
                                    {scan.imageUrl && (
                                        <Image source={{ uri: scan.imageUrl }} style={styles.scanImage} />
                                    )}
                                    <View style={{ flex: 1, marginLeft: 10 }}>
                                        <Text style={styles.scanText}>
                                            Category: {scan.prediction?.main_category_en || 'Unknown'}
                                        </Text>
                                        <Text style={styles.scanText}>
                                            Eco-Score: {scan.prediction?.environmental_score_grade || 'N/A'}
                                        </Text>
                                        <Text style={styles.scanText}>
                                            Packaging: {Array.isArray(scan.prediction?.packaging_en)
                                                ? scan.prediction.packaging_en.join(', ')
                                                : scan.prediction.packaging_en || 'Unknown'}
                                        </Text>
                                    </View>
                                </View>
                            ))
                        )}
                    </>
                )}

                {/* EcoScore Grades Section */}
                <Text style={styles.sectionTitle}>EcoScore Grades Explained</Text>
                <View style={styles.ecoScoreInfoContainer}>
                    {[
                        {
                            grade: 'A+',
                            description: 'Exceptional environmental performance. Made from sustainable materials with minimal emissions and high recyclability.',
                            color: '#1B5E20',
                        },
                        {
                            grade: 'A',
                            description: 'Excellent sustainability. Low environmental impact throughout production and disposal.',
                            color: '#2E7D32',
                        },
                        {
                            grade: 'B',
                            description: 'Good performance. Slight environmental impact, often using partially recycled or renewable materials.',
                            color: '#558B2F',
                        },
                        {
                            grade: 'C',
                            description: 'Moderate impact. Mix of sustainable and non-sustainable materials. Room for improvement.',
                            color: '#F9A825',
                        },
                        {
                            grade: 'D',
                            description: 'Significant impact. Often made from single-use or hard-to-recycle materials.',
                            color: '#EF6C00',
                        },
                        {
                            grade: 'E',
                            description: 'High environmental burden. Poor recyclability and non-renewable resource use.',
                            color: '#D84315',
                        },
                        {
                            grade: 'F',
                            description: 'Severe environmental damage. Non-sustainable production and major pollution risk.',
                            color: '#B71C1C',
                        },
                    ].map((item) => (
                        <View key={item.grade} style={styles.ecoScoreCard}>
                            <View style={[styles.gradeCircle, { backgroundColor: item.color }]}>
                                <Text style={styles.gradeText}>{item.grade}</Text>
                            </View>
                            <Text style={styles.gradeDescription}>{item.description}</Text>
                        </View>
                    ))}
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
    header: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 10,
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
    packagingCategoryRow: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        justifyContent: 'space-between',
        marginVertical: 10,
    },
    categoryButton: {
        borderWidth: 1,
        borderColor: '#2E7D32',
        borderRadius: 20,
        paddingVertical: 8,
        paddingHorizontal: 15,
        marginVertical: 6,
        width: '30%',
        alignItems: 'center',
        backgroundColor: 'white',
    },
    categoryButtonSelected: {
        backgroundColor: '#2E7D32',
    },
    categoryButtonText: {
        color: '#2E7D32',
        fontWeight: '600',
    },
    categoryButtonTextSelected: {
        color: 'white',
    },
    scanCard: {
        flexDirection: 'row',
        backgroundColor: '#f0f0f0',
        borderRadius: 12,
        padding: 10,
        marginTop: 10,
        alignItems: 'center',
    },
    scanImage: {
        width: 70,
        height: 70,
        borderRadius: 10,
    },
    scanText: {
        fontSize: 14,
        color: '#333',
        marginBottom: 4,
    },
    noScansText: {
        marginTop: 10,
        fontSize: 14,
        fontStyle: 'italic',
        color: 'gray',
        textAlign: 'center',
    },
    ecoScoreInfoContainer: {
        marginTop: 10,
        gap: 12,
    },
    ecoScoreCard: {
        flexDirection: 'row',
        alignItems: 'flex-start',
        backgroundColor: '#f9f9f9',
        padding: 12,
        borderRadius: 10,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.1,
        shadowRadius: 2,
        elevation: 1,
    },
    gradeCircle: {
        width: 40,
        height: 40,
        borderRadius: 20,
        justifyContent: 'center',
        alignItems: 'center',
        marginRight: 12,
    },
    gradeText: {
        color: 'white',
        fontWeight: 'bold',
        fontSize: 16,
    },
    gradeDescription: {
        flex: 1,
        fontSize: 14,
        color: '#333',
        lineHeight: 18,
    },
});

export default HomeScreen;
