import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm';

const SUPABASE_URL = 'https://euclknvsppptbfclwxqq.supabase.co';
const SUPABASE_KEY = 'sb_publishable_90JbyFsa4BuuyeuLCIActg_yXfbHQ30';
const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

const LOGIN_PAGE = 'recruiter-login.html';
const HOME_PAGE = 'homepage.html';
const DASHBOARD_PAGE = 'recruiter-dashboard.html';
const BUCKET = 'recruiter-profile-pics';
const MAX_PIC_BYTES = 2 * 1024 * 1024;
const PIC_TYPES = { 'image/png': 'png', 'image/jpeg': 'jpg' };

const $ = (id) => document.getElementById(id);

let userId = null;
let recruiter = null;
let pendingFile = null;
let saving = false;
let loggingOut = false;

/* ---------- Helpers ---------- */
function setMsg(text, type = '') {
  $('msg').textContent = text;
  $('msg').className = type;
}

function statusOf(r) {
  return r.status || (r.verified ? 'approved' : 'pending');
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

function showView(view, text) {
  $('loadingView').hidden = view !== 'loading';
  $('errorView').hidden = view !== 'error';
  $('appView').hidden = view !== 'app';
  if (text) $('errorText').textContent = text;
}

function showImage(url) {
  const avatar = $('avatar');
  const img = new Image();
  img.alt = '';
  img.onload = () => { avatar.textContent = ''; avatar.appendChild(img); };
  img.src = url;
}

/* ---------- Load and render ---------- */
async function loadRecruiter() {
  const { data, error } = await supabase.from('recruiters').select('*').eq('id', userId).maybeSingle();
  if (error) throw error;
  return data;
}

function render(r, authEmail) {
  const name = `${r.first_name || ''} ${r.last_name || ''}`.trim() || 'Recruiter';
  $('factName').textContent = name;
  $('factEmail').textContent = authEmail || r.email || 'Not provided';
  $('factCompany').textContent = r.company_name || 'Not provided';
  $('factReg').textContent = r.registration_number || 'Not provided';

  $('avatar').textContent = initials(name);
  if (r.profile_url) {
    const { data } = supabase.storage.from(BUCKET).getPublicUrl(r.profile_url);
    // The picture keeps the same file name each time, so a timestamp stops the browser showing an old copy
    if (data?.publicUrl) showImage(data.publicUrl + '?t=' + Date.now());
  }

  const until = r.unlimited_until ? new Date(r.unlimited_until) : null;
  if (until && until > new Date()) {
    $('creditsLabel').textContent = 'Monthly plan';
    $('creditsValue').textContent = 'Unlimited';
    $('creditsValue').classList.add('plan');
    $('creditsSub').textContent = 'Active until ' + fmtDate(until) + '.';
  } else {
    $('creditsLabel').textContent = 'Job credits';
    $('creditsValue').textContent = Number(r.credits) || 0;
    $('creditsValue').classList.remove('plan');
    $('creditsSub').textContent = 'One credit posts one job.';
  }
}

async function init() {
  const slow = setTimeout(() => {
    if (!$('loadingView').hidden) showView('error', 'This is taking too long. Check your internet connection and refresh the page.');
  }, 15000);
  try {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session?.user) { window.location.href = LOGIN_PAGE; return; }
    userId = session.user.id;

    const r = await loadRecruiter();
    if (!r) return showView('error', 'We could not find your recruiter profile. Please contact support.');
    // Pending and rejected recruiters see the explanation on the dashboard instead
    if (statusOf(r) !== 'approved') { window.location.href = DASHBOARD_PAGE; return; }

    recruiter = r;
    render(r, session.user.email);
    showView('app');
  } catch (err) {
    console.error('Profile load error:', err);
    showView('error', 'We could not load your profile: ' + (err.message || 'please refresh the page.'));
  } finally {
    clearTimeout(slow);
  }
}

/* ---------- Picture: choose now, upload when saving ---------- */
$('profilePic').addEventListener('change', () => {
  const file = $('profilePic').files[0];
  pendingFile = null;
  setMsg('');
  if (!file) return;

  if (!PIC_TYPES[file.type]) {
    $('profilePic').value = '';
    return setMsg('Please choose a PNG or JPG picture.', 'error');
  }
  if (file.size > MAX_PIC_BYTES) {
    $('profilePic').value = '';
    return setMsg('That picture is too big. The limit is 2 MB.', 'error');
  }

  pendingFile = file;
  showImage(URL.createObjectURL(file));
  setMsg('Picture ready. Select Save changes to apply it.');
});

async function savePicture() {
  // One fixed file name per recruiter, so old pictures are replaced and do not pile up
  const path = `${userId}/avatar.${PIC_TYPES[pendingFile.type]}`;
  const { error } = await supabase.storage
    .from(BUCKET)
    .upload(path, pendingFile, { upsert: true, contentType: pendingFile.type });
  if (error) throw error;

  const oldPath = recruiter.profile_url;
  const { error: updateError } = await supabase.from('recruiters').update({ profile_url: path }).eq('id', userId);
  if (updateError) throw updateError;

  // Tidy up the old file if it had a different name (for example an earlier PNG when this one is a JPG)
  if (oldPath && oldPath !== path) await supabase.storage.from(BUCKET).remove([oldPath]);

  recruiter.profile_url = path;
  pendingFile = null;
  $('profilePic').value = '';
}

/* ---------- Password ---------- */
function passwordProblem(pw, confirm) {
  if (pw.length < 8) return 'Your new password needs at least 8 characters.';
  if (pw !== confirm) return 'The two passwords do not match.';
  return '';
}

async function savePassword(pw) {
  const { error } = await supabase.auth.updateUser({ password: pw });
  if (error) throw error;
  $('newPassword').value = '';
  $('confirmPassword').value = '';
}

function friendlyPasswordError(err) {
  const m = err.message || '';
  if (/same|different from the old/i.test(m)) return 'Choose a password you have not used before.';
  if (/reauth|recently/i.test(m)) return 'For security, log out, log in again, then change your password.';
  return m || 'Could not change the password.';
}

/* ---------- Save ---------- */
$('saveBtn').addEventListener('click', async () => {
  if (saving) return;
  const pw = $('newPassword').value;
  const confirm = $('confirmPassword').value;

  if (!pendingFile && !pw) return setMsg('Nothing to save yet. Choose a picture or enter a new password.', 'error');
  if (pw) {
    const problem = passwordProblem(pw, confirm);
    if (problem) { $('newPassword').focus(); return setMsg(problem, 'error'); }
  }

  saving = true;
  $('saveBtn').disabled = true;
  $('saveBtn').textContent = 'Saving...';
  setMsg('');

  const done = [];
  const problems = [];

  if (pendingFile) {
    try { await savePicture(); done.push('Picture updated.'); }
    catch (err) { console.error('Picture error:', err); problems.push('Picture not saved: ' + (err.message || 'please try again.')); }
  }
  if (pw) {
    try { await savePassword(pw); done.push('Password changed.'); }
    catch (err) { console.error('Password error:', err); problems.push('Password not changed: ' + friendlyPasswordError(err)); }
  }

  setMsg([...done, ...problems].join(' '), problems.length ? 'error' : 'success');
  saving = false;
  $('saveBtn').disabled = false;
  $('saveBtn').textContent = 'Save changes';
});

/* ---------- Logout ---------- */
$('logoutBtn').addEventListener('click', async () => {
  loggingOut = true;
  await supabase.auth.signOut();
  window.location.href = HOME_PAGE;
});

// If the session ends in another tab, go to the login page
supabase.auth.onAuthStateChange((event) => {
  if (event === 'SIGNED_OUT' && !loggingOut) window.location.href = LOGIN_PAGE;
});

init();
