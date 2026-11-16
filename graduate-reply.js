import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js/+esm';

const SUPABASE_URL = 'https://euclknvsppptbfclwxqq.supabase.co';
const SUPABASE_KEY = 'sb_publishable_90JbyFsa4BuuyeuLCIActg_yXfbHQ30';
const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

const $ = id => document.getElementById(id);
const recruiterNameEl = $('recruiterName');
const jobTitleEl = $('jobTitle');
const replyText = $('replyText');
const sendReplyBtn = $('sendReplyBtn');
const fileInput = $('fileInput');
const chatMessages = $('chatMessages');
const feedback = $('feedback');

const POLL_MS = 15000; // safety net in case realtime is not connected

// Conversation details come from the link on the messages page
const urlParams = new URLSearchParams(window.location.search);
const recruiterId = urlParams.get('recruiterId') || null; // '' becomes null, which a uuid column needs
const jobId = urlParams.get('jobId') || null;
const jobTitleFromURL = urlParams.get('jobTitle');
const companyNameFromURL = urlParams.get('companyName');

recruiterNameEl.textContent = companyNameFromURL || 'Recruiter';
jobTitleEl.textContent = jobTitleFromURL || 'Job Post';

let user = null;
let sending = false;
const shown = new Set(); // ids of messages already on screen: this is what prevents duplicates

// ---------- helpers ----------
function esc(value) {
  const div = document.createElement('div');
  div.textContent = value ?? '';
  return div.innerHTML;
}
const fmtTime = d => new Date(d || Date.now()).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' });
const safeUrl = u => (typeof u === 'string' && /^https?:\/\//i.test(u)) ? u : '';

$('logoutBtn').addEventListener('click', async () => {
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
  return m.student_id === user.id
    && (m.recruiter_id || null) === recruiterId
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
  const fromStudent = msg.sender === 'student';
  const fileUrl = safeUrl(msg.file_url);

  const div = document.createElement('div');
  div.className = `message ${fromStudent ? 'student' : 'recruiter'}`;
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
    chatMessages.innerHTML = '<div class="chat-empty">No messages yet. Write your first reply below.</div>';
  }
}

// ---------- data ----------
function scoped(query) {
  query = query.eq('student_id', user.id);
  query = recruiterId ? query.eq('recruiter_id', recruiterId) : query.is('recruiter_id', null);
  query = jobId ? query.eq('job_id', jobId) : query.is('job_id', null);
  return query;
}

async function fetchConversation() {
  const { data, error } = await scoped(supabase.from('messages').select('*'))
    .order('created_at', { ascending: true });
  if (error) throw error;
  return data || [];
}

// Recruiter messages you have now read: mark them viewed (your own replies are left alone)
async function markViewed(messages) {
  const ids = messages
    .filter(m => m.sender !== 'student' && (m.status || '').toLowerCase() === 'unread')
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
  if (file.type !== 'application/pdf') throw new Error('Only PDF files are allowed.');
  if (file.size > 10 * 1024 * 1024) throw new Error('File is too large (max 10 MB).');

  const safeName = file.name.replace(/[^\w.\-]+/g, '_');
  const filePath = `graduates/${user.id}/${Date.now()}_${safeName}`;
  const { error: storageError } = await supabase.storage
    .from('attachments')
    .upload(filePath, file, { upsert: false });
  if (storageError) throw storageError;

  const { data: { publicUrl } } = supabase.storage.from('attachments').getPublicUrl(filePath);
  return { file_url: publicUrl, file_name: file.name };
}

// ---------- send ----------
async function sendReply() {
  if (sending) return; // blocks double clicks / double Enter, the main cause of duplicate rows

  const message = replyText.value.trim();
  const file = fileInput.files[0];
  if (!message && !file) {
    feedback.innerHTML = '<p class="error">Please enter a message or choose a file.</p>';
    return;
  }

  sending = true;
  sendReplyBtn.disabled = true;
  sendReplyBtn.textContent = 'Sending...';
  feedback.innerHTML = '';

  try {
    const fileData = file ? await uploadFile(file) : {};

    const { data: row, error } = await supabase.from('messages').insert([{
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
    .channel(`student-chat-${recruiterId || 'none'}-${jobId || 'none'}`)
    .on('postgres_changes', {
      event: 'INSERT',
      schema: 'public',
      table: 'messages',
      // Realtime accepts ONE filter only, so the rest is checked in code
      filter: `student_id=eq.${user.id}`
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
  try {
    const { data: { user: u }, error } = await supabase.auth.getUser();
    if (error || !u) throw new Error('Please log in to view this chat.');
    user = u;

    await loadChat();
    subscribeRealtime();
    setInterval(refresh, POLL_MS);
  } catch (err) {
    feedback.innerHTML = `<p class="error">Failed to load chat: ${esc(err.message)}</p>`;
  }
}

init();
