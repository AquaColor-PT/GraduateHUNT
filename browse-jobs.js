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
const jobList = document.getElementById("jobList");

// ---------------- LOAD JOBS REALTIME ----------------
function loadJobsRealtime() {
  const q = query(
    collection(db, "jobs"),
    where("visible", "==", true),
    orderBy("postedAt", "desc")
  );

  onSnapshot(q, snap => {
    jobList.innerHTML = "";
    if (snap.empty) {
      jobList.innerHTML = "<li>No jobs available</li>";
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
      jobList.appendChild(li);
    });
  });
}

loadJobsRealtime();
