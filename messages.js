import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js/+esm';

const SUPABASE_URL = 'https://euclknvsppptbfclwxqq.supabase.co';
const SUPABASE_KEY = 'sb_publishable_90JbyFsa4BuuyeuLCIActg_yXfbHQ30';
const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

const $ = id => document.getElementById(id);
const listEl = $('conversationList');
const filterInput = $('filterInput');
const countText = $('countText');
const logoutBtn = $('logoutBtn');

const CHAT_PAGE = 'recruiter-message.html';

let recruiterId = null;
let conversations = [];

// ---------- helpers ----------
function showNote(text, isError = false) {
  listEl.innerHTML = '';
  const div = document.createElement('div');
  div.className = 'empty' + (isError ? ' error' : '');
  div.textContent = text;
  listEl.appendChild(div);
}

function initials(name) {
  const parts = (name || '?').trim().split(/\s+/).slice(0, 2);
  return parts.map(p => p.charAt(0).toUpperCase()).join('') || '?';
}

function formatTime(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  const now = new Date();
  if (d.toDateString() === now.toDateString()) {
    return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  }
  const opts = { day: 'numeric', month: 'short' };
  if (d.getFullYear() !== now.getFullYear()) opts.year = 'numeric';
  return d.toLocaleDateString(undefined, opts);
}

function previewText(last) {
  if (!last) return 'No messages yet. Start the conversation.';
  const prefix = last.sender === 'recruiter' ? 'You: ' : '';
  if (last.message) return prefix + last.message;
  if (last.file_name) return prefix + 'Attachment: ' + last.file_name;
  return prefix + 'Message';
}

function chatUrl(c) {
  return `${CHAT_PAGE}?studentId=${encodeURIComponent(c.studentId)}`
    + `&jobId=${encodeURIComponent(c.jobId)}`
    + `&jobTitle=${encodeURIComponent(c.jobTitle)}`;
}

// ---------- rendering ----------
function render() {
  const q = filterInput.value.trim().toLowerCase();
  const visible = conversations.filter(c =>
    !q || c.studentName.toLowerCase().includes(q) || c.jobTitle.toLowerCase().includes(q)
  );

  countText.textContent = visible.length === 1 ? '1 conversation' : `${visible.length} conversations`;

  if (!conversations.length) {
    showNote('No accepted students yet. Students you accept will appear here.');
    countText.textContent = '';
    return;
  }
  if (!visible.length) {
    showNote('No conversations match your search.');
    return;
  }

  listEl.innerHTML = '';
  visible.forEach(c => {
    const item = document.createElement('a');
    item.className = 'convo' + (c.unread > 0 ? ' unread' : '');
    item.href = chatUrl(c);

    const avatar = document.createElement('div');
    avatar.className = 'avatar';
    avatar.textContent = initials(c.studentName);

    const body = document.createElement('div');
    body.className = 'convo-body';

    const top = document.createElement('div');
    top.className = 'convo-top';
    const name = document.createElement('div');
    name.className = 'convo-name';
    name.textContent = c.studentName;
    const time = document.createElement('div');
    time.className = 'convo-time';
    time.textContent = formatTime(c.last?.created_at);
    top.append(name, time);

    const job = document.createElement('div');
    job.className = 'convo-job';
    job.textContent = c.jobTitle;

    const bottom = document.createElement('div');
    bottom.className = 'convo-bottom';
    const preview = document.createElement('div');
    preview.className = 'convo-preview';
    preview.textContent = previewText(c.last);
    bottom.appendChild(preview);

    if (c.unread > 0) {
      const badge = document.createElement('span');
      badge.className = 'badge';
      badge.textContent = c.unread > 99 ? '99+' : String(c.unread);
      bottom.appendChild(badge);
    }

    body.append(top, job, bottom);
    item.append(avatar, body);
    listEl.appendChild(item);
  });
}

// ---------- data ----------
async function loadConversations() {
  try {
    // 1. Accepted applications for this recruiter
    const { data: applications, error: appsError } = await supabase
      .from('applications')
      .select('id, student_id, job_id, status')
      .eq('recruiter_id', recruiterId)
      .eq('status', 'Accepted');
    if (appsError) throw appsError;

    if (!applications || !applications.length) {
      conversations = [];
      render();
      return;
    }

    const jobIds = [...new Set(applications.map(a => a.job_id))];
    const studentIds = [...new Set(applications.map(a => a.student_id))];

    // 2. Students and jobs
    const [studentsRes, jobsRes, messagesRes] = await Promise.all([
      supabase.from('graduates').select('id, full_name').in('id', studentIds),
      supabase.from('jobs').select('id, title').in('id', jobIds),
      supabase
        .from('messages')
        .select('student_id, job_id, message, file_name, sender, status, created_at')
        .eq('recruiter_id', recruiterId)
        .in('student_id', studentIds)
        .in('job_id', jobIds)
        .order('created_at', { ascending: false })
    ]);
    if (studentsRes.error) throw studentsRes.error;
    if (jobsRes.error) throw jobsRes.error;
    if (messagesRes.error) throw messagesRes.error;

    const studentMap = {};
    (studentsRes.data || []).forEach(s => { studentMap[s.id] = s.full_name; });

    const jobMap = {};
    (jobsRes.data || []).forEach(j => { jobMap[j.id] = j.title; });

    // 3. Last message and unread count for each student + job pair
    const info = {};
    (messagesRes.data || []).forEach(m => {
      const key = `${m.student_id}_${m.job_id}`;
      if (!info[key]) info[key] = { last: m, unread: 0 }; // newest comes first
      if (m.sender === 'student' && (m.status || '').toLowerCase() === 'unread') {
        info[key].unread++;
      }
    });

    // 4. Build the list (one row per student + job)
    const seen = new Set();
    conversations = [];
    applications.forEach(app => {
      const key = `${app.student_id}_${app.job_id}`;
      if (seen.has(key)) return;
      seen.add(key);
      conversations.push({
        studentId: app.student_id,
        jobId: app.job_id,
        studentName: studentMap[app.student_id] || 'Unknown',
        jobTitle: jobMap[app.job_id] || 'Unknown Job',
        last: info[key]?.last || null,
        unread: info[key]?.unread || 0
      });
    });

    // Newest conversations first, then students with no messages A to Z
    conversations.sort((a, b) => {
      if (a.last && b.last) return new Date(b.last.created_at) - new Date(a.last.created_at);
      if (a.last) return -1;
      if (b.last) return 1;
      return a.studentName.localeCompare(b.studentName);
    });

    render();
  } catch (err) {
    console.error(err);
    showNote(`Error loading conversations: ${err.message}`, true);
  }
}

// ---------- events ----------
filterInput.addEventListener('input', render);

logoutBtn?.addEventListener('click', async (e) => {
  e.preventDefault(); // wait for signOut before navigating
  await supabase.auth.signOut();
  window.location.href = 'homepage.html';
});

// Coming back with the browser Back button: refresh so unread counts are correct
window.addEventListener('pageshow', (e) => {
  if (e.persisted && recruiterId) loadConversations();
});

// ---------- start ----------
async function init() {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session?.user) {
    window.location.href = 'recruiter-login.html';
    return;
  }
  recruiterId = session.user.id;
  await loadConversations();
}

init();
