import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import NetInfo from '@react-native-community/netinfo';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { NavigationContainer } from '@react-navigation/native';
import { onAuthStateChanged, User } from 'firebase/auth';
import React, { useEffect, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';

import { auth } from './firebaseConfig';
import AuthScreen from './screens/AuthScreen';
import HistoryScreen from './screens/HistoryScreen';
import HomeScreen from './screens/HomeScreen';
import ScanScreen from './screens/ScanScreen';

const Tab = createBottomTabNavigator();

export default function App() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [isConnected, setIsConnected] = useState(true);

  useEffect(() => {
    const unsubscribeNetInfo = NetInfo.addEventListener(state => {
      setIsConnected(
        state.isConnected === true && state.isInternetReachable !== false
      );


    });

    const unsubscribeAuth = onAuthStateChanged(auth, async (currentUser) => {
      try {
        if (currentUser) {
          const token = await currentUser.getIdToken();
          await AsyncStorage.setItem('firebase_user_token', token);
        } else {
          await AsyncStorage.removeItem('firebase_user_token');
        }
      } catch (err) {
        console.warn('Error with token persistence:', err);
      }

      setTimeout(() => {
        setUser(currentUser);
        setLoading(false);
      }, 500);
    });

    return () => {
      unsubscribeNetInfo();
      unsubscribeAuth();
    };
  }, []);

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color="#2C5B3F" />
      </View>
    );
  }

  if (!isConnected) {
    return (
      <View style={styles.offlineContainer}>
        <Ionicons name="wifi-outline" size={60} color="#2C5B3F" />
        <Text style={styles.offlineTitle}>No Internet Connection</Text>
        <Text style={styles.offlineSubtitle}>
          Please check your internet connection{'\n'}to continue using the app.
        </Text>
      </View>
    );
  }


  if (!user) {
    return <AuthScreen />;
  }

  return (
    <NavigationContainer>
      <Tab.Navigator
        screenOptions={({ route }) => ({
          headerShown: false,
          tabBarIcon: ({ color, size }) => {
            let iconName: keyof typeof Ionicons.glyphMap;
            if (route.name === 'Home') iconName = 'home-outline';
            else if (route.name === 'Scan') iconName = 'camera-outline';
            else iconName = 'time-outline';
            return <Ionicons name={iconName} size={size} color={color} />;
          },
          tabBarActiveTintColor: '#2C5B3F',
          tabBarInactiveTintColor: 'gray',
        })}
      >
        <Tab.Screen name="Home" component={HomeScreen} />
        <Tab.Screen name="Scan" component={ScanScreen} />
        <Tab.Screen name="History" component={HistoryScreen} />
      </Tab.Navigator>
    </NavigationContainer>
  );
}

const styles = StyleSheet.create({
  center: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  offlineContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 30,
    backgroundColor: '#F9F9F9',
  },
  offlineTitle: {
    fontSize: 22,
    fontWeight: '600',
    marginTop: 20,
    color: '#2C5B3F',
  },
  offlineSubtitle: {
    fontSize: 16,
    color: '#555',
    textAlign: 'center',
    marginTop: 10,
    lineHeight: 22,
  },
});

