import { initializeApp } from "https://www.gstatic.com/firebasejs/9.6.1/firebase-app.js";
import { getFirestore, collection, query, where, orderBy, onSnapshot } from "https://www.gstatic.com/firebasejs/9.6.1/firebase-firestore.js";

// ---------------- FIREBASE CONFIG ----------------
const firebaseConfig = {
  apiKey: "AIzaSyAyIVMDstj2KWRvj1cHv0x0JCMVRWMteAw",
  authDomain: "graduateinhunt.firebaseapp.com",
  projectId: "graduateinhunt",
  storageBucket: "graduateinhunt.appspot.com",
  messagingSenderId: "49490866745",
  appId: "1:49490866745:web:df722a8a68eae051cb53e8",
  measurementId: "G-2L0JMXNT2Y"
};

// ---------------- INIT ----------------
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

// ---------------- ELEMENT ----------------
const publicJobList = document.getElementById("publicJobList");

// ---------------- LOAD PUBLIC JOBS ----------------
function loadPublicJobs() {
  const q = query(
    collection(db, "jobs"),
    where("visible", "==", true),
    orderBy("postedAt", "desc")
  );

  onSnapshot(q, snap => {
    publicJobList.innerHTML = "";
    if(snap.empty){
      publicJobList.innerHTML = "<li>No jobs available at the moment.</li>";
      return;
    }

    snap.forEach(docSnap => {
      const job = docSnap.data();
      const li = document.createElement("li");
      li.innerHTML = `
        <strong>${job.title}</strong> @ ${job.company} (${job.type})<br>
        <small>${job.location}</small><br>
        <p>${job.description}</p>
      `;
      publicJobList.appendChild(li);
    });
  });
}

// Call on page load
loadPublicJobs();
