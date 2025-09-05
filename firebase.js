// firebase.js
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.4.0/firebase-app.js";
import { getAnalytics } from "https://www.gstatic.com/firebasejs/10.4.0/firebase-analytics.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/10.4.0/firebase-auth.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/10.4.0/firebase-firestore.js";

// Firebase Config
const firebaseConfig = {
  apiKey: "AIzaSyAyIVMDstj2KWRvj1cHv0x0JCMVRWMteAw",
  authDomain: "graduateinhunt.firebaseapp.com",
  projectId: "graduateinhunt",
  storageBucket: "graduateinhunt.appspot.com",  // ✅ fixed
  messagingSenderId: "49490866745",
  appId: "1:49490866745:web:df722a8a68eae051cb53e8",
  measurementId: "G-2L0JMXNT2Y"
};

// Init Firebase
const app = initializeApp(firebaseConfig);
const analytics = getAnalytics(app);
const auth = getAuth(app);
const db = getFirestore(app);

export { app, analytics, auth, db };
