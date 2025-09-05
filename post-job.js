// ---------------- IMPORT FIREBASE ----------------
import { initializeApp } from "https://www.gstatic.com/firebasejs/9.6.1/firebase-app.js";
import { 
  getAuth, createUserWithEmailAndPassword, signInWithEmailAndPassword, signOut, onAuthStateChanged, sendPasswordResetEmail 
} from "https://www.gstatic.com/firebasejs/9.6.1/firebase-auth.js";
import { 
  getFirestore, collection, addDoc, getDocs, query, where, orderBy, updateDoc, doc, serverTimestamp 
} from "https://www.gstatic.com/firebasejs/9.6.1/firebase-firestore.js";

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
const auth = getAuth(app);
const db = getFirestore(app);

// ---------------- ELEMENTS ----------------
const emailInput = document.getElementById("email");
const passwordInput = document.getElementById("password");
const registerBtn = document.getElementById("registerBtn");
const loginBtn = document.getElementById("loginBtn");
const logoutBtn = document.getElementById("logoutBtn");
const forgotBtn = document.getElementById("forgotBtn");

const jobForm = document.getElementById("jobForm");
const jobList = document.getElementById("jobList");
const appModal = document.getElementById("appModal");
const applicationsList = document.getElementById("applicationsList");

// ---------------- AUTH FUNCTIONS ----------------
registerBtn.onclick = async () => {
  const email = emailInput.value.trim().toLowerCase();
  const password = passwordInput.value;
  if (!email || !password) return alert("⚠️ Enter email and password");

  try {
    await createUserWithEmailAndPassword(auth, email, password);
    alert("✅ Registered successfully");
  } catch (err) {
    alert("❌ " + err.message);
  }
};

loginBtn.onclick = async () => {
  const email = emailInput.value.trim().toLowerCase();
  const password = passwordInput.value;
  if (!email || !password) return alert("⚠️ Enter email and password");

  try {
    await signInWithEmailAndPassword(auth, email, password);
    alert("✅ Logged in successfully");
  } catch (err) {
    alert("❌ " + err.message);
  }
};

logoutBtn.onclick = async () => {
  try {
    await signOut(auth);
    alert("🚪 Logged out");
  } catch (err) {
    alert("❌ " + err.message);
  }
};

forgotBtn.onclick = async () => {
  const email = emailInput.value.trim().toLowerCase();
  if (!email) return alert("⚠️ Enter your email");
  try {
    await sendPasswordResetEmail(auth, email);
    alert("✅ Reset email sent");
  } catch (err) {
    alert("❌ " + err.message);
  }
};

// ---------------- JOB POST ----------------
jobForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  const user = auth.currentUser;
  if (!user) return alert("⚠️ Please login first");

  try {
    await addDoc(collection(db, "jobs"), {
      title: document.getElementById("jobTitle").value,
      company: document.getElementById("company").value,
      location: document.getElementById("location").value,
      type: document.getElementById("jobType").value,
      description: document.getElementById("description").value,
      recruiterId: user.uid,
      postedAt: serverTimestamp(),
      visible: true
    });
    alert("✅ Job Posted!");
    jobForm.reset();
    loadJobs(user.uid);
  } catch (err) {
    alert("❌ " + err.message);
  }
});

// ---------------- LOAD JOBS ----------------
async function loadJobs(uid) {
  jobList.innerHTML = "";
  const q = query(collection(db, "jobs"), where("recruiterId", "==", uid), orderBy("postedAt", "desc"));
  const snap = await getDocs(q);

  snap.forEach(docSnap => {
    const job = docSnap.data();
    const li = document.createElement("li");
    li.innerHTML = `
      <strong>${job.title}</strong> @ ${job.company} (${job.type})<br>
      <small>${job.location}</small><br>
      <p>${job.description}</p>
      <button class="viewApps">View Applications</button>
    `;

    li.querySelector(".viewApps").onclick = () => loadApplications(docSnap.id);
    jobList.appendChild(li);
  });
}

// ---------------- LOAD APPLICATIONS ----------------
async function loadApplications(jobId) {
  applicationsList.innerHTML = "Loading...";
  const q = query(collection(db, "applications"), where("jobId", "==", jobId));
  const snap = await getDocs(q);

  applicationsList.innerHTML = "";
  if (snap.empty) {
    applicationsList.innerHTML = "<li>No applications yet</li>";
  } else {
    snap.forEach(docSnap => {
      const app = docSnap.data();
      const li = document.createElement("li");
      li.innerHTML = `
        <strong>${app.name}</strong> (${app.email})<br>
        <a href="${app.cvURL}" target="_blank">View CV</a><br>
        <small>Applied on: ${app.appliedAt?.toDate ? app.appliedAt.toDate().toLocaleString() : "N/A"}</small>
      `;
      applicationsList.appendChild(li);
    });
  }

  appModal.style.display = "flex";
}

// ---------------- AUTH STATE ----------------
onAuthStateChanged(auth, user => {
  if (user) {
    jobForm.classList.remove("hidden");
    logoutBtn.classList.remove("hidden");
    loadJobs(user.uid);
  } else {
    jobForm.classList.add("hidden");
    logoutBtn.classList.add("hidden");
    jobList.innerHTML = "";
  }
});
