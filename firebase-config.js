// Import the functions you need from the SDKs you need
import { initializeApp } from "firebase/app";
import { getAnalytics } from "firebase/analytics";
// TODO: Add SDKs for Firebase products that you want to use
// https://firebase.google.com/docs/web/setup#available-libraries

// Your web app's Firebase configuration
// For Firebase JS SDK v7.20.0 and later, measurementId is optional
const firebaseConfig = {
  apiKey: "AIzaSyAyIVMDstj2KWRvj1cHv0x0JCMVRWMteAw",
  authDomain: "graduateinhunt.firebaseapp.com",
  projectId: "graduateinhunt",
  storageBucket: "graduateinhunt.firebasestorage.app",
  messagingSenderId: "49490866745",
  appId: "1:49490866745:web:af75f8ab6fc4adf3cb53e8",
  measurementId: "G-NWW2QREMM7"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const analytics = getAnalytics(app);