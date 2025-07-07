import {
    MaterialIcons
} from '@expo/vector-icons';
import { ref as dbRef, onValue } from 'firebase/database';
import React, { useEffect, useState } from 'react';
import {
    Dimensions,
    Image,
    Modal,
    RefreshControl,
    SafeAreaView,
    ScrollView,
    StatusBar,
    StyleSheet,
    Text,
    TouchableOpacity,
    View
} from 'react-native';
import { auth, database } from '../firebaseConfig';

const { width, height } = Dimensions.get('window');

const PACKAGING_CATEGORIES = [
    { name: 'Plastic', icon: 'local-drink', color: '#FF5722' },
    { name: 'Glass', icon: 'local-bar', color: '#4CAF50' },
    { name: 'Cardboard', icon: 'inventory', color: '#FF9800' },
    { name: 'Metal', icon: 'build-circle', color: '#9C27B0' },
    { name: 'Paper', icon: 'description', color: '#2196F3' },
    { name: 'Other', icon: 'category', color: '#607D8B' },
];

const ECOSCORE_DESCRIPTIONS = {
    'A+': {
        title: 'Exceptional',
        description: 'This product has the lowest environmental impact. It uses sustainable materials, minimal packaging, and eco-friendly production methods.',
        tips: 'Perfect choice for environmentally conscious consumers!'
    },
    'A': {
        title: 'Excellent',
        description: 'Very low environmental impact with sustainable practices in production and packaging.',
        tips: 'Great eco-friendly option with minimal environmental footprint.'
    },
    'B': {
        title: 'Good',
        description: 'Good environmental performance with some sustainable practices implemented.',
        tips: 'A solid choice that balances quality with environmental responsibility.'
    },
    'C': {
        title: 'Moderate',
        description: 'Average environmental impact. Some efforts toward sustainability but room for improvement.',
        tips: 'Consider looking for better alternatives when possible.'
    },
    'D': {
        title: 'Poor',
        description: 'Higher environmental impact with limited sustainable practices.',
        tips: 'Try to find more eco-friendly alternatives for regular use.'
    },
    'E': {
        title: 'Very Poor',
        description: 'Significant environmental impact with minimal consideration for sustainability.',
        tips: 'Consider switching to more sustainable alternatives.'
    },
    'F': {
        title: 'Severe',
        description: 'Highest environmental impact with poor sustainability practices.',
        tips: 'Strongly recommend finding eco-friendly alternatives.'
    },
};

const BADGES = [
    {
        id: 'eco_starter',
        name: 'Eco Starter',
        icon: 'eco',
        color: '#4CAF50',
        description: 'Made your first sustainable choice!',
        requirement: 1, // 1% or higher
        type: 'rate'
    },
    {
        id: 'green_warrior',
        name: 'Green Warrior',
        icon: 'shield',
        color: '#2E7D32',
        description: 'Maintaining 25% sustainable choices',
        requirement: 25,
        type: 'rate'
    },
    {
        id: 'eco_champion',
        name: 'Eco Champion',
        icon: 'star',
        color: '#1B5E20',
        description: 'Achieving 50% sustainable choices',
        requirement: 50,
        type: 'rate'
    },
    {
        id: 'planet_guardian',
        name: 'Planet Guardian',
        icon: 'public',
        color: '#0D47A1',
        description: 'Maintaining 75% sustainable choices',
        requirement: 75,
        type: 'rate'
    },
    {
        id: 'eco_master',
        name: 'Eco Master',
        icon: 'military_tech',
        color: '#FF6F00',
        description: 'Achieving 90% sustainable choices',
        requirement: 90,
        type: 'rate'
    },
    {
        id: 'product_explorer',
        name: 'Product Explorer',
        icon: 'explore',
        color: '#FF5722',
        description: 'Scanned 50 products',
        requirement: 50,
        type: 'scan_count'
    },
    {
        id: 'data_collector',
        name: 'Data Collector',
        icon: 'analytics',
        color: '#795548',
        description: 'Scanned 100 products',
        requirement: 100,
        type: 'scan_count'
    }
];

const HomeScreen: React.FC = () => {
    const [scanCount, setScanCount] = useState(0);
    const [alternativeCount, setAlternativeCount] = useState(0);
    const [scans, setScans] = useState<any[]>([]);
    const [refreshing, setRefreshing] = useState(false);
    const [userName, setUserName] = useState('User');
    const [ecoScoreModalVisible, setEcoScoreModalVisible] = useState(false);
    const [selectedEcoScore, setSelectedEcoScore] = useState<string | null>(null);
    const [badgeModalVisible, setBadgeModalVisible] = useState(false);
    const [selectedBadge, setSelectedBadge] = useState<any>(null);
    const [earnedBadges, setEarnedBadges] = useState<any[]>([]);

    useEffect(() => {
        const user = auth.currentUser;
        if (!user) return;

        // Set user name from email or display name
        if (user.displayName) {
            setUserName(user.displayName);
        } else if (user.email) {
            setUserName(user.email.split('@')[0]);
        }

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

            // Calculate earned badges
            const greenChoiceRate = entries.length > 0 ? Math.round((alternatives.length / entries.length) * 100) : 0;
            const newEarnedBadges = BADGES.filter(badge => {
                if (badge.type === 'rate') {
                    return greenChoiceRate >= badge.requirement;
                } else if (badge.type === 'scan_count') {
                    return entries.length >= badge.requirement;
                }
                return false;
            });
            setEarnedBadges(newEarnedBadges);
        });

        return () => unsubscribe();
    }, []);

    const onRefresh = React.useCallback(() => {
        setRefreshing(true);
        setTimeout(() => {
            setRefreshing(false);
        }, 2000);
    }, []);

    const handleLogout = () => {
        auth.signOut().catch((error) => {
            console.error('Logout error:', error);
        });
    };

    const getGreeting = () => {
        const hour = new Date().getHours();
        if (hour < 12) return 'Good Morning';
        if (hour < 17) return 'Good Afternoon';
        return 'Good Evening';
    };

    const getEcoScoreColor = (grade: string) => {
        const colors = {
            'A+': '#1B5E20', 'A': '#2E7D32', 'B': '#558B2F',
            'C': '#F9A825', 'D': '#EF6C00', 'E': '#D84315', 'F': '#B71C1C'
        };
        return colors[grade as keyof typeof colors] || '#9E9E9E';
    };

    const handleEcoScorePress = (grade: string) => {
        setSelectedEcoScore(grade);
        setEcoScoreModalVisible(true);
    };

    const handleBadgePress = (badge: any) => {
        setSelectedBadge(badge);
        setBadgeModalVisible(true);
    };

    const packagingCategoryCount = PACKAGING_CATEGORIES.map(category => ({
        ...category,
        count: scans.filter(scan => {
            const packagingList = scan?.prediction?.packaging || scan?.prediction?.packaging_en || [];
            const packagingArray = Array.isArray(packagingList)
                ? packagingList.map((p: string) => p.toLowerCase())
                : [packagingList.toLowerCase()];
            return packagingArray.some((p: string) => p.includes(category.name.toLowerCase()));
        }).length
    }));

    const renderEcoScoreModal = () => {
        const ecoScoreData = selectedEcoScore ? ECOSCORE_DESCRIPTIONS[selectedEcoScore as keyof typeof ECOSCORE_DESCRIPTIONS] : null;

        return (
            <Modal
                animationType="slide"
                transparent={true}
                visible={ecoScoreModalVisible}
                onRequestClose={() => setEcoScoreModalVisible(false)}
            >
                <View style={styles.modalOverlay}>
                    <View style={styles.modalContent}>
                        <View style={styles.modalHeader}>
                            <View style={[styles.modalGradeCircle, { backgroundColor: getEcoScoreColor(selectedEcoScore || '') }]}>
                                <Text style={styles.modalGradeText}>{selectedEcoScore}</Text>
                            </View>
                            <TouchableOpacity
                                style={styles.closeButton}
                                onPress={() => setEcoScoreModalVisible(false)}
                            >
                                <MaterialIcons name="close" size={24} color="#757575" />
                            </TouchableOpacity>
                        </View>

                        {ecoScoreData && (
                            <>
                                <Text style={styles.modalTitle}>EcoScore {selectedEcoScore}: {ecoScoreData.title}</Text>
                                <Text style={styles.modalDescription}>{ecoScoreData.description}</Text>
                                <View style={styles.modalTipContainer}>
                                    <MaterialIcons name="lightbulb" size={20} color="#FF9800" />
                                    <Text style={styles.modalTip}>{ecoScoreData.tips}</Text>
                                </View>
                            </>
                        )}

                        <TouchableOpacity
                            style={styles.modalButton}
                            onPress={() => setEcoScoreModalVisible(false)}
                        >
                            <Text style={styles.modalButtonText}>Got it!</Text>
                        </TouchableOpacity>
                    </View>
                </View>
            </Modal>
        );
    };

    const renderBadgeModal = () => {
        return (
            <Modal
                animationType="slide"
                transparent={true}
                visible={badgeModalVisible}
                onRequestClose={() => setBadgeModalVisible(false)}
            >
                <View style={styles.modalOverlay}>
                    <View style={styles.modalContent}>
                        <View style={styles.modalHeader}>
                            <View style={[styles.modalBadgeContainer, { backgroundColor: selectedBadge?.color }]}>
                                <MaterialIcons name={selectedBadge?.icon as any} size={32} color="white" />
                            </View>
                            <TouchableOpacity
                                style={styles.closeButton}
                                onPress={() => setBadgeModalVisible(false)}
                            >
                                <MaterialIcons name="close" size={24} color="#757575" />
                            </TouchableOpacity>
                        </View>

                        {selectedBadge && (
                            <>
                                <Text style={styles.modalTitle}>{selectedBadge.name}</Text>
                                <Text style={styles.modalDescription}>{selectedBadge.description}</Text>
                                <View style={styles.modalTipContainer}>
                                    <MaterialIcons name="celebration" size={20} color="#FF9800" />
                                    <Text style={styles.modalTip}>
                                        {selectedBadge.type === 'rate'
                                            ? `You've maintained ${selectedBadge.requirement}% sustainable choices!`
                                            : `You've scanned ${selectedBadge.requirement} products!`
                                        }
                                    </Text>
                                </View>
                            </>
                        )}

                        <TouchableOpacity
                            style={styles.modalButton}
                            onPress={() => setBadgeModalVisible(false)}
                        >
                            <Text style={styles.modalButtonText}>Awesome!</Text>
                        </TouchableOpacity>
                    </View>
                </View>
            </Modal>
        );
    };

    return (
        <SafeAreaView style={styles.safe}>
            <StatusBar barStyle="light-content" backgroundColor="#2E7D32" />
            <ScrollView
                contentContainerStyle={styles.container}
                refreshControl={
                    <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
                }
                showsVerticalScrollIndicator={false}
            >
                {/* Header Section */}
                <View style={styles.headerContainer}>
                    <View style={styles.header}>
                        <View style={styles.row}>
                            <View style={styles.avatarContainer}>
                                <Image
                                    source={require('../assets/profile.png')}
                                    style={styles.avatar}
                                />
                                <View style={styles.statusIndicator} />
                            </View>
                            <View style={styles.greetingContainer}>
                                <Text style={styles.greetingText}>{getGreeting()}</Text>
                                <Text style={styles.nameText}>{userName}</Text>
                                <Text style={styles.subtitleText}>Let's make sustainable choices</Text>
                            </View>
                        </View>

                        <TouchableOpacity style={styles.logoutButton} onPress={handleLogout}>
                            <MaterialIcons name="logout" size={24} color="white" />
                        </TouchableOpacity>
                    </View>
                </View>

                {/* Quick Stats Section */}
                <View style={styles.statsSection}>
                    <Text style={styles.sectionTitle}>Your Impact Overview</Text>
                    <View style={styles.statRow}>
                        <View style={[styles.statBox, { backgroundColor: '#4CAF50' }]}>
                            <MaterialIcons name="analytics" size={32} color="white" />
                            <Text style={styles.statNumber}>{scanCount}</Text>
                            <Text style={styles.statLabel}>Products{'\n'}Analyzed</Text>
                        </View>
                        <View style={[styles.statBox, { backgroundColor: '#2E7D32' }]}>
                            <MaterialIcons name="eco" size={32} color="white" />
                            <Text style={styles.statNumber}>{alternativeCount}</Text>
                            <Text style={styles.statLabel}>Green{'\n'}Alternatives</Text>
                        </View>
                        <View style={[styles.statBox, { backgroundColor: '#FF9800' }]}>
                            <MaterialIcons name="trending-up" size={32} color="white" />
                            <Text style={styles.statNumber}>{scanCount > 0 ? Math.round((alternativeCount / scanCount) * 100) : 0}%</Text>
                            <Text style={styles.statLabel}>Green{'\n'}Choices</Text>
                        </View>
                    </View>
                </View>

                {/* Badges Section */}
                {earnedBadges.length > 0 && (
                    <View style={styles.badgesSection}>
                        <Text style={styles.sectionTitle}>Your Achievements</Text>
                        <Text style={styles.sectionSubtitle}>Badges earned from your sustainable choices</Text>
                        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.badgesList}>
                            {earnedBadges.map((badge) => (
                                <TouchableOpacity
                                    key={badge.id}
                                    style={styles.badgeCard}
                                    onPress={() => handleBadgePress(badge)}
                                >
                                    <View style={[styles.badgeIconContainer, { backgroundColor: badge.color }]}>
                                        <MaterialIcons name={badge.icon as any} size={24} color="white" />
                                    </View>
                                    <Text style={styles.badgeName}>{badge.name}</Text>
                                </TouchableOpacity>
                            ))}
                        </ScrollView>
                    </View>
                )}

                {/* Packaging Categories Section */}
                <View style={styles.categoriesSection}>
                    <Text style={styles.sectionTitle}>Packaging Categories</Text>
                    <Text style={styles.sectionSubtitle}>Your scanned products by packaging type</Text>
                    <View style={styles.packagingCategoryGrid}>
                        {packagingCategoryCount.map((category) => (
                            <View
                                key={category.name}
                                style={styles.categoryCard}
                            >
                                <View style={[styles.categoryIconContainer, { backgroundColor: category.color }]}>
                                    <MaterialIcons name={category.icon as any} size={24} color="white" />
                                </View>
                                <Text style={styles.categoryName}>
                                    {category.name}
                                </Text>
                                <Text style={styles.categoryCount}>
                                    {category.count} items
                                </Text>
                            </View>
                        ))}
                    </View>
                </View>

                {/* EcoScore Guide Section */}
                <View style={styles.ecoScoreSection}>
                    <Text style={styles.sectionTitle}>EcoScore Guide</Text>
                    <Text style={styles.sectionSubtitle}>Understanding environmental impact ratings (tap for details)</Text>
                    <View style={styles.ecoScoreGrid}>
                        {[
                            { grade: 'A+', description: 'Exceptional', color: '#1B5E20' },
                            { grade: 'A', description: 'Excellent', color: '#2E7D32' },
                            { grade: 'B', description: 'Good', color: '#558B2F' },
                            { grade: 'C', description: 'Moderate', color: '#F9A825' },
                            { grade: 'D', description: 'Poor', color: '#EF6C00' },
                            { grade: 'E', description: 'Very Poor', color: '#D84315' },
                            { grade: 'F', description: 'Severe', color: '#B71C1C' },
                        ].map((item) => (
                            <TouchableOpacity
                                key={item.grade}
                                style={styles.ecoScoreItem}
                                onPress={() => handleEcoScorePress(item.grade)}
                            >
                                <View style={[styles.gradeCircle, { backgroundColor: item.color }]}>
                                    <Text style={styles.gradeText}>{item.grade}</Text>
                                </View>
                                <Text style={styles.gradeDescription}>{item.description}</Text>
                            </TouchableOpacity>
                        ))}
                    </View>
                </View>
            </ScrollView>

            {/* EcoScore Modal */}
            {renderEcoScoreModal()}

            {/* Badge Modal */}
            {renderBadgeModal()}
        </SafeAreaView>
    );
};

const styles = StyleSheet.create({
    safe: {
        flex: 1,
        backgroundColor: '#F5F5F5',
    },
    container: {
        paddingBottom: 20,
    },
    headerContainer: {
        backgroundColor: '#2E7D32',
        paddingBottom: 20,
        borderBottomLeftRadius: 24,
        borderBottomRightRadius: 24,
        marginBottom: 20,
    },
    header: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingHorizontal: 20,
        paddingTop: 20,
    },
    row: {
        flexDirection: 'row',
        alignItems: 'center',
        flex: 1,
    },
    avatarContainer: {
        position: 'relative',
    },
    avatar: {
        width: 60,
        height: 60,
        borderRadius: 30,
        borderWidth: 3,
        borderColor: 'white',
    },
    statusIndicator: {
        position: 'absolute',
        bottom: 2,
        right: 2,
        width: 16,
        height: 16,
        borderRadius: 8,
        backgroundColor: '#4CAF50',
        borderWidth: 2,
        borderColor: 'white',
    },
    greetingContainer: {
        marginLeft: 16,
        flex: 1,
    },
    greetingText: {
        fontSize: 16,
        color: 'rgba(255, 255, 255, 0.8)',
    },
    nameText: {
        fontSize: 20,
        fontWeight: 'bold',
        color: 'white',
        marginTop: 2,
    },
    subtitleText: {
        fontSize: 14,
        color: 'rgba(255, 255, 255, 0.7)',
        marginTop: 2,
    },
    logoutButton: {
        backgroundColor: 'rgba(255, 255, 255, 0.2)',
        borderRadius: 12,
        padding: 12,
    },
    statsSection: {
        paddingHorizontal: 20,
        marginBottom: 24,
    },
    sectionTitle: {
        fontSize: 20,
        fontWeight: 'bold',
        color: '#2E7D32',
        marginBottom: 8,
    },
    sectionSubtitle: {
        fontSize: 14,
        color: '#757575',
        marginBottom: 16,
    },
    statRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        gap: 12,
    },
    statBox: {
        flex: 1,
        padding: 16,
        borderRadius: 16,
        alignItems: 'center',
        justifyContent: 'center',
        elevation: 4,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 4,
    },
    statNumber: {
        fontSize: 24,
        color: 'white',
        fontWeight: 'bold',
        marginTop: 8,
    },
    statLabel: {
        fontSize: 12,
        color: 'white',
        textAlign: 'center',
        marginTop: 4,
    },
    categoriesSection: {
        paddingHorizontal: 20,
        marginBottom: 24,
    },
    packagingCategoryGrid: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        justifyContent: 'space-between',
        gap: 12,
    },
    categoryCard: {
        width: (width - 56) / 2,
        backgroundColor: 'white',
        borderRadius: 16,
        padding: 16,
        alignItems: 'center',
        elevation: 2,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.1,
        shadowRadius: 2,
        borderWidth: 1,
        borderColor: '#E0E0E0',
    },
    categoryIconContainer: {
        width: 48,
        height: 48,
        borderRadius: 24,
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: 12,
    },
    categoryName: {
        fontSize: 16,
        fontWeight: '600',
        color: '#333',
        marginBottom: 4,
    },
    categoryCount: {
        fontSize: 12,
        color: '#757575',
    },
    ecoScoreSection: {
        paddingHorizontal: 20,
    },
    ecoScoreGrid: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        justifyContent: 'space-between',
        gap: 12,
    },
    ecoScoreItem: {
        width: (width - 56) / 2,
        backgroundColor: 'white',
        borderRadius: 12,
        padding: 16,
        alignItems: 'center',
        elevation: 1,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.05,
        shadowRadius: 1,
    },
    gradeCircle: {
        width: 40,
        height: 40,
        borderRadius: 20,
        justifyContent: 'center',
        alignItems: 'center',
        marginBottom: 8,
    },
    gradeText: {
        color: 'white',
        fontWeight: 'bold',
        fontSize: 14,
    },
    gradeDescription: {
        fontSize: 12,
        color: '#757575',
        textAlign: 'center',
    },
    // Modal Styles
    modalOverlay: {
        flex: 1,
        backgroundColor: 'rgba(0, 0, 0, 0.5)',
        justifyContent: 'center',
        alignItems: 'center',
        paddingHorizontal: 20,
    },
    modalContent: {
        backgroundColor: 'white',
        borderRadius: 20,
        padding: 24,
        width: '100%',
        maxWidth: 400,
        elevation: 5,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.25,
        shadowRadius: 4,
    },
    modalHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 20,
    },
    modalGradeCircle: {
        width: 60,
        height: 60,
        borderRadius: 30,
        justifyContent: 'center',
        alignItems: 'center',
    },
    modalGradeText: {
        color: 'white',
        fontWeight: 'bold',
        fontSize: 18,
    },
    closeButton: {
        padding: 8,
    },
    modalTitle: {
        fontSize: 20,
        fontWeight: 'bold',
        color: '#333',
        marginBottom: 12,
        textAlign: 'center',
    },
    modalDescription: {
        fontSize: 16,
        color: '#666',
        lineHeight: 24,
        marginBottom: 16,
        textAlign: 'center',
    },
    modalTipContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#FFF3E0',
        padding: 12,
        borderRadius: 12,
        marginBottom: 24,
    },
    modalTip: {
        fontSize: 14,
        color: '#E65100',
        marginLeft: 8,
        flex: 1,
    },
    modalButton: {
        backgroundColor: '#2E7D32',
        borderRadius: 12,
        paddingVertical: 12,
        alignItems: 'center',
    },
    modalButtonText: {
        color: 'white',
        fontSize: 16,
        fontWeight: '600',
    },
    // Badge Styles
    badgesSection: {
        paddingHorizontal: 20,
        marginBottom: 24,
    },
    badgesList: {
        paddingVertical: 8,
    },
    badgeCard: {
        backgroundColor: 'white',
        borderRadius: 16,
        padding: 16,
        alignItems: 'center',
        marginRight: 12,
        width: 120,
        elevation: 2,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.1,
        shadowRadius: 2,
    },
    badgeIconContainer: {
        width: 56,
        height: 56,
        borderRadius: 28,
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: 12,
    },
    badgeName: {
        fontSize: 14,
        fontWeight: '600',
        color: '#333',
        textAlign: 'center',
    },
    modalBadgeContainer: {
        width: 80,
        height: 80,
        borderRadius: 40,
        justifyContent: 'center',
        alignItems: 'center',
    },
});

export default HomeScreen;