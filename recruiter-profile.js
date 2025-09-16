import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js/+esm';

const SUPABASE_URL = 'https://euclknvsppptbfclwxqq.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImV1Y2xrbnZzcHBwdGJmY2x3eHFxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTc2Mjc2NTQsImV4cCI6MjA3MzIwMzY1NH0.HlGW3kZJ4CPnF2JuZGs_4ObkhxwVFTSedb7O8HHDEag';
const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

// Elements
const nameInput = document.getElementById('name');
const emailInput = document.getElementById('email');
const companyInput = document.getElementById('company');
const creditsEl = document.getElementById('credits');
const profilePicInput = document.getElementById('profilePic');
const profilePicPreview = document.getElementById('profilePicPreview');
const saveBtn = document.getElementById('saveBtn');
const logoutBtn = document.getElementById('logoutBtn');

let currentUserId = null;

// ---------------- AUTH CHECK ----------------
// ---------------- AUTH CHECK ----------------
async function checkUser() {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session?.user) {
    alert("Please log in first.");
    window.location.href = "recruiter-login.html";
    return;
  }

  currentUserId = session.user.id;

  // Fill email immediately from session
  emailInput.value = session.user.email;

  // Load the profile data
  await loadProfile();

  // Disable editing AFTER loading values
  const disabledFields = [nameInput, emailInput, companyInput];
  // Disable editing completely
nameInput.readOnly = true;
emailInput.readOnly = true;
companyInput.readOnly = true;

  disabledFields.forEach(field => {
    field.readOnly = true;
    field.style.backgroundColor = "#f0f0f0"; // light gray
    field.style.cursor = "not-allowed";
  });
}



checkUser();




// ---------------- LOAD PROFILE ----------------
async function loadProfile() {
  const { data, error } = await supabase
    .from('recruiters')
    .select('*')
    .eq('id', currentUserId)
    .single();

  if (error) return console.error("Failed to load profile:", error);

  nameInput.value = `${data.first_name} ${data.last_name}`;
  companyInput.value = data.company_name || '';
  creditsEl.textContent = data.credits || 0;

  if (data.profile_url) {
    // Get public URL for the stored profile pic
    const { data: urlData, error: urlError } = supabase
      .storage.from('recruiter-profile-pics')
      .getPublicUrl(data.profile_url);

    if (urlError) console.error(urlError);
    else {
      profilePicPreview.src = urlData.publicUrl;
      profilePicPreview.style.display = 'block';
    }
  }
}

// ---------------- FILENAME SANITIZATION ----------------
function sanitizeFileName(name) {
  return name.replace(/\s+/g, '_').replace(/[^\w.-]/g, '');
}

// ---------------- PROFILE PICTURE PREVIEW & UPLOAD ----------------
profilePicInput.addEventListener('change', async () => {
  const file = profilePicInput.files[0];
  if (!file || !['image/png','image/jpeg'].includes(file.type)) {
    alert("Invalid file type. Only PNG or JPEG allowed.");
    return;
  }

  // Preview locally
  const reader = new FileReader();
  reader.onload = e => {
    profilePicPreview.src = e.target.result;
    profilePicPreview.style.display = 'block';
  };
  reader.readAsDataURL(file);

  // Upload to Supabase Storage
  const filePath = `${currentUserId}/${sanitizeFileName(file.name)}`;
  const { error } = await supabase.storage
    .from('recruiter-profile-pics')
    .upload(filePath, file, { upsert: true });

  if (error) return alert("Upload failed: " + error.message);

  // Update profile_url in table
  const { error: updateError } = await supabase
    .from('recruiters')
    .update({ profile_url: filePath })
    .eq('id', currentUserId);

  if (updateError) console.error("Failed to update profile URL:", updateError);
});

// ---------------- SAVE PROFILE ----------------
// ---------------- SAVE PROFILE ----------------
saveBtn.addEventListener('click', async () => {
  // Only update password if entered
  const passwordInput = document.getElementById('password').value.trim();

  if (passwordInput) {
    const { error: pwError } = await supabase.auth.updateUser({
      password: passwordInput
    });

    if (pwError) return alert("Failed to update password: " + pwError.message);
  }

  alert("Profile updated successfully!");
  await loadProfile(); // refresh profile pic/credits if needed
});


// ---------------- LOGOUT ----------------
logoutBtn.addEventListener('click', async () => {
  await supabase.auth.signOut();
  window.location.href = 'homepage.html';
});
