import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";
import { getStorage } from "firebase/storage";

const firebaseConfig = {
  apiKey: "AIzaSyA8UXGGhzY9Ahj3ch-M6JYk-4jpNLhieQY",
  authDomain: "phoda-01.firebaseapp.com",
  projectId: "phoda-01",
  storageBucket: "phoda-01.firebasestorage.app",
  messagingSenderId: "131388489529",
  appId: "1:131388489529:web:25f3014cd77daf1d3332e8",
  measurementId: "G-Q8E9FWBL5R"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
const storage = getStorage(app);

export { app, auth, db, storage };