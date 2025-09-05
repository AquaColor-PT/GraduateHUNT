// ---------------- IMPORT FIREBASE ----------------
import { initializeApp } from "https://www.gstatic.com/firebasejs/9.6.1/firebase-app.js";
import { 
  getAuth, createUserWithEmailAndPassword, signInWithEmailAndPassword, signOut, onAuthStateChanged, sendPasswordResetEmail 
} from "https://www.gstatic.com/firebasejs/9.6.1/firebase-auth.js";
import { 
  getFirestore, collection, addDoc, query, where, orderBy, updateDoc, deleteDoc, doc, serverTimestamp, onSnapshot 
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

const postJobBtn = document.getElementById("postJobBtn");
const inputs = [
  document.getElementById("jobTitle"),
  document.getElementById("company"),
  document.getElementById("location"),
  document.getElementById("jobType"),
  document.getElementById("description")
];

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

// ---------------- AUTH STATE ----------------
onAuthStateChanged(auth, user => {
  if (user) {
    jobForm.classList.remove("hidden");
    logoutBtn.classList.remove("hidden");
    registerBtn.disabled = true;
    loginBtn.disabled = true;
    loadJobsRealtime(user.uid);
  } else {
    jobForm.classList.add("hidden");
    logoutBtn.classList.add("hidden");
    registerBtn.disabled = false;
    loginBtn.disabled = false;
    jobList.innerHTML = "";
  }
});

// ---------------- ENABLE POST BUTTON ----------------
function checkFields() {
  const allFilled = inputs.every(input => input.value.trim() !== "");
  postJobBtn.disabled = !allFilled;
}
inputs.forEach(input => input.addEventListener("input", checkFields));

// ---------------- POST OR UPDATE JOB ----------------
let editingJobId = null;

jobForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  const user = auth.currentUser;
  if (!user) return alert("⚠️ You must login first");

  const jobData = {
    title: document.getElementById("jobTitle").value.trim(),
    company: document.getElementById("company").value.trim(),
    location: document.getElementById("location").value.trim(),
    type: document.getElementById("jobType").value,
    description: document.getElementById("description").value.trim(),
  };

  try {
    if (editingJobId) {
      // Update job
      await updateDoc(doc(db, "jobs", editingJobId), jobData);
      editingJobId = null;
      postJobBtn.textContent = "Post Job";
    } else {
      // Add new job
      await addDoc(collection(db, "jobs"), {
        ...jobData,
        recruiterId: user.uid,
        postedAt: serverTimestamp(),
        visible: true
      });
    }
    jobForm.reset();
    checkFields();
  } catch (err) {
    console.error(err);
    alert("❌ " + err.message);
  }
});

// ---------------- LOAD JOBS REALTIME ----------------
function loadJobsRealtime(uid) {
  const q = query(
    collection(db, "jobs"),
    where("recruiterId", "==", uid),
    orderBy("postedAt", "desc")
  );

  onSnapshot(q, snap => {
    jobList.innerHTML = "";
    if (snap.empty) jobList.innerHTML = "<li>No jobs posted yet</li>";

    snap.forEach(docSnap => {
      const job = docSnap.data();
      const li = document.createElement("li");
      li.innerHTML = `
        <strong>${job.title}</strong> @ ${job.company} (${job.type})<br>
        <small>${job.location}</small><br>
        <p>${job.description}</p>
        <div class="job-buttons">
          <button class="editBtn">Edit</button>
          <button class="deleteBtn">Delete</button>
          <button class="viewApps">View Applications</button>
        </div>
      `;

      li.querySelector(".editBtn").onclick = () => editJob(docSnap.id, job);
      li.querySelector(".deleteBtn").onclick = () => deleteJob(docSnap.id);
      li.querySelector(".viewApps").onclick = () => loadApplications(docSnap.id);

      jobList.appendChild(li);
    });
  });
}

// ---------------- EDIT JOB ----------------
function editJob(jobId, job) {
  document.getElementById("jobTitle").value = job.title;
  document.getElementById("company").value = job.company;
  document.getElementById("location").value = job.location;
  document.getElementById("jobType").value = job.type;
  document.getElementById("description").value = job.description;
  checkFields();
  editingJobId = jobId;
  postJobBtn.textContent = "Update Job";
}

// ---------------- DELETE JOB ----------------
async function deleteJob(jobId) {
  if (!confirm("Are you sure you want to delete this job?")) return;
  try {
    await deleteDoc(doc(db, "jobs", jobId));
  } catch (err) {
    console.error(err);
    alert("❌ " + err.message);
  }
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
