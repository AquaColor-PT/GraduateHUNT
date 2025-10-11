import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js/+esm';

const SUPABASE_URL = 'https://euclknvsppptbfclwxqq.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImV1Y2xrbnZzcHBwdGJmY2x3eHFxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTc2Mjc2NTQsImV4cCI6MjA3MzIwMzY1NH0.HlGW3kZJ4CPnF2JuZGs_4ObkhxwVFTSedb7O8HHDEag';
const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

const jobListEl = document.getElementById('jobList');
const searchBar = document.getElementById('searchBar');
const logoutBtn = document.getElementById('logoutBtn');
let currentUserId = null;
let allJobs = [];

// ===============================
// Auth check
// ===============================
async function checkUser() {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session?.user) { window.location.href = 'recruiter-login.html'; return; }
  currentUserId = session.user.id;
  await loadJobs();
}
checkUser();

// ===============================
// Load recruiter jobs
// ===============================
async function loadJobs() {
  jobListEl.innerHTML = '<p>Loading jobs...</p>';
  try {
    const { data: jobs, error } = await supabase
      .from('jobs')
      .select('*')
      .eq('recruiter_id', currentUserId)
      .order('created_at', { ascending: false });
    if (error) throw error;

    allJobs = jobs; // store all jobs for search

    if (!jobs.length) { jobListEl.innerHTML = '<p>No jobs posted yet.</p>'; return; }

    renderJobs(jobs);

  } catch (err) { console.error(err); jobListEl.innerHTML = '<p>Error loading jobs.</p>'; }
}

// ===============================
// Render jobs
// ===============================
function renderJobs(jobs) {
  jobListEl.innerHTML = '';
  jobs.forEach(job => {
    const div = document.createElement('div');
    div.classList.add('job-item');
    const shortDesc = job.description.length > 100 ? job.description.slice(0, 100) + '...' : job.description;

    div.innerHTML = `
      <div>
        <strong>${job.title}</strong> (${job.job_type})<br>
        <small>${job.location}</small><br>
        <small>Company: ${job.company_name}</small><br>
        <p style="white-space: pre-line; color:#555; margin-top:8px;" class="job-desc" data-full="${job.description}">
          ${shortDesc}
        </p>
        ${job.description.length > 100 ? '<span class="toggleDesc">Show More</span>' : ''}
      </div>
      <div>
        <button class="editBtn" data-id="${job.id}" type="button">Edit</button>
        <button class="deleteBtn" data-id="${job.id}" type="button">Delete</button>
        <button class="toggleVisibilityBtn" data-id="${job.id}" type="button">
          ${job.visible ? 'Hide Job' : 'Show Job'}
        </button>
      </div>
    `;
    jobListEl.appendChild(div);
  });
}

// ===============================
// Search functionality
// ===============================
searchBar.addEventListener('input', () => {
  const query = searchBar.value.toLowerCase();
  const filteredJobs = allJobs.filter(job => 
    job.title.toLowerCase().includes(query) ||
    job.company_name.toLowerCase().includes(query)
  );
  renderJobs(filteredJobs);
});

// ===============================
// Edit / Delete / Toggle Visibility / Show More
// ===============================
jobListEl.addEventListener('click', async e => {
  const btn = e.target.closest('button');
  if (!btn) return;
  const jobId = btn.dataset.id;

  // Delete
  if (btn.classList.contains('deleteBtn')) {
    if (!confirm('Delete this job?')) return;
    try { await supabase.from('jobs').delete().eq('id', jobId); allJobs = allJobs.filter(j => j.id != jobId); btn.closest('.job-item')?.remove(); }
    catch(err){ alert('Delete failed'); console.error(err);}
  }

  // Edit
  if (btn.classList.contains('editBtn')) {
    window.location.href = `edit-job.html?jobId=${jobId}`;
  }

  // Toggle visibility
  if (btn.classList.contains('toggleVisibilityBtn')) {
    try {
      const { data: job } = await supabase.from('jobs').select('*').eq('id', jobId).single();
      const { error } = await supabase.from('jobs').update({ visible: !job.visible }).eq('id', jobId);
      if (error) throw error;
      job.visible = !job.visible; // update local copy
      btn.textContent = job.visible ? 'Hide Job' : 'Show Job';
    } catch (err) { console.error(err); alert('Failed to toggle visibility'); }
  }

  // Show More / Show Less
  const toggle = e.target.closest('.toggleDesc');
  if (toggle) {
    const descEl = toggle.previousElementSibling;
    const fullText = descEl.dataset.full;
    if (toggle.textContent === 'Show More') { descEl.textContent = fullText; toggle.textContent = 'Show Less'; }
    else { descEl.textContent = fullText.slice(0,100) + '...'; toggle.textContent = 'Show More'; }
  }
});

// ===============================
// Logout
// ===============================
logoutBtn.addEventListener('click', async () => {
  await supabase.auth.signOut();
  window.location.href = 'homepage.html';
});
