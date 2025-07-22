// firebaseConfig.ts
import { initializeApp, getApps } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getDatabase } from 'firebase/database';
import { getStorage } from 'firebase/storage';

const firebaseConfig = {
  apiKey: 'AIzaSyAAzy39CO0gVceTEKYiPA0KGJg2bgFOpWY',
  authDomain: 'greenchoice-b61c0.firebaseapp.com',
  projectId: 'greenchoice-b61c0',
  storageBucket: 'greenchoice-b61c0.firebasestorage.app', // ✅ untouched
  messagingSenderId: '527994459698',
  appId: '1:527994459698:android:74299a917ab972eb7c4e2b',
  databaseURL: 'https://greenchoice-b61c0-default-rtdb.firebaseio.com/',
};

const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApps()[0];

const auth = getAuth(app);
const database = getDatabase(app);
const storage = getStorage(app);

export { auth, database, storage };
