import { initializeApp } from "https://www.gstatic.com/firebasejs/9.6.1/firebase-app.js";
import { getFirestore, collection, query, where, orderBy, onSnapshot } from "https://www.gstatic.com/firebasejs/9.6.1/firebase-firestore.js";

// Firebase config (same as before)
const firebaseConfig = { /* your config */ };
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

const jobsContainer = document.getElementById("jobsContainer");

const q = query(collection(db, "jobs"), where("visible", "==", true), orderBy("postedAt", "desc"));

onSnapshot(q, (snap) => {
  jobsContainer.innerHTML = "";
  snap.forEach(docSnap => {
    const job = docSnap.data();
    const div = document.createElement("div");
    div.classList.add("job");
    div.innerHTML = `
      <h4>${job.title} @ ${job.company}</h4>
      <small>${job.location} | ${job.type}</small>
      <p>${job.description}</p>
    `;
    jobsContainer.appendChild(div);
  });
});
