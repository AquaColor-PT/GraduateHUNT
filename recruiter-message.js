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

// Render message
function renderMessage(msg) {
  const div = document.createElement('div');
  div.classList.add('message', msg.sender === 'recruiter' ? 'recruiter' : 'student');

  let content = msg.message || '';
  if (msg.file_url) {
    content += `<a href="${msg.file_url}" target="_blank" class="file-link">${msg.file_name}</a>`;
  }

  const timestamp = msg.created_at ? new Date(msg.created_at).toLocaleTimeString([], {hour:'2-digit',minute:'2-digit'}) : '';
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
    console.error(err);
  }
}

// Load messages
async function loadMessages() {
  chatMessages.innerHTML = '<p style="text-align:center;color:#666;">Loading messages...</p>';
  try {
    const { data: messages, error } = await supabase
      .from('messages')
      .select('*')
      .eq('student_id', studentId)
      .eq('job_id', jobId)
      .order('created_at', { ascending: true });

    if (error) throw error;
    chatMessages.innerHTML = '';
    messages.forEach(renderMessage);

  } catch (err) {
    chatMessages.innerHTML = `<p style="text-align:center;color:red;">Failed to load messages: ${err.message}</p>`;
    console.error(err);
  }
}

// Upload file
async function uploadFile(file) {
  const fileName = `graduates/${studentId}/${jobId}/${Date.now()}_${file.name}`;
  const { data, error } = await supabase.storage.from('attachments').upload(fileName, file, { cacheControl: '3600', upsert: false });
  if (error) throw error;

  const { data: publicUrlData } = supabase.storage.from('attachments').getPublicUrl(fileName);
  return { file_url: publicUrlData.publicUrl, file_name: file.name };
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
    const { data: recruiter } = await supabase.from('recruiters').select('*').eq('id', supabase.auth.getUser().data.user.id).single();

    let fileData = {};
    if (file) fileData = await uploadFile(file);

    const { data: inserted, error } = await supabase.from('messages').insert([{
      student_id: studentId,
      recruiter_id: recruiter.id,
      recruiter_name: recruiter.full_name,
      company_name: recruiter.company_name,
      job_id: jobId,
      job_title: jobTitleFromURL || 'Job Post',
      message,
      sender: 'recruiter',
      status: 'unread',
      created_at: new Date(),
      ...fileData
    }]).select();

    if (error) throw error;

    renderMessage(inserted[0]);
    replyText.value = '';
    fileInput.value = '';
    feedback.innerHTML = '<p class="success">Message sent!</p>';

  } catch (err) {
    feedback.innerHTML = `<p class="error">Failed to send: ${err.message}</p>`;
    console.error(err);
  }
});

// Real-time subscription
async function subscribeRealtime() {
  supabase.channel(`recruiter-chat-${studentId}-${jobId}`)
    .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages', filter: `student_id=eq.${studentId},job_id=eq.${jobId}` }, payload => {
      renderMessage(payload.new);
    })
    .subscribe();
}

// Initialize
document.addEventListener('DOMContentLoaded', () => {
  loadGraduateInfo();
  loadMessages();
  subscribeRealtime();
});
