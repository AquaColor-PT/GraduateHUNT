import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js/+esm';

const SUPABASE_URL = 'https://euclknvsppptbfclwxqq.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImV1Y2xrbnZzcHBwdGJmY2x3eHFxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTc2Mjc2NTQsImV4cCI6MjA3MzIwMzY1NH0.HlGW3kZJ4CPnF2JuZGs_4ObkhxwVFTSedb7O8HHDEag';
const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

const logoutBtn = document.getElementById('logoutBtn');
const profilePic = document.getElementById('profilePic');
const profileName = document.getElementById('profileName');
const profileEmail = document.getElementById('profileEmail');
const profilePhone = document.getElementById('profilePhone');
const profileSkills = document.getElementById('profileSkills');
const cvLink = document.getElementById('cvLink');
const messageBadge = document.getElementById('messageBadge');

async function loadProfile() {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) return window.location.href = 'homepage.html';
  const userId = session.user.id;

  const { data, error } = await supabase.from('graduates')
    .select('*')
    .eq('id', userId)
    .single();

  if (error) { console.error("Error fetching profile:", error); return; }

  profilePic.src = data.profile_pic_url || 'https://via.placeholder.com/120';
  profileName.textContent = data.full_name || '';
  profileEmail.textContent = data.email || '';
  profilePhone.textContent = data.phone || '';

  profileSkills.innerHTML = '';
  if (data.skills) {
    data.skills.split(',').forEach(skill => {
      const tag = document.createElement('div');
      tag.className = 'skill-tag';
      tag.textContent = skill.trim();
      profileSkills.appendChild(tag);
    });
  } else {
    profileSkills.textContent = 'No skills added';
  }

  if (data.cv_url) {
    try {
      const { data: signedData, error: signedError } = await supabase
        .storage
        .from('cv_bucket')
        .createSignedUrl(`graduates/${userId}/${data.cv_url}`, 60);
      if (signedError) throw signedError;
      cvLink.href = signedData.signedUrl;
      cvLink.target = "_blank";
      cvLink.textContent = "View CV";
    } catch (err) {
      console.error("Failed to get CV signed URL:", err);
      cvLink.href = "#";
      cvLink.textContent = "CV not available";
    }
  } else {
    cvLink.href = "#";
    cvLink.textContent = "No CV uploaded";
  }

  checkNewMessages(userId);
  subscribeNewMessages(userId);
}

logoutBtn.addEventListener('click', async () => {
  await supabase.auth.signOut();
  window.location.href = 'homepage.html';
});

async function checkNewMessages(userId) {
  try {
    const { data: messages, error } = await supabase
      .from('messages')
      .select('id')
      .eq('student_id', userId)
      .eq('status', 'unread');

    if (error) throw error;

    messageBadge.style.display = (messages && messages.length > 0) ? 'inline-block' : 'none';
  } catch (err) { console.error("Failed to check new messages:", err); }
}

function subscribeNewMessages(userId) {
  supabase
    .channel('graduate-messages')
    .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages', filter: `student_id=eq.${userId}` }, payload => {
      messageBadge.style.display = 'inline-block';
    })
    .subscribe();
}

loadProfile();
