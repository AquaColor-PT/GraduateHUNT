import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm';

const SUPABASE_URL = 'https://euclknvsppptbfclwxqq.supabase.co';
const SUPABASE_KEY = 'sb_publishable_90JbyFsa4BuuyeuLCIActg_yXfbHQ30';
const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

const $ = (id) => document.getElementById(id);
const nameInput = $('name');
const emailEl = $('email');
const phoneInput = $('phone');
const qualificationInput = $('qualification');
const skillsInput = $('skills');
const skillChips = $('skillChips');
const cvLinkEl = $('cvLink');
const cvFileInput = $('cvFile');
const cvFileName = $('cvFileName');
const currentCv = $('currentCv');
const currentCvNameEl = $('currentCvName');
const profilePicInput = $('profilePic');
const saveBtn = $('saveBtn');
const logoutBtn = $('logoutBtn');

const MAX_PIC = 5 * 1024 * 1024;     // 5 MB
const MAX_CV = 10 * 1024 * 1024;     // 10 MB

let currentUserId = null;
let currentEmail = '';
let currentPicUrl = null;            // clean URL stored in the database
let currentCvName = null;            // CV file name stored in the database
let previewObjectUrl = null;

/* ---------- UI helpers ---------- */
let toastTimer;
function toast(message, type = 'success') {
  const el = $('toast');
  el.textContent = message;
  el.className = 'toast show ' + type;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.classList.remove('show'), type === 'error' ? 5000 : 3000);
}

function initials() {
  const words = nameInput.value.trim().split(/\s+/).filter(Boolean);
  if (words.length) return words.slice(0, 2).map(w => w[0]).join('').toUpperCase();
  return (currentEmail[0] || '?').toUpperCase();
}

function setAvatar(url) {
  [['avatar', 'profilePicPreview'], ['navAvatar', 'navAvatarImg']].forEach(([box, img]) => {
    const b = $(box), i = $(img);
    if (url) { i.src = url; b.classList.add('has-img'); }
    else { i.removeAttribute('src'); b.classList.remove('has-img'); }
  });
}
['profilePicPreview', 'navAvatarImg'].forEach(id => {
  $(id).addEventListener('error', () => $(id === 'navAvatarImg' ? 'navAvatar' : 'avatar').classList.remove('has-img'));
});

function refreshHeader() {
  $('displayName').textContent = nameInput.value.trim() || 'Your name';
  $('avatarInitials').textContent = initials();
  $('navInitials').textContent = initials();
}

function renderChips() {
  skillChips.innerHTML = '';
  skillsInput.value.split(',').map(s => s.trim()).filter(Boolean).slice(0, 20).forEach(skill => {
    const chip = document.createElement('span');
    chip.className = 'chip';
    chip.textContent = skill;
    skillChips.appendChild(chip);
  });
}

function refreshCv() {
  const picked = cvFileInput.files[0];
  cvFileName.textContent = picked ? picked.name : 'No file selected';
  currentCv.hidden = !currentCvName;
  currentCvNameEl.textContent = currentCvName || '';
}

function refreshProgress() {
  const done = [
    nameInput.value.trim(),
    phoneInput.value.trim(),
    qualificationInput.value.trim(),
    skillsInput.value.trim(),
    profilePicInput.files[0] || currentPicUrl,
    cvFileInput.files[0] || currentCvName
  ].filter(Boolean).length;
  $('progressBar').style.width = (done / 6 * 100) + '%';
  $('progressText').textContent = `Profile ${done} of 6 complete`;
  $('progressTrack').setAttribute('aria-valuenow', done);
}

function refreshAll() { refreshHeader(); renderChips(); refreshCv(); refreshProgress(); }

function safeName(name) {
  return name.replace(/[^A-Za-z0-9._-]+/g, '_');   // spaces/odd characters can break storage paths
}

/* ---------- Load profile ---------- */
async function loadProfile() {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) { window.location.href = 'graduate-login.html'; return; }

  currentUserId = session.user.id;
  currentEmail = session.user.email || '';
  emailEl.textContent = currentEmail;

  const { data, error } = await supabase
    .from('graduates')
    .select('*')
    .eq('id', currentUserId)
    .maybeSingle();                 // a brand-new graduate has no row yet; that is not an error

  if (error) {
    console.error('Error fetching profile:', error);
    toast('Could not load your profile: ' + error.message, 'error');
  }

  if (data) {
    nameInput.value = data.full_name || '';
    phoneInput.value = data.phone || '';
    qualificationInput.value = data.qualification || '';
    skillsInput.value = data.skills || '';
    currentCvName = data.cv_url || null;
    currentPicUrl = data.profile_pic_url || null;
    setAvatar(currentPicUrl);
  }
  refreshAll();
}

/* ---------- Live updates ---------- */
[nameInput, phoneInput, qualificationInput, skillsInput].forEach(el => el.addEventListener('input', refreshAll));

profilePicInput.addEventListener('change', () => {
  const file = profilePicInput.files[0];
  if (!file) return;
  if (!['image/png', 'image/jpeg'].includes(file.type)) {
    toast('Please choose a PNG or JPG picture.', 'error');
    profilePicInput.value = '';
    return;
  }
  if (file.size > MAX_PIC) {
    toast('That picture is too big. Please use one under 5 MB.', 'error');
    profilePicInput.value = '';
    return;
  }
  if (previewObjectUrl) URL.revokeObjectURL(previewObjectUrl);
  previewObjectUrl = URL.createObjectURL(file);
  setAvatar(previewObjectUrl);
  refreshProgress();
});

cvFileInput.addEventListener('change', () => {
  const file = cvFileInput.files[0];
  if (file && file.type !== 'application/pdf') {
    toast('Please upload your CV as a PDF.', 'error');
    cvFileInput.value = '';
  } else if (file && file.size > MAX_CV) {
    toast('That CV is too big. Please use a PDF under 10 MB.', 'error');
    cvFileInput.value = '';
  }
  refreshCv();
  refreshProgress();
});

/* ---------- Save ---------- */
async function upload(bucket, path, file) {
  const { error } = await supabase.storage.from(bucket).upload(path, file, { upsert: true });
  if (error) throw error;
}

saveBtn.addEventListener('click', async () => {
  const fullName = nameInput.value.trim();
  const qualification = qualificationInput.value.trim();

  if (!fullName) { toast('Please enter your full name.', 'error'); nameInput.focus(); return; }
  if (qualification.toLowerCase() === 'other') {
    toast('Please type your actual qualification instead of "Other".', 'error');
    qualificationInput.focus();
    return;
  }

  saveBtn.disabled = true;
  saveBtn.textContent = 'Saving...';

  try {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session?.user) throw new Error('You are not logged in.');
    currentUserId = session.user.id;
    currentEmail = session.user.email || currentEmail;

    // Profile picture
    let picUrl = currentPicUrl;
    let picChanged = false;
    const picFile = profilePicInput.files[0];
    if (picFile) {
      const path = `profile_pics/${currentUserId}/${safeName(picFile.name)}`;
      await upload('profile_pics', path, picFile);
      picUrl = supabase.storage.from('profile_pics').getPublicUrl(path).data.publicUrl;
      picChanged = true;
    }

    // CV
    let cvName = currentCvName;
    const cvFile = cvFileInput.files[0];
    if (cvFile) {
      const name = safeName(cvFile.name);
      await upload('cv_bucket', `graduates/${currentUserId}/${name}`, cvFile);
      cvName = name;
    }

    const { error: upsertError } = await supabase.from('graduates').upsert({
      id: currentUserId,
      email: currentEmail,
      full_name: fullName,
      phone: phoneInput.value.trim(),
      qualification,
      skills: skillsInput.value.trim(),
      cv_url: cvName,
      profile_pic_url: picUrl
    });
    if (upsertError) throw upsertError;

    currentPicUrl = picUrl;
    currentCvName = cvName;
    profilePicInput.value = '';
    cvFileInput.value = '';
    if (previewObjectUrl) { URL.revokeObjectURL(previewObjectUrl); previewObjectUrl = null; }
    // cache-buster so a replaced picture with the same file name shows straight away
    setAvatar(picUrl ? picUrl + (picChanged ? (picUrl.includes('?') ? '&' : '?') + 'v=' + Date.now() : '') : null);
    refreshAll();
    toast('Profile updated successfully!');
  } catch (err) {
    console.error('Update failed:', err);
    toast('Update failed: ' + (err.message || 'Please try again.'), 'error');
  } finally {
    saveBtn.disabled = false;
    saveBtn.textContent = 'Save Changes';
  }
});

/* ---------- View CV (signed link) ---------- */
cvLinkEl.addEventListener('click', async (e) => {
  e.preventDefault();
  if (!currentCvName) { toast('No CV uploaded yet.', 'error'); return; }

  // Open the tab first, inside the click, so phone browsers don't block the pop-up
  const tab = window.open('', '_blank');
  try {
    const { data: { session }, error: sessionError } = await supabase.auth.getSession();
    if (sessionError || !session?.user) throw new Error('You are not logged in.');

    const { data, error } = await supabase.storage
      .from('cv_bucket')
      .createSignedUrl(`graduates/${session.user.id}/${currentCvName}`, 60);
    if (error) throw error;

    if (tab) tab.location.href = data.signedUrl;
    else window.location.href = data.signedUrl;
  } catch (err) {
    if (tab) tab.close();
    console.error('Failed to open CV:', err);
    toast('Could not open your CV: ' + (err.message || 'Please try again.'), 'error');
  }
});

/* ---------- Logout ---------- */
logoutBtn.addEventListener('click', async () => {
  await supabase.auth.signOut();
  window.location.href = 'homepage.html';
});

loadProfile();
