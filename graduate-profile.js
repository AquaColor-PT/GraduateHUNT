import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm';

const SUPABASE_URL = 'https://euclknvsppptbfclwxqq.supabase.co';
const SUPABASE_KEY = 'sb_publishable_90JbyFsa4BuuyeuLCIActg_yXfbHQ30';
const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

const $ = (id) => document.getElementById(id);
const nameInput = $('name');
const emailEl = $('email');
const phoneInput = $('phone');
const dobInput = $('dob');
const genderInput = $('gender');
const raceInput = $('race');
const qualificationInput = $('qualification');
const skillsInput = $('skills');
const skillChips = $('skillChips');
const profilePicInput = $('profilePic');
const saveBtn = $('saveBtn');
const logoutBtn = $('logoutBtn');

const MAX_PIC = 5 * 1024 * 1024;     // 5 MB
const MAX_DOC = 10 * 1024 * 1024;    // 10 MB

const PDF_ONLY = ['application/pdf'];
const PDF_OR_IMG = ['application/pdf', 'image/png', 'image/jpeg'];

// One config per document (all stored in the private cv_bucket)
const DOCS = {
  cv: {
    input: $('cvFile'), nameEl: $('cvFileName'), box: $('currentCv'), curEl: $('currentCvName'), link: $('cvLink'),
    col: 'cv_url', folder: '', types: PDF_ONLY, label: 'CV', current: null
  },
  id: {
    input: $('idFile'), nameEl: $('idFileName'), box: $('currentId'), curEl: $('currentIdName'), link: $('idLink'),
    col: 'id_doc_url', folder: 'id/', types: PDF_OR_IMG, label: 'ID copy', current: null
  },
  qual: {
    input: $('qualFile'), nameEl: $('qualFileName'), box: $('currentQual'), curEl: $('currentQualName'), link: $('qualLink'),
    col: 'qualification_doc_url', folder: 'qualification/', types: PDF_OR_IMG, label: 'Qualification certificate', current: null
  }
};
const TOTAL = 11; // name, phone, dob, gender, race, qualification, skills, picture, CV, ID, certificate

let currentUserId = null;
let currentEmail = '';
let currentPicUrl = null;            // clean URL stored in the database
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

function calcAge(dobStr) {
  if (!dobStr) return null;
  const dob = new Date(dobStr);
  if (isNaN(dob)) return null;
  const now = new Date();
  let age = now.getFullYear() - dob.getFullYear();
  const m = now.getMonth() - dob.getMonth();
  if (m < 0 || (m === 0 && now.getDate() < dob.getDate())) age--;
  return age;
}

function refreshAge() {
  const age = calcAge(dobInput.value);
  $('ageHint').textContent = age !== null && age >= 0
    ? `You are ${age} years old.`
    : 'Used to check age requirements.';
}

function refreshDocs() {
  Object.values(DOCS).forEach(d => {
    const picked = d.input.files[0];
    d.nameEl.textContent = picked ? picked.name : 'No file selected';
    d.box.hidden = !d.current;
    d.curEl.textContent = d.current || '';
  });
}

function refreshProgress() {
  const done = [
    nameInput.value.trim(),
    phoneInput.value.trim(),
    dobInput.value,
    genderInput.value,
    raceInput.value,
    qualificationInput.value.trim(),
    skillsInput.value.trim(),
    profilePicInput.files[0] || currentPicUrl,
    ...Object.values(DOCS).map(d => d.input.files[0] || d.current)
  ].filter(Boolean).length;
  $('progressBar').style.width = (done / TOTAL * 100) + '%';
  $('progressText').textContent = `Profile ${done} of ${TOTAL} complete`;
  $('progressTrack').setAttribute('aria-valuemax', TOTAL);
  $('progressTrack').setAttribute('aria-valuenow', done);
}

function refreshAll() { refreshHeader(); renderChips(); refreshDocs(); refreshAge(); refreshProgress(); }

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
    dobInput.value = data.date_of_birth || '';
    genderInput.value = data.gender || '';
    raceInput.value = data.race || '';
    qualificationInput.value = data.qualification || '';
    skillsInput.value = data.skills || '';
    currentPicUrl = data.profile_pic_url || null;
    Object.values(DOCS).forEach(d => { d.current = data[d.col] || null; });
    setAvatar(currentPicUrl);
  }
  refreshAll();
}

/* ---------- Live updates ---------- */
[nameInput, phoneInput, dobInput, genderInput, raceInput, qualificationInput, skillsInput]
  .forEach(el => el.addEventListener('input', refreshAll));

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

Object.values(DOCS).forEach(d => {
  d.input.addEventListener('change', () => {
    const file = d.input.files[0];
    if (file && !d.types.includes(file.type)) {
      toast(`${d.label}: please upload a ${d.types === PDF_ONLY ? 'PDF' : 'PDF, JPG or PNG'}.`, 'error');
      d.input.value = '';
    } else if (file && file.size > MAX_DOC) {
      toast(`${d.label} is too big. Please use a file under 10 MB.`, 'error');
      d.input.value = '';
    }
    refreshDocs();
    refreshProgress();
  });
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

  if (dobInput.value) {
    const age = calcAge(dobInput.value);
    if (age === null || age < 14 || age > 100) {
      toast('Please enter a valid date of birth.', 'error');
      dobInput.focus();
      return;
    }
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

    // Documents (CV, ID, qualification certificate)
    const docNames = {};
    for (const d of Object.values(DOCS)) {
      docNames[d.col] = d.current;
      const file = d.input.files[0];
      if (file) {
        const name = safeName(file.name);
        await upload('cv_bucket', `graduates/${currentUserId}/${d.folder}${name}`, file);
        docNames[d.col] = name;
      }
    }

    const { error: upsertError } = await supabase.from('graduates').upsert({
      id: currentUserId,
      email: currentEmail,
      full_name: fullName,
      phone: phoneInput.value.trim(),
      date_of_birth: dobInput.value || null,
      gender: genderInput.value || null,
      race: raceInput.value || null,
      qualification,
      skills: skillsInput.value.trim(),
      profile_pic_url: picUrl,
      ...docNames                       // cv_url, id_doc_url, qualification_doc_url
    });
    if (upsertError) throw upsertError;

    currentPicUrl = picUrl;
    Object.values(DOCS).forEach(d => { d.current = docNames[d.col]; d.input.value = ''; });
    profilePicInput.value = '';
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

/* ---------- View documents (signed links) ---------- */
Object.values(DOCS).forEach(d => {
  d.link.addEventListener('click', async (e) => {
    e.preventDefault();
    if (!d.current) { toast(`No ${d.label} uploaded yet.`, 'error'); return; }

    // Open the tab first, inside the click, so phone browsers don't block the pop-up
    const tab = window.open('', '_blank');
    try {
      const { data: { session }, error: sessionError } = await supabase.auth.getSession();
      if (sessionError || !session?.user) throw new Error('You are not logged in.');

      const { data, error } = await supabase.storage
        .from('cv_bucket')
        .createSignedUrl(`graduates/${session.user.id}/${d.folder}${d.current}`, 60);
      if (error) throw error;

      if (tab) tab.location.href = data.signedUrl;
      else window.location.href = data.signedUrl;
    } catch (err) {
      if (tab) tab.close();
      console.error(`Failed to open ${d.label}:`, err);
      toast(`Could not open your ${d.label}: ` + (err.message || 'Please try again.'), 'error');
    }
  });
});

/* ---------- Logout ---------- */
logoutBtn.addEventListener('click', async () => {
  await supabase.auth.signOut();
  window.location.href = 'homepage.html';
});

loadProfile();
