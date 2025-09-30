import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js/+esm';


const SUPABASE_URL = 'https://euclknvsppptbfclwxqq.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImV1Y2xrbnZzcHBwdGJmY2x3eHFxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTc2Mjc2NTQsImV4cCI6MjA3MzIwMzY1NH0.HlGW3kZJ4CPnF2JuZGs_4ObkhxwVFTSedb7O8HHDEag';
const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

// Elements
const nameInput = document.getElementById('name');
const emailEl = document.getElementById('email');
const phoneInput = document.getElementById('phone');
const qualificationInput = document.getElementById('qualification');
const skillsInput = document.getElementById('skills');
const cvLinkEl = document.getElementById('cvLink');
const cvFileInput = document.getElementById('cvFile');
const profilePicInput = document.getElementById('profilePic');
const profilePicPreview = document.getElementById('profilePicPreview');
const saveBtn = document.getElementById('saveBtn');
const logoutBtn = document.getElementById('logoutBtn');

let currentUserId = null;

// Load profile
async function loadProfile() {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) return window.location.href = 'graduate-login.html';

  currentUserId = session.user.id;
  emailEl.textContent = session.user.email;

  const { data, error } = await supabase
    .from('graduates')
    .select('*')
    .eq('id', currentUserId)
    .single();

  if (error) {
    console.error("Error fetching profile:", error);
    return;
  }

  nameInput.value = data.full_name || '';
  phoneInput.value = data.phone || '';
  qualificationInput.value = data.qualification || '';
  skillsInput.value = data.skills || '';
  
  // CV
  cvLinkEl.dataset.filename = data.cv_url || '';

  // Profile picture
  if (data.profile_pic_url) {
    profilePicPreview.src = data.profile_pic_url;
    profilePicPreview.style.display = 'block';
  }
}

// Upload helper
async function uploadFile(file, folder, allowedTypes) {
  if (!file) return null;
  if (!allowedTypes.includes(file.type)) {
    alert(`Invalid file type: ${file.type}`);
    return null;
  }

  const filePath = `${folder}/${currentUserId}/${file.name}`;
  const { error } = await supabase.storage.from(folder).upload(filePath, file, { upsert: true });
  if (error) throw error;

  const { data } = supabase.storage.from(folder).getPublicUrl(filePath);
  return data.publicUrl;
}

// Live preview for profile picture
profilePicInput.addEventListener('change', () => {
  const file = profilePicInput.files[0];
  if (file && ['image/png','image/jpeg'].includes(file.type)) {
    const reader = new FileReader();
    reader.onload = e => {
      profilePicPreview.src = e.target.result;
      profilePicPreview.style.display = 'block';
    };
    reader.readAsDataURL(file);
  }
});

// Save updates
saveBtn.addEventListener('click', async () => {
  try {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session?.user) throw new Error("User not logged in.");
    currentUserId = session.user.id;
    const userEmail = session.user.email;

    // Upload profile picture
    const profilePicUrl = await uploadFile(profilePicInput.files[0], 'profile_pics', ['image/png', 'image/jpeg']) 
      || profilePicPreview.src;

    // Upload CV
    let cvFileName = cvLinkEl.dataset.filename || null;
    const cvFile = cvFileInput.files[0];
    if (cvFile) {
      if (cvFile.type !== 'application/pdf') {
        alert("Please upload a PDF file.");
        return;
      }

      const filePath = `graduates/${currentUserId}/${cvFile.name}`;
      const { error: storageError } = await supabase.storage
        .from('cv_bucket')
        .upload(filePath, cvFile, { upsert: true });

      if (storageError) throw storageError;

      cvFileName = cvFile.name;
    }

    // Upsert profile data
    const { error: upsertError } = await supabase.from('graduates').upsert({
      id: currentUserId,
      email: userEmail,
      full_name: nameInput.value.trim(),
      phone: phoneInput.value.trim(),
      qualification: qualificationInput.value.trim(),
      skills: skillsInput.value.trim(),
      cv_url: cvFileName,
      profile_pic_url: profilePicUrl
    });

    if (upsertError) throw upsertError;

    cvLinkEl.dataset.filename = cvFileName;
    profilePicPreview.src = profilePicUrl;
    profilePicPreview.style.display = 'block';

    alert("Profile updated successfully!");
  } catch (err) {
    console.error("Update failed:", err);
    alert("Update failed: " + err.message);
  }
});

// Dynamic CV download using signed URL
cvLinkEl.addEventListener('click', async (e) => {
  e.preventDefault();

  const fileName = cvLinkEl.dataset.filename;
  if (!fileName) return alert("No CV uploaded.");

  try {
    const { data: { session }, error: sessionError } = await supabase.auth.getSession();
    if (sessionError || !session?.user) throw new Error("User not logged in.");

    const filePath = `graduates/${session.user.id}/${fileName}`;
    const { data: signedData, error: signedError } = await supabase.storage
      .from('cv_bucket')
      .createSignedUrl(filePath, 60);

    if (signedError) throw signedError;

    window.open(signedData.signedUrl, '_blank');
  } catch (err) {
    console.error("Failed to download CV:", err);
    alert("Failed to download CV: " + err.message);
  }
});

// Logout
logoutBtn.addEventListener('click', async () => {
  await supabase.auth.signOut();
  window.location.href = 'homepage.html';
});

// Initialize
loadProfile();
