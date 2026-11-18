import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js/+esm';

const SUPABASE_URL = 'https://euclknvsppptbfclwxqq.supabase.co';
const SUPABASE_KEY = 'sb_publishable_90JbyFsa4BuuyeuLCIActg_yXfbHQ30';
const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

const $ = id => document.getElementById(id);
const gradNameEl = $('gradName');
const gradEmailEl = $('gradEmail');
const gradPhoneEl = $('gradPhone');
const jobTitleEl = $('jobTitle');
const replyText = $('replyText');
const sendReplyBtn = $('sendReplyBtn');
const fileInput = $('fileInput');
const chatMessages = $('chatMessages');
const feedback = $('feedback');

const POLL_MS = 15000; // safety net in case realtime is not connected
const MAX_FILE_MB = 10;

// Conversation details come from the Reply button on the accepted students page
const urlParams = new URLSearchParams(window.location.search);
const studentId = urlParams.get('studentId') || null;
const jobId = urlParams.get('jobId') || null;
const jobTitleFromURL = urlParams.get('jobTitle');

let user = null;
let recruiterName = 'Recruiter';
let companyName = 'Company';
let jobTitle = jobTitleFromURL || 'Job Post';
let sending = false;
const shown = new Set(); // ids of messages already on screen: this is what prevents duplicates

jobTitleEl.textContent = jobTitle;

// ---------- helpers ----------
function esc(value) {
  const div = document.createElement('div');
  div.textContent = value ?? '';
  return div.innerHTML;
}
const fmtTime = d => new Date(d || Date.now()).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' });
const safeUrl = u => (typeof u === 'string' && /^https?:\/\//i.test(u)) ? u : '';

$('logoutBtn').addEventListener('click', async (e) => {
  e.preventDefault(); // wait for signOut before navigating
  await supabase.auth.signOut();
  window.location.href = 'homepage.html';
});

fileInput.addEventListener('change', () => {
  $('fileName').textContent = fileInput.files[0] ? fileInput.files[0].name : '';
});

function setLive(ok) {
  $('liveState').classList.toggle('live', ok);
  $('liveText').textContent = ok ? 'Live' : 'Checking every 15 seconds';
}

// Does this row belong to the conversation open on this page?
function inConversation(m) {
  return m.student_id === studentId
    && m.recruiter_id === user.id
    && (m.job_id || null) === jobId;
}

// ---------- rendering ----------
function clearEmptyNote() {
  const note = chatMessages.querySelector('.chat-empty');
  if (note) note.remove();
}

function addMessage(msg) {
  if (!msg || (msg.id != null && shown.has(msg.id))) return false;
  if (msg.id != null) shown.add(msg.id);

  clearEmptyNote();
  const fromRecruiter = msg.sender === 'recruiter';
  const fileUrl = safeUrl(msg.file_url);

  const div = document.createElement('div');
  div.className = `message ${fromRecruiter ? 'recruiter' : 'student'}`;
  div.innerHTML = `
    ${msg.message ? `<div class="text">${esc(msg.message)}</div>` : ''}
    ${fileUrl ? `<a href="${esc(fileUrl)}" target="_blank" rel="noopener" class="file-link">${esc(msg.file_name || 'Attachment')}</a>` : ''}
    <div class="time">${esc(fmtTime(msg.created_at))}</div>
  `;
  chatMessages.appendChild(div);
  chatMessages.scrollTop = chatMessages.scrollHeight;
  return true;
}

function showEmptyNote() {
  if (!chatMessages.children.length) {
    chatMessages.innerHTML = '<div class="chat-empty">No messages yet. Write your first message below.</div>';
  }
}

// ---------- data ----------
async function loadGraduateInfo() {
  try {
    const { data: student, error } = await supabase
      .from('graduates')
      .select('full_name, email, phone')
      .eq('id', studentId)
      .single();
    if (error) throw error;

    gradNameEl.textContent = student.full_name || 'Unknown';
    gradEmailEl.textContent = student.email || 'N/A';
    gradPhoneEl.textContent = student.phone || 'N/A';
  } catch (err) {
    gradNameEl.textContent = 'Graduate';
    gradEmailEl.textContent = gradPhoneEl.textContent = 'N/A';
    console.error('Failed to load graduate info:', err);
  }
}

async function loadRecruiterInfo() {
  const { data, error } = await supabase
    .from('recruiters')
    .select('full_name, company_name')
    .eq('id', user.id)
    .maybeSingle();
  if (error) { console.warn('Could not load recruiter info:', error); return; }
  recruiterName = data?.full_name || recruiterName;
  companyName = data?.company_name || companyName;
}

async function loadJobTitle() {
  if (jobTitleFromURL || !jobId) return;
  const { data, error } = await supabase.from('jobs').select('title').eq('id', jobId).maybeSingle();
  if (error) { console.warn('Could not load job title:', error); return; }
  if (data?.title) {
    jobTitle = data.title;
    jobTitleEl.textContent = jobTitle;
  }
}

function scoped(query) {
  query = query.eq('student_id', studentId).eq('recruiter_id', user.id);
  query = jobId ? query.eq('job_id', jobId) : query.is('job_id', null);
  return query;
}

async function fetchConversation() {
  const { data, error } = await scoped(supabase.from('messages').select('*'))
    .order('created_at', { ascending: true });
  if (error) throw error;
  return data || [];
}

// Student messages you have now read: mark them viewed (your own messages are left alone)
async function markViewed(messages) {
  const ids = messages
    .filter(m => m.sender === 'student' && (m.status || '').toLowerCase() === 'unread')
    .map(m => m.id);
  if (!ids.length) return;
  const { error } = await supabase.from('messages').update({ status: 'viewed' }).in('id', ids);
  if (error) console.warn('Could not mark messages as viewed:', error);
}

async function loadChat() {
  chatMessages.innerHTML = '';
  const messages = await fetchConversation();
  messages.forEach(addMessage);
  showEmptyNote();
  markViewed(messages);
}

async function refresh() {
  try {
    const messages = await fetchConversation();
    const fresh = messages.filter(m => !shown.has(m.id));
    fresh.forEach(addMessage);
    markViewed(fresh);
  } catch (err) {
    console.warn('Chat refresh failed:', err);
  }
}

// ---------- upload ----------
async function uploadFile(file) {
  if (file.size > MAX_FILE_MB * 1024 * 1024) throw new Error(`File is too large (max ${MAX_FILE_MB} MB).`);

  const safeName = file.name.replace(/[^\w.\-]+/g, '_');
  const filePath = `graduates/${studentId}/${jobId}/${Date.now()}_${safeName}`;
  const { error: storageError } = await supabase.storage
    .from('attachments')
    .upload(filePath, file, { cacheControl: '3600', upsert: false });
  if (storageError) throw storageError;

  const { data: { publicUrl } } = supabase.storage.from('attachments').getPublicUrl(filePath);
  return { file_url: publicUrl, file_name: file.name };
}

// ---------- send ----------
async function sendReply() {
  if (sending) return; // blocks double clicks / double shortcuts, the main cause of duplicate rows

  const message = replyText.value.trim();
  const file = fileInput.files[0];
  if (!message && !file) {
    feedback.innerHTML = '<p class="error">Enter a message or select a file.</p>';
    return;
  }

  sending = true;
  sendReplyBtn.disabled = true;
  sendReplyBtn.textContent = 'Sending...';
  feedback.innerHTML = '';

  try {
    const fileData = file ? await uploadFile(file) : {};

    const { data: row, error } = await supabase.from('messages').insert([{
      student_id: studentId,
      recruiter_id: user.id,
      recruiter_name: recruiterName,
      company_name: companyName,
      job_id: jobId,
      job_title: jobTitle,
      message: message || null,
      file_url: fileData.file_url || null,
      file_name: fileData.file_name || null,
      sender: 'recruiter',
      status: 'unread',
      student_deleted: false,
      recruiter_deleted: false,
      created_at: new Date().toISOString()
    }]).select().maybeSingle();

    if (error) throw error;

    // Draw the saved row once. If realtime delivers the same row, its id is already in `shown`, so it is skipped.
    if (row) addMessage(row); else await refresh();

    replyText.value = '';
    fileInput.value = '';
    $('fileName').textContent = '';
    feedback.innerHTML = '<p class="success">Message sent!</p>';
    setTimeout(() => { if (!sending) feedback.innerHTML = ''; }, 3000);
  } catch (err) {
    console.error(err);
    feedback.innerHTML = `<p class="error">Failed to send: ${esc(err.message)}</p>`;
  } finally {
    sending = false;
    sendReplyBtn.disabled = false;
    sendReplyBtn.textContent = 'Send';
  }
}

sendReplyBtn.addEventListener('click', sendReply);
replyText.addEventListener('keydown', e => {
  if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) { e.preventDefault(); sendReply(); }
});

// ---------- live updates ----------
function subscribeRealtime() {
  supabase
    .channel(`recruiter-chat-${studentId}-${jobId || 'none'}`)
    .on('postgres_changes', {
      event: 'INSERT',
      schema: 'public',
      table: 'messages',
      // Realtime accepts ONE filter only, so the rest is checked in code
      filter: `student_id=eq.${studentId}`
    }, payload => {
      const m = payload.new;
      if (!inConversation(m)) return;
      if (addMessage(m)) markViewed([m]);
    })
    .subscribe(status => setLive(status === 'SUBSCRIBED'));
}

// ---------- start ----------
async function init() {
  setLive(false);

  if (!studentId || !jobId) {
    chatMessages.innerHTML = '<div class="chat-empty" style="color:#b91c1c;">Cannot load chat without a graduate ID and job ID.</div>';
    sendReplyBtn.disabled = true;
    return;
  }

  try {
    const { data: { user: u }, error } = await supabase.auth.getUser();
    if (error || !u) {
      window.location.href = 'recruiter-login.html';
      return;
    }
    user = u;

    loadGraduateInfo();
    await Promise.all([loadRecruiterInfo(), loadJobTitle()]);
    await loadChat();
    subscribeRealtime();
    setInterval(refresh, POLL_MS);
  } catch (err) {
    console.error(err);
    feedback.innerHTML = `<p class="error">Failed to load chat: ${esc(err.message)}</p>`;
  }
}

init();
