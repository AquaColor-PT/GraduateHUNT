import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js/+esm';

const SUPABASE_URL = 'https://euclknvsppptbfclwxqq.supabase.co';
const SUPABASE_KEY = 'sb_publishable_90JbyFsa4BuuyeuLCIActg_yXfbHQ30';
const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

const jobListEl = document.getElementById('jobList');
const searchBar = document.getElementById('searchBar');

const DESC_LIMIT = 100;

let currentUserId = null;
let allJobs = [];
const expanded = new Set(); // ids of jobs whose full description is showing

// ---------- helpers ----------
// Makes database text safe to put inside HTML
const esc = value => String(value ?? '').replace(/[&<>"']/g, c => ({
  '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
}[c]));

function showNote(text, isError = false) {
  jobListEl.innerHTML = `<p${isError ? ' style="color:#b91c1c;"' : ''}>${esc(text)}</p>`;
}

// ---------- auth ----------
async function checkUser() {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session?.user) {
    window.location.href = 'recruiter-login.html';
    return;
  }
  currentUserId = session.user.id;
  await loadJobs();
}

// ---------- load ----------
async function loadJobs() {
  showNote('Loading jobs...');
  try {
    const { data, error } = await supabase
      .from('jobs')
      .select('*')
      .eq('recruiter_id', currentUserId)
      .order('created_at', { ascending: false });
    if (error) throw error;

    allJobs = data || [];
    applyFilter();
  } catch (err) {
    console.error(err);
    showNote(`Error loading jobs: ${err.message}`, true);
  }
}

// ---------- render ----------
function renderJobs(jobs) {
  if (!jobs.length) {
    showNote(allJobs.length ? 'No jobs match your search.' : 'No jobs posted yet.');
    return;
  }

  jobListEl.innerHTML = jobs.map(job => {
    const id = esc(job.id);
    const desc = job.description || '';
    const isLong = desc.length > DESC_LIMIT;
    const isOpen = expanded.has(String(job.id));
    const shownDesc = isLong && !isOpen ? desc.slice(0, DESC_LIMIT) + '...' : desc;

    const typeHtml = job.job_type
      ? ` <span style="font-weight:500;color:#64748b;">(${esc(job.job_type)})</span>`
      : '';
    const hiddenHtml = job.visible
      ? ''
      : ' <span style="display:inline-block;margin-left:6px;padding:2px 10px;border-radius:999px;background:#fef3c7;color:#92400e;font-size:.72rem;font-weight:700;vertical-align:middle;">Hidden</span>';

    return `
      <div class="job-item">
        <div>
          <h3>${esc(job.title)}${typeHtml}${hiddenHtml}</h3>
          ${job.location ? `<p><strong>Location:</strong> ${esc(job.location)}</p>` : ''}
          ${job.company_name ? `<p><strong>Company:</strong> ${esc(job.company_name)}</p>` : ''}
          ${desc ? `<p style="white-space:pre-line;color:#475569;margin-top:8px;">${esc(shownDesc)}</p>` : ''}
          ${isLong ? `<span class="toggleDesc" data-id="${id}">${isOpen ? 'Show Less' : 'Show More'}</span>` : ''}
        </div>
        <div style="flex:0 0 auto;display:flex;flex-wrap:wrap;gap:6px 0;">
          <button class="editBtn" data-id="${id}" type="button">Edit</button>
          <button class="toggleVisibilityBtn" data-id="${id}" type="button">${job.visible ? 'Hide Job' : 'Show Job'}</button>
          <button class="deleteBtn" data-id="${id}" type="button">Delete</button>
        </div>
      </div>
    `;
  }).join('');
}

// ---------- search ----------
function applyFilter() {
  const query = searchBar.value.trim().toLowerCase();
  const filtered = !query ? allJobs : allJobs.filter(job =>
    [job.title, job.company_name, job.recruiter_name, job.location, job.job_type]
      .some(field => (field || '').toLowerCase().includes(query))
  );
  renderJobs(filtered);
}

searchBar.addEventListener('input', applyFilter);

// ---------- actions ----------
jobListEl.addEventListener('click', async e => {
  // Show More / Show Less (this is a span, not a button, so it is checked first)
  const toggle = e.target.closest('.toggleDesc');
  if (toggle) {
    const key = toggle.dataset.id;
    if (expanded.has(key)) expanded.delete(key); else expanded.add(key);
    applyFilter();
    return;
  }

  const btn = e.target.closest('button');
  if (!btn) return;

  const job = allJobs.find(j => String(j.id) === btn.dataset.id);
  if (!job) return;

  // Edit
  if (btn.classList.contains('editBtn')) {
    window.location.href = `edit-job.html?jobId=${encodeURIComponent(job.id)}`;
    return;
  }

  // Delete
  if (btn.classList.contains('deleteBtn')) {
    if (!confirm(`Delete "${job.title}"? This cannot be undone.`)) return;
    btn.disabled = true;

    const { error } = await supabase
      .from('jobs')
      .delete()
      .eq('id', job.id)
      .eq('recruiter_id', currentUserId);

    if (error) {
      console.error(error);
      alert(`Delete failed: ${error.message}`);
      btn.disabled = false;
      return;
    }

    allJobs = allJobs.filter(j => j.id !== job.id);
    expanded.delete(String(job.id));
    applyFilter();
    return;
  }

  // Hide / Show
  if (btn.classList.contains('toggleVisibilityBtn')) {
    const newValue = !job.visible;
    btn.disabled = true;

    const { error } = await supabase
      .from('jobs')
      .update({ visible: newValue })
      .eq('id', job.id)
      .eq('recruiter_id', currentUserId);

    if (error) {
      console.error(error);
      alert(`Failed to change visibility: ${error.message}`);
      btn.disabled = false;
      return;
    }

    job.visible = newValue;
    applyFilter();
  }
});

// Logout is handled by the script inside my-posts.html
checkUser();
