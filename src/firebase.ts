/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { initializeApp } from 'firebase/app';
import { getAuth, GoogleAuthProvider, signInWithPopup } from 'firebase/auth';
import { initializeFirestore } from 'firebase/firestore';
const firebaseConfig = {
  apiKey: "AIzaSyBLydwKVZ33a-RFs8PabQ2CORvtesN0-kk",
  authDomain: "gen-lang-client-0416482575.firebaseapp.com",
  projectId: "gen-lang-client-0416482575",
  storageBucket: "gen-lang-client-0416482575.firebasestorage.app",
  messagingSenderId: "271783787368",
  appId: "1:271783787368:web:006817e62e173b259234dd"
};

const app = initializeApp(firebaseConfig);
export const db = initializeFirestore(app, {
  experimentalForceLongPolling: true,
});
export const auth = getAuth(app);
export const googleProvider = new GoogleAuthProvider();

export const signIn = () => signInWithPopup(auth, googleProvider);
export const signOut = () => auth.signOut();
