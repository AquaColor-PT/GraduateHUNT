// ---------------- CONNECT TO SUPABASE ----------------
import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js/+esm';

const SUPABASE_URL = 'https://euclknvsppptbfclwxqq.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImV1Y2xrbnZzcHBwdGJmY2x3eHFxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTc2Mjc2NTQsImV4cCI6MjA3MzIwMzY1NH0.HlGW3kZJ4CPnF2JuZGs_4ObkhxwVFTSedb7O8HHDEag';
const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

// ---------------- ELEMENTS ----------------
const emailInput = document.getElementById("email");
const passwordInput = document.getElementById("password");
const registerBtn = document.getElementById("registerBtn");
const loginBtn = document.getElementById("loginBtn");
const logoutBtn = document.getElementById("logoutBtn");

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

// ---------------- INITIAL STATE ----------------
let currentUser = null;
jobForm.classList.add("hidden"); // hide form initially
logoutBtn.classList.add("hidden"); // hide logout initially

// ---------------- AUTH FUNCTIONS ----------------
registerBtn.addEventListener("click", async () => {
  const email = emailInput.value.trim().toLowerCase();
  const password = passwordInput.value;
  if (!email || !password) return alert("Enter email and password");

  const { data, error } = await supabase.auth.signUp({ email, password });
  if (error) alert(error.message);
  else alert("✅ Registered successfully. Check email to confirm.");
});

loginBtn.addEventListener("click", async () => {
  const email = emailInput.value.trim().toLowerCase();
  const password = passwordInput.value;
  if (!email || !password) return alert("Enter email and password");

  const { data, error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) return alert(error.message);

  currentUser = data.user;
  if (!currentUser) return alert("Login failed");

  // Show job form and logout
  jobForm.classList.remove("hidden");
  logoutBtn.classList.remove("hidden");

  // Disable login/register buttons
  registerBtn.disabled = true;
  loginBtn.disabled = true;

  // Load jobs posted by this recruiter
  loadJobsRealtime();
});

// ---------------- LOGOUT ----------------
logoutBtn.addEventListener("click", async () => {
  const { error } = await supabase.auth.signOut();
  if (error) return alert(error.message);

  currentUser = null;

  // Hide job form and logout
  jobForm.classList.add("hidden");
  logoutBtn.classList.add("hidden");

  // Enable login/register buttons
  registerBtn.disabled = false;
  loginBtn.disabled = false;

  // Clear job list
  jobList.innerHTML = "";
});

// ---------------- ENABLE POST BUTTON ----------------
function checkFields() {
  postJobBtn.disabled = !inputs.every(i => i.value.trim() !== "");
}
inputs.forEach(input => input.addEventListener("input", checkFields));

// ---------------- POST OR UPDATE JOB ----------------
let editingJobId = null;

jobForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  if (!currentUser) return alert("You must login first");

  const jobData = {
    title: document.getElementById("jobTitle").value.trim(),
    company: document.getElementById("company").value.trim(),
    location: document.getElementById("location").value.trim(),
    type: document.getElementById("jobType").value,
    description: document.getElementById("description").value.trim(),
    recruiter_id: currentUser.id,
    posted_at: new Date(),
    visible: true
  };

  try {
    if (editingJobId) {
      await supabase.from("Jobs").update(jobData).eq("id", editingJobId);
      editingJobId = null;
      postJobBtn.textContent = "Post Job";
    } else {
      await supabase.from("Jobs").insert([jobData]);
    }
    jobForm.reset();
    checkFields();
  } catch (err) {
    console.error(err);
    alert("Error posting job: " + err.message);
  }
});

// ---------------- LOAD JOBS REALTIME ----------------
async function loadJobsRealtime() {
  if (!currentUser) return;

  // Initial load
  const { data, error } = await supabase
    .from("Jobs")
    .select("*")
    .eq("recruiter_id", currentUser.id)
    .order("posted_at", { ascending: false });
  if (error) return console.error(error);

  renderJobs(data);

  // Realtime updates
  supabase
    .from(`Jobs:recruiter_id=eq.${currentUser.id}`)
    .on("*", payload => {
      loadJobsRealtime(); // reload on any change
    })
    .subscribe();
}

// ---------------- RENDER JOBS ----------------
function renderJobs(jobs) {
  jobList.innerHTML = "";
  if (!jobs.length) jobList.innerHTML = "<li>No jobs posted yet</li>";
  jobs.forEach(job => {
    const li = document.createElement("li");
    li.innerHTML = `
      <strong>${job.title}</strong> @ ${job.company} (${job.type})<br>
      <small>${job.location}</small><br>
      <p>${job.description}</p>
      <button class="editBtn">Edit</button>
      <button class="deleteBtn">Delete</button>
    `;
    li.querySelector(".editBtn").onclick = () => editJob(job);
    li.querySelector(".deleteBtn").onclick = () => deleteJob(job.id);
    jobList.appendChild(li);
  });
}

// ---------------- EDIT JOB ----------------
function editJob(job) {
  document.getElementById("jobTitle").value = job.title;
  document.getElementById("company").value = job.company;
  document.getElementById("location").value = job.location;
  document.getElementById("jobType").value = job.type;
  document.getElementById("description").value = job.description;
  checkFields();
  editingJobId = job.id;
  postJobBtn.textContent = "Update Job";
}

// ---------------- DELETE JOB ----------------
async function deleteJob(jobId) {
  if (!confirm("Are you sure you want to delete this job?")) return;
  const { error } = await supabase.from("Jobs").delete().eq("id", jobId);
  if (error) alert(error.message);
}
