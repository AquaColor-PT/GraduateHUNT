import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js/+esm';

const SUPABASE_URL = 'https://euclknvsppptbfclwxqq.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImV1Y2xrbnZzcHBwdGJmY2x3eHFxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTc2Mjc2NTQsImV4cCI6MjA3MzIwMzY1NH0.HlGW3kZJ4CPnF2JuZGs_4ObkhxwVFTSedb7O8HHDEag';
const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

// Elements
const profilePicEl = document.getElementById('profilePic');
const profilePicContainer = document.getElementById('profilePicContainer');
const profileNameEl = document.getElementById('profileName');
const profileCompanyEl = document.getElementById('profileCompany');
const profileCreditsEl = document.getElementById('profileCredits');

const postJobForm = document.getElementById('jobForm');
const declarationCheckbox = document.getElementById('declaration');
const logoutBtn = document.getElementById('logoutBtn');
const viewMyJobsBtn = document.getElementById('viewMyJobsBtn');
const buyCreditsBtn = document.getElementById('buyCreditsBtn');
const viewGraduatesBtn = document.querySelector('a[href="homepage-for-recruiters.html"]');

let currentUserId = null;
let currentCredits = 0;

// ===============================
// Auth check
// ===============================
async function checkUser() {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session?.user) {
    window.location.href = 'recruiter-login.html';
    return;
  }
  currentUserId = session.user.id;
  await loadProfile();
}
checkUser();

// ===============================
// Load recruiter profile + credits
// ===============================
async function loadProfile() {
  try {
    const { data, error } = await supabase.from('recruiters').select('*').eq('id', currentUserId).single();
    if (error) throw error;

    currentCredits = data.credits || 0;
    profileNameEl.textContent = `${data.first_name} ${data.last_name}`;
    profileCompanyEl.textContent = data.company_name || 'Your Company/Agency';
    profileCreditsEl.textContent = `Credits: ${currentCredits}`;

    if (data.profile_url) {
      const { data: urlData } = supabase.storage.from('recruiter-profile-pics').getPublicUrl(data.profile_url);
      if (urlData?.publicUrl) {
        profilePicEl.src = urlData.publicUrl;
        profilePicEl.style.display = 'block';
        profilePicContainer.style.display = 'none';
      }
    }

    handleCreditLock();
  } catch (err) { console.error(err); }
}

// ===============================
// Disable buttons if no credits
// ===============================
function handleCreditLock() {
  const postJobBtn = document.getElementById('postJobBtn');
  const disable = currentCredits <= 0;

  [postJobBtn, viewMyJobsBtn, viewGraduatesBtn].forEach(btn => {
    if (btn) {
      btn.disabled = disable;
      btn.style.opacity = disable ? '0.5' : '1';
      btn.style.cursor = disable ? 'not-allowed' : 'pointer';
      if (btn.tagName === 'A') btn.style.pointerEvents = disable ? 'none' : 'auto';
    }
  });
}

// ===============================
// Dashboard: Post Job
// ===============================
if (postJobForm) {
  postJobForm.addEventListener('submit', async e => {
    e.preventDefault();
    if (!declarationCheckbox.checked) return alert('Please agree to declaration');
    if (currentCredits <= 0) return alert('No credits left');

    const title = document.getElementById('jobTitle').value.trim();
    const location = document.getElementById('location').value.trim();
    const jobType = document.getElementById('jobType').value;
    const description = document.getElementById('description').value.trim();
    const companyName = document.getElementById('jobCompany').value.trim();
    const requiredQualifications = document.getElementById('requiredQualifications').value.trim();

    if (!title || !location || !jobType || !description || !companyName || !requiredQualifications) {
      return alert('Please fill all fields');
    }

    try {
      const { error } = await supabase.from('jobs').insert([{
        recruiter_id: currentUserId,
        title, location, job_type: jobType, description,
        company_name: companyName, required_qualifications: requiredQualifications
      }]);
      if (error) throw error;

      alert('Job posted! 1 credit used.');
      await supabase.from('recruiters').update({ credits: currentCredits - 1 }).eq('id', currentUserId);
      currentCredits -= 1;
      profileCreditsEl.textContent = `Credits: ${currentCredits}`;
      handleCreditLock();
      postJobForm.reset();
    } catch (err) { console.error(err); alert('Failed to post job'); }
  });
}

// ===============================
// Buy Credits button
// ===============================
if (buyCreditsBtn) {
  buyCreditsBtn.addEventListener('click', () => {
    window.location.href = 'recruiters-buycredits.html';
  });
}

// ===============================
// View My Jobs
// ===============================
if (viewMyJobsBtn) {
  viewMyJobsBtn.addEventListener('click', () => {
    if (currentCredits <= 0) return alert('No credits left');
    window.location.href = 'my-post.html';
  });
}

// ===============================
// Logout
// ===============================
if (logoutBtn) {
  logoutBtn.addEventListener('click', async () => {
    await supabase.auth.signOut();
    window.location.href = 'homepage.html';
  });
}
