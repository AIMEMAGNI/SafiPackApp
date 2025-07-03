// firebaseConfig.ts
import firebase from 'firebase/compat/app';
import 'firebase/compat/auth';
import 'firebase/compat/database';

const firebaseConfig = {
    apiKey: 'AIzaSyAAzy39CO0gVceTEKYiPA0KGJg2bgFOpWY',
    authDomain: 'greenchoice-b61c0.firebaseapp.com',
    projectId: 'greenchoice-b61c0',
    storageBucket: 'greenchoice-b61c0.appspot.com',
    messagingSenderId: '527994459698',
    appId: '1:527994459698:android:74299a917ab972eb7c4e2b',
    databaseURL: 'https://greenchoice-b61c0-default-rtdb.firebaseio.com/',
};

// Initialize Firebase once
if (!firebase.apps.length) {
    firebase.initializeApp(firebaseConfig);
}

export const auth = firebase.auth();
export const database = firebase.database();
