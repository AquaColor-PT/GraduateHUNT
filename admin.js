import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js/+esm';

const SUPABASE_URL = 'https://euclknvsppptbfclwxqq.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImV1Y2xrbnZzcHBwdGJmY2x3eHFxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTc2Mjc2NTQsImV4cCI6MjA3MzIwMzY1NH0.HlGW3kZJ4CPnF2JuZGs_4ObkhxwVFTSedb7O8HHDEag';
const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

const recruiterTableBody = document.getElementById('recruiterTableBody');
const searchInput = document.getElementById('search');
const messageEl = document.getElementById('message');
const pendingCountEl = document.getElementById('pendingCount');

// Helper: check if current user is admin
async function isAdmin() {
  const { data: user } = await supabase.auth.getUser();
  if (!user || !user.user) return false;

  const { data, error } = await supabase
    .from('users')
    .select('role')
    .eq('id', user.user.id)
    .single();

  if (error || !data) return false;
  return data.role === 'admin';
}

// Load all recruiters
async function loadRecruiters() {
  const admin = await isAdmin();
  if (!admin) {
    messageEl.textContent = 'You must be an admin to view this page.';
    messageEl.className = 'message error';
    return;
  }

  const { data, error } = await supabase
    .from('recruiters')
    .select('*')
    .order('created_at', { ascending: false });

  if (error) {
    messageEl.textContent = 'Error loading recruiters: ' + error.message;
    messageEl.className = 'message error';
    return;
  }

  const pending = data.filter(r => !r.verified).length;
  pendingCountEl.textContent = pending > 0
    ? `${pending} recruiter(s) awaiting verification`
    : 'All recruiters are verified ✅';

  renderTable(data);
}

// Render table rows
function renderTable(data) {
  const searchTerm = searchInput.value.toLowerCase();
  recruiterTableBody.innerHTML = '';

  data
    .filter(r =>
      r.first_name.toLowerCase().includes(searchTerm) ||
      r.last_name.toLowerCase().includes(searchTerm) ||
      r.company_name.toLowerCase().includes(searchTerm) ||
      (r.registration_number || '').toLowerCase().includes(searchTerm)
    )
    .forEach(r => {
      const tr = document.createElement('tr');
      const isVerified = r.verified;
      if (!isVerified) tr.classList.add('unverified');

      const actionBtnText = isVerified ? 'Unverify' : 'Verify';
      const btnClass = isVerified ? 'verifyBtn unverify' : 'verifyBtn';

      tr.innerHTML = `
        <td>${r.first_name} ${r.last_name}</td>
        <td>${r.email}</td>
        <td>${r.company_name}</td>
        <td>${r.registration_number}</td>
        <td>${r.contact || ''}</td>
        <td>${isVerified ? 'Verified' : 'Unverified'}</td>
        <td><button class="${btnClass}" data-id="${r.id}" data-verified="${isVerified}">${actionBtnText}</button></td>
      `;
      recruiterTableBody.appendChild(tr);
    });

  // Add click listeners for action buttons
  document.querySelectorAll('.verifyBtn').forEach(btn => {
    btn.addEventListener('click', async () => {
      const recruiterId = btn.getAttribute('data-id');
      const currentlyVerified = btn.getAttribute('data-verified') === 'true';

      const admin = await isAdmin();
      if (!admin) {
        messageEl.textContent = 'Only admins can verify recruiters.';
        messageEl.className = 'message error';
        return;
      }

      const { error } = await supabase
        .from('recruiters')
        .update({ verified: !currentlyVerified })
        .eq('id', recruiterId);

      if (error) {
        messageEl.textContent = 'Error updating recruiter: ' + error.message;
        messageEl.className = 'message error';
      } else {
        messageEl.textContent = currentlyVerified ? 'Recruiter unverified.' : 'Recruiter verified!';
        messageEl.className = 'message success';
        loadRecruiters(); // refresh table and counter
      }
    });
  });
}

// Search functionality
searchInput.addEventListener('input', () => loadRecruiters());

// Initial load
loadRecruiters();
