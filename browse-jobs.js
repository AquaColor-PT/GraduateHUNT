// Import Firebase
import { initializeApp } from "https://www.gstatic.com/firebasejs/9.6.1/firebase-app.js";
import { 
  getFirestore, collection, addDoc, getDocs, query, where, orderBy, serverTimestamp 
} from "https://www.gstatic.com/firebasejs/9.6.1/firebase-firestore.js";

// Firebase Config (same as recruiter)
const firebaseConfig = {
  apiKey: "AIzaSyAyIVMDstj2KWRvj1cHv0x0JCMVRWMteAw",
  authDomain: "graduateinhunt.firebaseapp.com",
  projectId: "graduateinhunt",
  storageBucket: "graduateinhunt.appspot.com",
  messagingSenderId: "49490866745",
  appId: "1:49490866745:web:df722a8a68eae051cb53e8",
  measurementId: "G-2L0JMXNT2Y"
};

// Init Firebase
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

// Elements
const jobFeed = document.getElementById("jobFeed");
const applyModal = document.getElementById("applyModal");
const applyForm = document.getElementById("applyForm");

let selectedJobId = null;

// ---------------- LOAD JOBS ----------------
async function loadJobs() {
  jobFeed.innerHTML = "";
  const q = query(collection(db, "jobs"), orderBy("postedAt", "desc"));
  const snap = await getDocs(q);

  snap.forEach(docSnap => {
    const job = docSnap.data();
    if(job.visible !== false) {  // Show only visible jobs
      const li = document.createElement("li");
      li.className = "job-card";
      li.innerHTML = `
        <strong>${job.title}</strong> @ ${job.company} (${job.type})<br>
        <small>${job.location}</small><br>
        <p>${job.description}</p>
        <button class="applyBtn">Apply</button>
      `;

      // Open application modal
      li.querySelector(".applyBtn").onclick = () => {
        selectedJobId = docSnap.id;
        applyModal.style.display = "flex";
      };

      jobFeed.appendChild(li);
    }
  });
}

loadJobs();

// ---------------- SUBMIT APPLICATION ----------------
applyForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  if(!selectedJobId){ alert("⚠️ No job selected"); return; }

  const name = document.getElementById("appName").value.trim();
  const email = document.getElementById("appEmail").value.trim();
  const cvURL = document.getElementById("cvURL").value.trim();

  if(!name || !email || !cvURL){
    return alert("⚠️ Fill in all fields");
  }

  try {
    await addDoc(collection(db, "applications"), {
      jobId: selectedJobId,
      name,
      email,
      cvURL,
      appliedAt: serverTimestamp()
    });

    alert("✅ Application submitted!");
    applyForm.reset();
    applyModal.style.display = "none";

  } catch (err) {
    alert("❌ " + err.message);
  }
});
