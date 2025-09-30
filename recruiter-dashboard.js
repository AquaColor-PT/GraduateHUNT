import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js/+esm';

// ===============================
// Supabase setup
// ===============================
const SUPABASE_URL = 'https://euclknvsppptbfclwxqq.supabase.co';
const SUPABASE_KEY =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImV1Y2xrbnZzcHBwdGJmY2x3eHFxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTc2Mjc2NTQsImV4cCI6MjA3MzIwMzY1NH0.HlGW3kZJ4CPnF2JuZGs_4ObkhxwVFTSedb7O8HHDEag';
const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

// ===============================
// DOM elements
// ===============================
const profilePicEl = document.getElementById('profilePic');
const profilePicContainer = document.getElementById('profilePicContainer');
const profileNameEl = document.getElementById('profileName');
const profileCompanyEl = document.getElementById('profileCompany');
const profileCreditsEl = document.getElementById('profileCredits');
const jobForm = document.getElementById('jobForm');
const jobListEl = document.getElementById('jobList');
const logoutBtn = document.getElementById('logoutBtn');
const declarationCheckbox = document.getElementById('declaration');

let currentUserId = null;
let editingJobId = null;

// ===============================
// Auth check
// ===============================
async function checkUser() {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session?.user) {
    alert('Please log in first.');
    window.location.href = 'recruiter-login.html';
    return;
  }
  currentUserId = session.user.id;
  await loadProfile();
  await loadJobs();
}
checkUser();

// ===============================
// Load profile
// ===============================
async function loadProfile() {
  try {
    const { data, error } = await supabase
      .from('recruiters')
      .select('*')
      .eq('id', currentUserId)
      .single();
    if (error) throw error;

    profileNameEl.textContent = `${data.first_name} ${data.last_name}`;
    profileCompanyEl.textContent = data.company_name || 'Your Company/Agency';
    profileCreditsEl.textContent = `Credits: ${data.credits || 0}`;

    if (data.profile_url) {
      const { data: urlData } = supabase.storage
        .from('recruiter-profile-pics')
        .getPublicUrl(data.profile_url);
      if (urlData?.publicUrl) {
        profilePicEl.src = urlData.publicUrl;
        profilePicEl.style.display = 'block';
        profilePicContainer.style.display = 'none';
      }
    }
  } catch (err) { console.error('Profile load error:', err); }
}

// ===============================
// Load jobs
// ===============================
async function loadJobs() {
  jobListEl.innerHTML = '';
  try {
    const { data, error } = await supabase
      .from('jobs')
      .select('*')
      .eq('recruiter_id', currentUserId)
      .order('created_at', { ascending: false });
    if (error) throw error;

    if (!data.length) {
      jobListEl.innerHTML = '<p>No jobs posted yet.</p>';
      return;
    }

    data.forEach(job => {
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
        </div>
      `;
      jobListEl.appendChild(div);
    });
  } catch (err) { console.error('Jobs load error:', err); }
}

// ===============================
// Post / Update job
// ===============================
jobForm.addEventListener('submit', async e => {
  e.preventDefault();
  if (!declarationCheckbox.checked) {
    alert('You must agree to the declaration before posting a job.');
    return;
  }

  const title = document.getElementById('jobTitle').value.trim();
  const location = document.getElementById('location').value.trim();
  const jobType = document.getElementById('jobType').value;
  const description = document.getElementById('description').value.trim();
  const companyName = document.getElementById('jobCompany').value.trim();
  if (!title || !location || !jobType || !description || !companyName) {
    alert('Please fill all fields.'); return;
  }

  try {
    if (editingJobId) {
      const { error } = await supabase.from('jobs').update({ title, location, job_type: jobType, description, company_name: companyName }).eq('id', editingJobId);
      if (error) throw error; editingJobId = null; alert('Job updated successfully!');
    } else {
      const { error } = await supabase.from('jobs').insert([{ recruiter_id: currentUserId, title, location, job_type: jobType, description, company_name: companyName }]);
      if (error) throw error; alert('Job posted successfully!');
    }
    jobForm.reset(); await loadJobs();
  } catch (err) { console.error('Job save error:', err); alert(err.message || 'Failed to save job.'); }
});

// ===============================
// Edit / Delete / Show More
// ===============================
jobListEl.addEventListener('click', async e => {
  const btn = e.target.closest('button');
  if (btn) {
    const jobId = btn.dataset.id;
    if (!jobId) return;

    if (btn.classList.contains('deleteBtn')) {
      if (!confirm('Are you sure you want to delete this job?')) return;
      try { const { error } = await supabase.from('jobs').delete().eq('id', jobId); if (error) throw error; btn.closest('.job-item')?.remove(); }
      catch (err) { console.error('Delete error:', err); alert(err.message || 'Failed to delete job.'); }
    }

    if (btn.classList.contains('editBtn')) {
      try {
        const { data: job, error } = await supabase.from('jobs').select('*').eq('id', jobId).single(); if (error) throw error;
        document.getElementById('jobTitle').value = job.title;
        document.getElementById('location').value = job.location;
        document.getElementById('jobType').value = job.job_type;
        document.getElementById('description').value = job.description;
        document.getElementById('jobCompany').value = job.company_name;
        editingJobId = jobId;
        window.scrollTo({ top: jobForm.offsetTop, behavior: 'smooth' });
      } catch (err) { console.error('Edit load error:', err); alert(err.message || 'Failed to load job for editing.'); }
    }
  }

  // Show More / Show Less
  const toggle = e.target.closest('.toggleDesc');
  if (toggle) {
    const descEl = toggle.previousElementSibling;
    const fullText = descEl.dataset.full;
    if (toggle.textContent === 'Show More') { descEl.textContent = fullText; toggle.textContent = 'Show Less'; }
    else { descEl.textContent = fullText.slice(0, 100) + '...'; toggle.textContent = 'Show More'; }
  }
});

// ===============================
// Logout
// ===============================
logoutBtn.addEventListener('click', async () => { await supabase.auth.signOut(); window.location.href = 'homepage.html'; });
