import { initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";
import { getStorage } from "firebase/storage";
import { getAuth } from "firebase/auth";

const firebaseConfig = {
  apiKey: "AIzaSyDuzAKfy5ZrBjz3bOe0xlR_pwQGHLjYB2E",
  authDomain: "shufactory-cmd-1.firebaseapp.com",
  projectId: "shufactory-cmd-1",
  storageBucket: "shufactory-cmd-1.firebasestorage.app",
  messagingSenderId: "792288358750",
  appId: "1:792288358750:web:e5baa1d04bfa548ba91fcf"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
export const db = getFirestore(app);
export const storage = getStorage(app);
export const auth = getAuth(app);
