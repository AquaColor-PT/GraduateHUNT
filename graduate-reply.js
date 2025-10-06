import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js/+esm';

const SUPABASE_URL = 'https://euclknvsppptbfclwxqq.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImV1Y2xrbnZzcHBwdGJmY2x3eHFxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTc2Mjc2NTQsImV4cCI6MjA3MzIwMzY1NH0.HlGW3kZJ4CPnF2JuZGs_4ObkhxwVFTSedb7O8HHDEag';
const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

// Elements
const recruiterNameEl = document.getElementById('recruiterName');
const jobTitleEl = document.getElementById('jobTitle');
const replyText = document.getElementById('replyText');
const sendReplyBtn = document.getElementById('sendReplyBtn');
const fileInput = document.getElementById('fileInput');
const chatMessages = document.getElementById('chatMessages');
const feedback = document.getElementById('feedback');

// URL Params
const urlParams = new URLSearchParams(window.location.search);
const recruiterId = urlParams.get('recruiterId');
const jobId = urlParams.get('jobId');
const jobTitleFromURL = urlParams.get('jobTitle');
const companyNameFromURL = urlParams.get('companyName');

recruiterNameEl.textContent = companyNameFromURL || 'Recruiter';
jobTitleEl.textContent = jobTitleFromURL || 'Job Post';

let loadedMessages = new Set(); // to prevent duplicates

// Render a single message
function renderMessage(msg) {
  const messageKey = `${msg.id}`;
  if (loadedMessages.has(messageKey)) return; // skip duplicates
  loadedMessages.add(messageKey);

  const div = document.createElement('div');
  div.className = `message ${msg.sender === 'student' ? 'student' : 'recruiter'}`;
  div.innerHTML = `
    <div>${msg.message || ''}</div>
    ${msg.file_url ? `<a href="${msg.file_url}" target="_blank" class="file-link">${msg.file_name}</a>` : ''}
  `;
  chatMessages.appendChild(div);
  chatMessages.scrollTop = chatMessages.scrollHeight;
}

// Load chat history
async function loadChat() {
  chatMessages.innerHTML = '<p style="text-align:center;color:#666;">Loading messages...</p>';
  try {
    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError || !user) throw new Error("Student not logged in");

    const { data: messages, error } = await supabase.from('messages')
      .select('*')
      .eq('student_id', user.id)
      .eq('recruiter_id', recruiterId)
      .eq('job_id', jobId)
      .order('created_at', { ascending: true });

    if (error) throw error;

    chatMessages.innerHTML = '';
    messages.forEach(renderMessage);

    // Start realtime subscription
    subscribeRealtime(user);

  } catch (err) {
    feedback.innerHTML = `<p class="error">Failed to load chat: ${err.message}</p>`;
  }
}

// Upload file
async function uploadFile(file) {
  const { data: { user } } = await supabase.auth.getUser();
  const filePath = `graduates/${user.id}/${Date.now()}_${file.name}`;
  const { error: storageError } = await supabase.storage.from('attachments').upload(filePath, file, { upsert: true });
  if (storageError) throw storageError;

  const { data: { publicUrl }, error: urlError } = supabase.storage.from('attachments').getPublicUrl(filePath);
  if (urlError) throw urlError;

  return { file_url: publicUrl, file_name: file.name };
}

// Send message
sendReplyBtn.addEventListener('click', async () => {
  const message = replyText.value.trim();
  const file = fileInput.files[0];

  if (!message && !file) {
    feedback.innerHTML = '<p class="error">Please enter a message or choose a file.</p>';
    return;
  }

  feedback.innerHTML = '';
  let fileData = {};

  try {
    if (file) fileData = await uploadFile(file);

    const { data: { user } } = await supabase.auth.getUser();
    const { data: inserted, error } = await supabase.from('messages').insert([{
      student_id: user.id,
      recruiter_id: recruiterId,
      company_name: companyNameFromURL || 'Recruiter',
      job_id: jobId,
      job_title: jobTitleFromURL || 'Job Post',
      message: message || null,
      file_url: fileData.file_url || null,
      file_name: fileData.file_name || null,
      status: 'unread',
      sender: 'student',
      created_at: new Date()
    }]).select();

    if (error) throw error;

    renderMessage(inserted[0]);
    replyText.value = '';
    fileInput.value = '';
    feedback.innerHTML = '<p class="success">Message sent!</p>';

  } catch (err) {
    feedback.innerHTML = `<p class="error">Failed to send: ${err.message}</p>`;
  }
});

// Realtime subscription
function subscribeRealtime(user) {
  supabase
    .channel(`student-chat-${recruiterId}-${jobId}`)
    .on(
      'postgres_changes',
      { event: 'INSERT', schema: 'public', table: 'messages' },
      (payload) => {
        const msg = payload.new;

        // Match student, recruiter, and job
        if (
          String(msg.student_id) === String(user.id) &&
          String(msg.recruiter_id) === String(recruiterId) &&
          String(msg.job_id) === String(jobId)
        ) {
          renderMessage(msg);
        }
      }
    )
    .subscribe();
}

// Initialize
document.addEventListener('DOMContentLoaded', loadChat);
