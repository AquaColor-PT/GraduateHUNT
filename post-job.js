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
  if(!email || !password) return alert("⚠️ Enter email and password");
  try { await createUserWithEmailAndPassword(auth,email,password); alert("✅ Registered"); } 
  catch(err){ alert("❌ "+err.message); }
};

loginBtn.onclick = async () => {
  const email = emailInput.value.trim().toLowerCase();
  const password = passwordInput.value;
  if(!email || !password) return alert("⚠️ Enter email and password");
  try { await signInWithEmailAndPassword(auth,email,password); alert("✅ Logged in"); } 
  catch(err){ alert("❌ "+err.message); }
};

logoutBtn.onclick = async () => {
  try{ await signOut(auth); alert("🚪 Logged out"); } 
  catch(err){ alert("❌ "+err.message); }
};

forgotBtn.onclick = async () => {
  const email = emailInput.value.trim().toLowerCase();
  if(!email) return alert("⚠️ Enter your email");
  try{ await sendPasswordResetEmail(auth,email); alert("✅ Reset email sent"); } 
  catch(err){ alert("❌ "+err.message); }
};

// ---------------- ENABLE POST BUTTON ----------------
function checkFields(){
  postJobBtn.disabled = !inputs.every(i => i.value.trim() !== "");
}
inputs.forEach(i => i.addEventListener("input", checkFields));

// ---------------- DEFAULT POST JOB ----------------
async function postJob(e){
  e.preventDefault();
  const user = auth.currentUser;
  if(!user) return alert("⚠️ Login required");
  try{
    await addDoc(collection(db,"jobs"),{
      title: inputs[0].value.trim(),
      company: inputs[1].value.trim(),
      location: inputs[2].value.trim(),
      type: inputs[3].value,
      description: inputs[4].value.trim(),
      recruiterId: user.uid,
      postedAt: serverTimestamp(),
      visible: true
    });
    jobForm.reset();
    checkFields();
  }catch(err){ console.error(err); alert("❌ "+err.message); }
}
jobForm.onsubmit = postJob;

// ---------------- AUTH STATE ----------------
onAuthStateChanged(auth,user=>{
  if(user){
    jobForm.classList.remove("hidden");
    logoutBtn.classList.remove("hidden");
    registerBtn.disabled = true;
    loginBtn.disabled = true;
    loadJobsRealtime(user.uid);
  }else{
    jobForm.classList.add("hidden");
    logoutBtn.classList.add("hidden");
    registerBtn.disabled = false;
    loginBtn.disabled = false;
    jobList.innerHTML="";
  }
});

// ---------------- LOAD JOBS REALTIME ----------------
function loadJobsRealtime(uid){
  const q = query(collection(db,"jobs"), where("recruiterId","==",uid), orderBy("postedAt","desc"));
  onSnapshot(q, snap=>{
    jobList.innerHTML="";
    snap.forEach(docSnap=>{
      const job = docSnap.data();
      const li = document.createElement("li");
      li.innerHTML = `
        <strong>${job.title}</strong> @ ${job.company} (${job.type})<br>
        <small>${job.location}</small><br>
        <p>${job.description}</p>
        <div class="job-buttons">
          <button class="editBtn">Edit</button>
          <button class="deleteBtn">Delete</button>
        </div>
      `;
      li.querySelector(".editBtn").onclick = ()=>editJob(docSnap.id,job);
      li.querySelector(".deleteBtn").onclick = ()=>deleteJob(docSnap.id);
      jobList.appendChild(li);
    });
  });
}

// ---------------- EDIT JOB ----------------
function editJob(jobId,job){
  inputs[0].value = job.title;
  inputs[1].value = job.company;
  inputs[2].value = job.location;
  inputs[3].value = job.type;
  inputs[4].value = job.description;
  checkFields();
  postJobBtn.textContent = "Update Job";

  jobForm.onsubmit = async e=>{
    e.preventDefault();
    const user = auth.currentUser;
    if(!user) return alert("⚠️ Login required");
    try{
      await updateDoc(doc(db,"jobs",jobId),{
        title: inputs[0].value.trim(),
        company: inputs[1].value.trim(),
        location: inputs[2].value.trim(),
        type: inputs[3].value,
        description: inputs[4].value.trim()
      });
      jobForm.reset();
      postJobBtn.textContent = "Post Job";
      jobForm.onsubmit = postJob;
      checkFields();
    }catch(err){ console.error(err); alert("❌ "+err.message); }
  };
}

// ---------------- DELETE JOB ----------------
async function deleteJob(jobId){
  if(!confirm("Delete this job?")) return;
  try{ await deleteDoc(doc(db,"jobs",jobId)); } 
  catch(err){ console.error(err); alert("❌ "+err.message); }
}
