import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm';

const SUPABASE_URL = 'https://euclknvsppptbfclwxqq.supabase.co';
const SUPABASE_KEY = 'sb_publishable_90JbyFsa4BuuyeuLCIActg_yXfbHQ30';
const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

const LOGIN_PAGE = 'recruiter-login.html';
const HOME_PAGE = 'homepage.html';

const $ = (id) => document.getElementById(id);

let userId = null;
let recruiter = null;
let posting = false;
let loggingOut = false;

/* ---------- Helpers ---------- */
let toastTimer;
function toast(message, type = 'success') {
  const t = $('toast');
  t.textContent = message;
  t.className = 'toast show ' + type;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => t.classList.remove('show'), type === 'error' ? 5000 : 3000);
}

function setFormMsg(text, type = '') {
  $('formMsg').textContent = text;
  $('formMsg').className = type;
}

function statusOf(r) {
  return r.status || (r.verified ? 'approved' : 'pending');
}

function fullName(r) {
  return `${r.first_name || ''} ${r.last_name || ''}`.trim();
}

function initials(name) {
  const parts = name.split(/\s+/).filter(Boolean);
  if (!parts.length) return '?';
  return (parts[0][0] + (parts.length > 1 ? parts[parts.length - 1][0] : '')).toUpperCase();
}

function fmtDate(value) {
  const d = new Date(value);
  return isNaN(d) ? '' : d.toLocaleDateString('en-ZA', { day: 'numeric', month: 'short', year: 'numeric' });
}

// A paid monthly plan counts while unlimited_until is still in the future
function accessInfo(r) {
  const until = r.unlimited_until ? new Date(r.unlimited_until) : null;
  const unlimited = !!until && until > new Date();
  const credits = Number(r.credits) || 0;
  return { unlimited, until, credits, hasAccess: unlimited || credits > 0 };
}

function show(view) {
  $('loadingView').hidden = view !== 'loading';
  $('blockedView').hidden = view !== 'blocked';
  $('appView').hidden = view !== 'app';
}

function blocked(title, text) {
  $('blockedTitle').textContent = title;
  $('blockedText').textContent = text;
  show('blocked');
}

function goLogin() { window.location.href = LOGIN_PAGE; }

/* ---------- Load and render ---------- */
async function loadRecruiter() {
  const { data, error } = await supabase.from('recruiters').select('*').eq('id', userId).maybeSingle();
  if (error) throw error;
  return data;
}

function render(r) {
  const name = fullName(r) || 'Recruiter';
  $('profileName').textContent = name;
  $('profileCompany').textContent = r.company_name || 'No company name yet';

  // Avatar: profile picture if there is one, otherwise initials
  const avatar = $('avatar');
  avatar.textContent = initials(name);
  if (r.profile_url) {
    const { data } = supabase.storage.from('recruiter-profile-pics').getPublicUrl(r.profile_url);
    if (data?.publicUrl) {
      const img = new Image();
      img.alt = '';
      img.onload = () => { avatar.textContent = ''; avatar.appendChild(img); };
      img.src = data.publicUrl;
    }
  }

  if (!$('jobCompany').value) $('jobCompany').value = r.company_name || '';

  const info = accessInfo(r);
  const value = $('creditsValue');
  value.className = 'value';
  if (info.unlimited) {
    $('creditsLabel').textContent = 'Monthly plan';
    value.textContent = 'Unlimited';
    value.classList.add('plan');
    $('creditsSub').textContent = 'Active until ' + fmtDate(info.until) + '.';
  } else {
    $('creditsLabel').textContent = 'Job credits';
    value.textContent = info.credits;
    if (info.credits <= 0) value.classList.add('none');
    else if (info.credits <= 2) value.classList.add('low');
    $('creditsSub').textContent = 'One credit posts one job.';
  }

  // Posting and viewing graduates need a credit or an active plan
  $('postJobBtn').disabled = !info.hasAccess || posting;
  $('noCreditsNotice').hidden = info.hasAccess;
  const grads = $('graduatesLink');
  grads.classList.toggle('locked', !info.hasAccess);
  grads.setAttribute('aria-disabled', String(!info.hasAccess));
  grads.tabIndex = info.hasAccess ? 0 : -1;
}

async function init() {
  try {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session?.user) return goLogin();
    userId = session.user.id;

    const r = await loadRecruiter();
    if (!r) {
      return blocked('We could not find your profile', 'Your login works, but there is no recruiter profile attached to it. Please contact support.');
    }
    recruiter = r;

    const status = statusOf(r);
    if (status === 'pending') {
      return blocked('Your account is waiting for approval', 'We check every recruiter before they can post jobs. You will be able to use your dashboard as soon as an admin approves your account.');
    }
    if (status !== 'approved') {
      return blocked('Your account is not active', 'Your recruiter access has been turned off. Please contact support if you think this is a mistake.');
    }

    render(r);
    show('app');
  } catch (err) {
    console.error('Dashboard load error:', err);
    blocked('Something went wrong', 'We could not load your dashboard: ' + (err.message || 'please refresh the page.'));
  }
}

/* ---------- Post a job ---------- */
const fields = ['jobTitle', 'location', 'jobCompany', 'jobType', 'description', 'requiredQualifications'];

$('jobForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  if (posting) return;
  setFormMsg('');
  fields.forEach(id => $(id).classList.remove('invalid'));

  const v = Object.fromEntries(fields.map(id => [id, $(id).value.trim()]));
  const empty = fields.find(id => !v[id]);
  if (empty) {
    $(empty).classList.add('invalid');
    $(empty).focus();
    return setFormMsg('Please fill in every field.', 'error');
  }
  if (!$('declaration').checked) {
    $('declaration').focus();
    return setFormMsg('Please tick the declaration before you post.', 'error');
  }

  posting = true;
  $('postJobBtn').disabled = true;
  $('postJobBtn').textContent = 'Posting...';

  try {
    // The database checks approval and credits, saves the job and takes the credit in one step
    const { error } = await supabase.rpc('post_job', {
      p_title: v.jobTitle,
      p_location: v.location,
      p_job_type: v.jobType,
      p_description: v.description,
      p_company_name: v.jobCompany,
      p_required_qualifications: v.requiredQualifications
    });
    if (error) throw error;

    const before = accessInfo(recruiter);
    recruiter = (await loadRecruiter()) || recruiter;
    const after = accessInfo(recruiter);

    $('jobForm').reset();
    $('jobCompany').value = recruiter.company_name || v.jobCompany;
    setFormMsg('');
    toast(before.unlimited ? 'Job posted.' : `Job posted. 1 credit used, ${after.credits} left.`);
  } catch (err) {
    console.error('Post job error:', err);
    setFormMsg(err.message || 'Could not post the job. Please try again.', 'error');
    // The credit balance on screen may be out of date, so refresh it
    try { recruiter = (await loadRecruiter()) || recruiter; } catch { /* keep what we have */ }
  } finally {
    posting = false;
    $('postJobBtn').textContent = 'Post job';
    render(recruiter);
  }
});

/* ---------- Buttons ---------- */
$('buyCreditsBtn').addEventListener('click', () => { window.location.href = 'recruiters-buycredits.html'; });
$('viewMyJobsBtn').addEventListener('click', () => { window.location.href = 'my-post.html'; });

async function logout() {
  loggingOut = true;
  await supabase.auth.signOut();
  window.location.href = HOME_PAGE;
}
$('logoutBtn').addEventListener('click', logout);
$('blockedLogout').addEventListener('click', logout);

// If the session ends in another tab, send the recruiter to the login page
supabase.auth.onAuthStateChange((event) => {
  if (event === 'SIGNED_OUT' && !loggingOut) goLogin();
});

init();
