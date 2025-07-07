import { FirebaseApp, getApps, initializeApp } from 'firebase/app';
import { Auth, getAuth } from 'firebase/auth';
import { getDatabase } from 'firebase/database';
import { getStorage } from 'firebase/storage'; // ✅ Import this

const firebaseConfig = {
    apiKey: 'AIzaSyAAzy39CO0gVceTEKYiPA0KGJg2bgFOpWY',
    authDomain: 'greenchoice-b61c0.firebaseapp.com',
    projectId: 'greenchoice-b61c0',
    storageBucket: 'greenchoice-b61c0.firebasestorage.app', // ✅ Corrected from `.firebasestorage.app`
    messagingSenderId: '527994459698',
    appId: '1:527994459698:android:74299a917ab972eb7c4e2b',
    databaseURL: 'https://greenchoice-b61c0-default-rtdb.firebaseio.com/',
};

let app: FirebaseApp;
if (getApps().length === 0) {
    app = initializeApp(firebaseConfig);
} else {
    app = getApps()[0];
}

const auth: Auth = getAuth(app);
const database = getDatabase(app);
const storage = getStorage(app); // ✅ Initialize storage

// ✅ Export storage so you can use it to upload/download files
export { auth, database, storage };
export default app;
