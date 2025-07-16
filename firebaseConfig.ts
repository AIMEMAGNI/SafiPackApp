import AsyncStorage from '@react-native-async-storage/async-storage';
import { FirebaseApp, getApps, initializeApp } from 'firebase/app';
import { Auth, getAuth, initializeAuth } from 'firebase/auth';
import { getDatabase } from 'firebase/database';
import { getStorage } from 'firebase/storage';

// Import with proper error handling
let getReactNativePersistence: any;
try {
  const authReactNative = require('firebase/auth/react-native');
  getReactNativePersistence = authReactNative.getReactNativePersistence;
} catch (error) {
  console.log('React Native persistence not available, using default persistence');
}

const firebaseConfig = {
  apiKey: 'AIzaSyAAzy39CO0gVceTEKYiPA0KGJg2bgFOpWY',
  authDomain: 'greenchoice-b61c0.firebaseapp.com',
  projectId: 'greenchoice-b61c0',
  storageBucket: 'greenchoice-b61c0.firebasestorage.app',
  messagingSenderId: '527994459698',
  appId: '1:527994459698:android:74299a917ab972eb7c4e2b',
  databaseURL: 'https://greenchoice-b61c0-default-rtdb.firebaseio.com/',
};

// Initialize Firebase App
let app: FirebaseApp;
if (getApps().length === 0) {
  app = initializeApp(firebaseConfig);
} else {
  app = getApps()[0];
}

// Initialize Auth with proper error handling
let auth: Auth;
try {
  if (getReactNativePersistence) {
    auth = initializeAuth(app, {
      persistence: getReactNativePersistence(AsyncStorage)
    });
  } else {
    auth = getAuth(app);
  }
} catch (error) {
  console.log('Error initializing auth with persistence:', error);
  auth = getAuth(app);
}

// Initialize other Firebase services
const database = getDatabase(app);
const storage = getStorage(app);

export { auth, database, storage };
export default app;