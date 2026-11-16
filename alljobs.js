import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js/+esm';

const SUPABASE_URL = 'https://euclknvsppptbfclwxqq.supabase.co';
const SUPABASE_KEY = 'sb_publishable_90JbyFsa4BuuyeuLCIActg_yXfbHQ30';
const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

const $ = id => document.getElementById(id);
const publicJobList = $('publicJobList');
const jobTitleSearch = $('jobTitleSearch');
const resultCount = $('resultCount');
const pills = [...document.querySelectorAll('#typePills .pill')];

let allJobs = [];
let activeType = ''; // '' = All

// ---------- helpers ----------
function esc(value) {
  const div = document.createElement('div');
  div.textContent = value ?? '';
  return div.innerHTML;
}
const norm = s => (s ?? '').toString().toLowerCase();

$('logoutBtn').addEventListener('click', async () => {
  await supabase.auth.signOut();
  window.location.href = 'homepage.html';
});

const ICON_BUILDING = '<svg class="i" viewBox="0 0 24 24" aria-hidden="true"><path d="M4 21V5a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v16"/><path d="M16 9h2a2 2 0 0 1 2 2v10"/><path d="M8 7h4M8 11h4M8 15h4"/></svg>';
const ICON_PIN = '<svg class="i" viewBox="0 0 24 24" aria-hidden="true"><path d="M12 21s7-6.2 7-11.5A7 7 0 0 0 5 9.5C5 14.8 12 21 12 21z"/><circle cx="12" cy="9.5" r="2.5"/></svg>';

// ---------- rendering ----------
function showNote(text) {
  publicJobList.innerHTML = `<li class="note">${esc(text)}</li>`;
}

function displayJobs(jobs) {
  publicJobList.innerHTML = '';
  if (!jobs || jobs.length === 0) {
    showNote('No jobs match your search. Try another title or choose "All".');
    return;
  }

  jobs.forEach(job => {
    const description = job.description || '';
    const isLong = description.length > 140 || description.split('\n').length > 3;

    const li = document.createElement('li');
    li.className = 'job';
    li.innerHTML = `
      <div class="job-top">
        <h4>${esc(job.title || 'Untitled job')}</h4>
        ${job.job_type ? `<span class="type">${esc(job.job_type)}</span>` : ''}
      </div>
      <div class="meta">
        <span>${ICON_BUILDING}${esc(job.company_name || 'Company not listed')}</span>
        <span>${ICON_PIN}${esc(job.location || 'Location not listed')}</span>
      </div>
      <div class="quals"><strong>Qualifications required:</strong> ${esc(job.required_qualifications || 'None')}</div>
      <p class="desc"></p>
      ${isLong ? '<button class="toggleDesc" type="button">Show more</button>' : ''}
      <div class="job-foot">
        <small>Posted ${esc(job.created_at ? new Date(job.created_at).toLocaleDateString() : '')}</small>
        <button class="applyBtn" type="button">Apply</button>
      </div>`;

    const descEl = li.querySelector('.desc');
    descEl.textContent = description || 'No description provided.';

    const toggle = li.querySelector('.toggleDesc');
    if (toggle) {
      toggle.addEventListener('click', () => {
        const open = descEl.classList.toggle('expanded');
        toggle.textContent = open ? 'Show less' : 'Show more';
      });
    }

    li.querySelector('.applyBtn').addEventListener('click', () => {
      const url = new URL('applicationform.html', window.location.href);
      url.searchParams.set('job_id', job.id);
      url.searchParams.set('job_title', job.title || '');
      window.location.href = url.toString();
    });

    publicJobList.appendChild(li);
  });
}

// ---------- filtering ----------
function filterJobs() {
  const q = norm(jobTitleSearch.value).trim();

  const filtered = allJobs.filter(job =>
    job.visible !== false &&
    (!activeType || norm(job.job_type).includes(activeType)) &&
    (!q || norm(job.title).includes(q))
  );

  resultCount.textContent = `${filtered.length} ${filtered.length === 1 ? 'job' : 'jobs'} found`;
  displayJobs(filtered);
}

function setType(type) {
  activeType = type;
  pills.forEach(p => p.classList.toggle('on', p.dataset.type === type));
  filterJobs();
}

pills.forEach(p => p.addEventListener('click', () => setType(p.dataset.type)));
jobTitleSearch.addEventListener('input', filterJobs);
jobTitleSearch.addEventListener('keydown', e => { if (e.key === 'Enter') filterJobs(); });
$('searchBtn').addEventListener('click', filterJobs);

// ---------- load ----------
async function loadJobs() {
  showNote('Loading jobs...');
  resultCount.textContent = '';

  // Every visible job is shown. Nothing is filtered by the graduate's qualification.
  const { data: jobs, error } = await supabase
    .from('jobs')
    .select('*')
    .eq('visible', true)
    .order('created_at', { ascending: false });

  if (error) {
    console.error('Error loading jobs:', error);
    showNote('Could not load jobs. Please refresh the page.');
    return;
  }

  allJobs = jobs || [];

  // Optional links like alljobs.html?q=retail&type=Contract
  const params = new URLSearchParams(window.location.search);
  if (params.get('q')) jobTitleSearch.value = params.get('q');
  const typeParam = norm(params.get('type'));
  if (typeParam) {
    const match = pills.find(p => p.dataset.type && typeParam.includes(p.dataset.type));
    if (match) activeType = match.dataset.type;
    pills.forEach(p => p.classList.toggle('on', p.dataset.type === activeType));
  }

  filterJobs();
}

loadJobs();
