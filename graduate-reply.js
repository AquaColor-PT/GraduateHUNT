import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js/+esm';

const SUPABASE_URL = 'https://euclknvsppptbfclwxqq.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImV1Y2xrbnZzcHBwdGJmY2x3eHFxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTc2Mjc2NTQsImV4cCI6MjA3MzIwMzY1NH0.HlGW3kZJ4CPnF2JuZGs_4ObkhxwVFTSedb7O8HHDEag';
const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

// Elements
const gradNameEl = document.getElementById('gradName');
const gradEmailEl = document.getElementById('gradEmail');
const gradPhoneEl = document.getElementById('gradPhone');
const replyText = document.getElementById('replyText');
const sendReplyBtn = document.getElementById('sendReplyBtn');
const fileInput = document.getElementById('fileInput');
const chatMessages = document.getElementById('chatMessages');
const feedback = document.getElementById('feedback');

// URL params
const urlParams = new URLSearchParams(window.location.search);
const studentId = urlParams.get('studentId');
const jobId = urlParams.get('jobId');
const jobTitleFromURL = urlParams.get('jobTitle');

if (!studentId || !jobId) {
  chatMessages.innerHTML = '<p style="text-align:center;color:red;">Cannot load chat without graduate ID and job ID.</p>';
}

let loadedMessages = new Set(); // prevent duplicates

// Render a single message
function renderMessage(msg) {
  if (loadedMessages.has(msg.id)) return;
  loadedMessages.add(msg.id);

  const div = document.createElement('div');
  div.className = `message ${msg.sender === 'recruiter' ? 'recruiter' : 'student'}`;
  let content = msg.message || '';
  if (msg.file_url) {
    content += `<a href="${msg.file_url}" target="_blank" class="file-link">${msg.file_name}</a>`;
  }
  const timestamp = msg.created_at
    ? new Date(msg.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    : '';
  div.innerHTML = `<div>${content}</div><div style="font-size:10px;color:#555;margin-top:3px;text-align:right">${timestamp}</div>`;
  chatMessages.appendChild(div);
  chatMessages.scrollTop = chatMessages.scrollHeight;
}

// Load graduate info
async function loadGraduateInfo() {
  try {
    const { data: student, error } = await supabase
      .from('graduates')
      .select('*')
      .eq('id', studentId)
      .single();
    if (error) throw error;

    gradNameEl.textContent = student.full_name || 'Unknown';
    gradEmailEl.textContent = student.email || 'N/A';
    gradPhoneEl.textContent = student.phone || 'N/A';
  } catch (err) {
    gradNameEl.textContent = gradEmailEl.textContent = gradPhoneEl.textContent = 'Error loading graduate info';
    console.error("Failed to load graduate info:", err);
  }
}

// Load messages
async function loadMessages() {
  try {
    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError || !user) throw new Error("Recruiter not logged in");

    const { data: messages, error } = await supabase
      .from('messages')
      .select('*')
      .eq('student_id', studentId)
      .eq('job_id', jobId)
      .order('created_at', { ascending: true });
    if (error) throw error;

    messages.forEach(renderMessage);
  } catch (err) {
    console.error("Failed to load messages:", err);
  }
}

// Send message
sendReplyBtn.addEventListener('click', async () => {
  const message = replyText.value.trim();
  const file = fileInput.files[0];
  if (!message && !file) {
    feedback.innerHTML = '<p class="error">Enter a message or select a file.</p>';
    return;
  }
  feedback.innerHTML = '';

  try {
    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError || !user) throw new Error("Recruiter not logged in");

    let fileData = {};
    if (file) {
      const fileName = `graduates/${studentId}/${jobId}/${Date.now()}_${file.name}`;
      const { error: uploadError } = await supabase.storage.from('attachments').upload(fileName, file, { upsert: true });
      if (uploadError) throw uploadError;
      const { data: publicUrlData } = supabase.storage.from('attachments').getPublicUrl(fileName);
      fileData = { file_url: publicUrlData.publicUrl, file_name: file.name };
    }

    const { data: inserted, error: insertError } = await supabase.from('messages').insert([{
      student_id: studentId,
      recruiter_id: user.id,
      job_id: jobId,
      job_title: jobTitleFromURL || 'Job Post',
      message,
      sender: 'recruiter',
      status: 'unread',
      student_deleted: false,
      recruiter_deleted: false,
      created_at: new Date(),
      ...fileData
    }]).select();
    if (insertError) throw insertError;

    renderMessage(inserted[0]);
    replyText.value = '';
    fileInput.value = '';
    feedback.innerHTML = '<p class="success">Message sent!</p>';

  } catch (err) {
    feedback.innerHTML = `<p class="error">Failed to send: ${err.message}</p>`;
    console.error(err);
  }
});

// Realtime subscription
async function subscribeRealtime() {
  const { data: { user } } = await supabase.auth.getUser();
  supabase
    .channel(`graduate-chat-${studentId}-${jobId}`)
    .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages', filter: `student_id=eq.${studentId}` }, payload => {
      const newMsg = payload.new;
      if (newMsg.job_id == jobId && !loadedMessages.has(newMsg.id)) renderMessage(newMsg);
    })
    .subscribe();
}

// Auto-refresh messages every 15 seconds
setInterval(loadMessages, 15000);

// Initialize
document.addEventListener('DOMContentLoaded', () => {
  loadGraduateInfo();
  loadMessages();
  subscribeRealtime();
});
