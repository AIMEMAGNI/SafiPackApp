import Ionicons from 'react-native-vector-icons/Ionicons';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { NavigationContainer } from '@react-navigation/native';
import React from 'react';
import HistoryScreen from '../screens/HistoryScreen';
import HomeScreen from '../screens/HomeScreen';
import ScanScreen from '../screens/ScanScreen';

const Tab = createBottomTabNavigator();

export default function MainNavigation() {
    return (
        <NavigationContainer>
            <Tab.Navigator
                screenOptions={({ route }) => ({
                    headerShown: false,
                    tabBarIcon: ({ color, size }) => {
                        let iconName: string;

                        if (route.name === 'Home') iconName = 'home-outline';
                        else if (route.name === 'Scan') iconName = 'camera-outline';
                        else iconName = 'time-outline';

                        return <Ionicons name={iconName} size={size} color={color} />;
                    },
                })}
            >
                <Tab.Screen name="Home" component={HomeScreen} />
                <Tab.Screen name="Scan" component={ScanScreen} />
                <Tab.Screen name="History" component={HistoryScreen} />
            </Tab.Navigator>
        </NavigationContainer>
    );
}
