import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js/+esm';

const SUPABASE_URL = 'https://euclknvsppptbfclwxqq.supabase.co';
const SUPABASE_KEY = 'sb_publishable_90JbyFsa4BuuyeuLCIActg_yXfbHQ30';
const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

const COLUMNS = 'id, message, status, created_at, recruiter_id, company_name, job_title, job_id, student_deleted';
const POLL_MS = 20000; // safety net: also checks for new messages every 20 seconds

const $ = id => document.getElementById(id);
const container = $('messagesContainer');
const badge = $('messageBadge');
const baseTitle = document.title;

let user = null;
let allMessages = [];
const known = new Set();    // every message id we have seen
const newKeys = new Set();  // conversations with messages that arrived unread
let unseenWhileAway = 0;
let toastTimer = null;

// ---------- helpers ----------
function esc(value) {
  const div = document.createElement('div');
  div.textContent = value ?? '';
  return div.innerHTML;
}
const keyOf = m => `${m.recruiter_id || 'null'}_${m.job_id || 'null'}`;
const isUnread = m => (m.status || '').toLowerCase() === 'unread';
const fmtDate = d => new Date(d).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' });

$('logoutBtn').addEventListener('click', async () => {
  await supabase.auth.signOut();
  window.location.href = 'homepage.html';
});

// ---------- rendering ----------
function conversations() {
  const latest = {};
  allMessages.forEach(m => {
    if (m.student_deleted) return;
    const k = keyOf(m);
    if (!latest[k] || new Date(m.created_at) > new Date(latest[k].created_at)) latest[k] = m;
  });
  return Object.values(latest).sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
}

function render() {
  const convos = conversations();
  $('statConvos').textContent = convos.length;
  $('statNew').textContent = newKeys.size;
  badge.style.display = newKeys.size > 0 ? 'inline-block' : 'none';

  if (convos.length === 0) {
    container.innerHTML = `<div class="empty">No messages yet. When a recruiter contacts you, it will appear here.</div>`;
    return;
  }

  container.innerHTML = '';
  convos.forEach(msg => {
    const key = keyOf(msg);
    const isNew = newKeys.has(key);
    const company = msg.company_name || 'Recruiter';

    const card = document.createElement('div');
    card.className = 'msg' + (isNew ? ' new' : '');
    card.innerHTML = `
      <div class="msg-head">
        <div class="av">${esc(company.charAt(0).toUpperCase())}</div>
        <div>
          <div class="who">${esc(company)}</div>
          <div class="when">${esc(fmtDate(msg.created_at))}</div>
        </div>
        <span class="pill ${isNew ? 'new' : ''}">${isNew ? 'New' : esc(msg.status || '')}</span>
      </div>
      <div class="job">Job applied for:
        <a href="job-details.html?jobId=${encodeURIComponent(msg.job_id || '')}" target="_blank" rel="noopener">${esc(msg.job_title || 'Unknown Job')}</a>
      </div>
      <div class="content">${esc(msg.message || '')}</div>
      <div class="btn-group">
        <button class="reply-btn" type="button">Reply</button>
        <button class="delete-btn" type="button">Delete</button>
      </div>`;
    container.appendChild(card);

    card.querySelector('.reply-btn').addEventListener('click', () => {
      const p = new URLSearchParams({
        recruiterId: msg.recruiter_id || '',
        jobId: msg.job_id || '',
        jobTitle: msg.job_title || '',
        companyName: company
      });
      window.location.href = `graduate-reply.html?${p.toString()}`;
    });

    card.querySelector('.delete-btn').addEventListener('click', async () => {
      if (!confirm('Are you sure you want to delete this conversation?')) return;
      try {
        let query = supabase
          .from('messages')
          .update({ student_deleted: true })
          .eq('student_id', user.id)
          .eq('student_deleted', false);
        if (msg.recruiter_id) query = query.eq('recruiter_id', msg.recruiter_id);
        if (msg.job_id) query = query.eq('job_id', msg.job_id);

        const { error } = await query;
        if (error) throw error;

        allMessages.forEach(m => { if (keyOf(m) === key) m.student_deleted = true; });
        newKeys.delete(key);
        render();
      } catch (err) {
        console.error(err);
        alert('Failed to delete messages: ' + err.message);
      }
    });
  });
}

// ---------- data ----------
async function fetchMessages() {
  const { data, error } = await supabase
    .from('messages')
    .select(COLUMNS)
    .eq('student_id', user.id)
    .eq('student_deleted', false)
    .order('created_at', { ascending: false });
  if (error) throw error;
  return data || [];
}

async function markViewed() {
  const ids = allMessages.filter(isUnread).map(m => m.id);
  if (ids.length === 0) return;
  allMessages.forEach(m => { if (isUnread(m)) m.status = 'viewed'; });
  const { error } = await supabase.from('messages').update({ status: 'viewed' }).in('id', ids);
  if (error) console.error('Could not mark messages as viewed:', error);
}

// ---------- notifications ----------
function showToast(title, text) {
  const t = $('toast');
  t.innerHTML = `<b>${esc(title)}</b><span>${esc(text)}</span>`;
  t.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => t.classList.remove('show'), 7000);
}
$('toast').addEventListener('click', () => {
  $('toast').classList.remove('show');
  window.scrollTo({ top: 0, behavior: 'smooth' });
});

function announce(msg) {
  const company = msg.company_name || 'a recruiter';
  const preview = (msg.message || '').replace(/\s+/g, ' ').trim().slice(0, 100);

  showToast(`New message from ${company}`, msg.job_title ? `About: ${msg.job_title}` : preview);
  playChime();

  if (document.hidden) {
    unseenWhileAway++;
    document.title = `(${unseenWhileAway}) New message - GraduateInHunt`;
    if ('Notification' in window && Notification.permission === 'granted') {
      const n = new Notification(`New message from ${company}`, {
        body: preview || (msg.job_title ? `About: ${msg.job_title}` : ''),
        tag: 'graduateinhunt-message'
      });
      n.onclick = () => { window.focus(); n.close(); };
    }
  }
}

function setupAlertsButton() {
  const btn = $('alertsBtn');
  const on = $('alertsOn');
  if (!('Notification' in window)) return;

  const paint = () => {
    const p = Notification.permission;
    btn.hidden = p === 'granted';
    on.hidden = p !== 'granted';
    if (p === 'denied') { btn.textContent = 'Alerts blocked in browser settings'; btn.disabled = true; }
    else { btn.textContent = 'Turn on alerts'; btn.disabled = false; }
  };
  btn.addEventListener('click', async () => { await Notification.requestPermission(); paint(); });
  paint();
}

// ---------- sound ----------
let audioCtx = null;
let soundOn = true;
try { soundOn = localStorage.getItem('gihSound') !== 'off'; } catch (e) { /* storage unavailable */ }

function getCtx() {
  if (!audioCtx) {
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return null;
    audioCtx = new AC();
  }
  if (audioCtx.state === 'suspended') audioCtx.resume().catch(() => {});
  return audioCtx;
}

// Two soft notes, no audio file needed
function playChime() {
  if (!soundOn) return;
  const ctx = getCtx();
  if (!ctx) return;
  const now = ctx.currentTime;
  [[880, 0], [1318.5, 0.14]].forEach(([freq, delay]) => {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.value = freq;
    gain.gain.setValueAtTime(0.0001, now + delay);
    gain.gain.exponentialRampToValueAtTime(0.25, now + delay + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + delay + 0.5);
    osc.connect(gain).connect(ctx.destination);
    osc.start(now + delay);
    osc.stop(now + delay + 0.55);
  });
}

function setupSound() {
  const btn = $('soundBtn');
  const paint = () => {
    btn.textContent = soundOn ? 'Sound on' : 'Sound off';
    btn.setAttribute('aria-pressed', String(soundOn));
  };
  btn.addEventListener('click', () => {
    soundOn = !soundOn;
    try { localStorage.setItem('gihSound', soundOn ? 'on' : 'off'); } catch (e) { /* ignore */ }
    paint();
    playChime(); // preview; the click also lets the browser play sounds on this page
  });
  // Browsers only allow sound after the person has interacted with the page once
  ['pointerdown', 'keydown'].forEach(ev => window.addEventListener(ev, getCtx, { once: true }));
  paint();
}

function setLive(ok) {
  const chip = $('liveState');
  chip.classList.toggle('live', ok);
  $('liveText').textContent = ok ? 'Live' : 'Checking every 20 seconds';
}

// ---------- incoming messages ----------
function addIncoming(msg) {
  if (!msg || known.has(msg.id) || msg.student_deleted) return;
  known.add(msg.id);
  allMessages.unshift(msg);
  if (isUnread(msg)) {
    newKeys.add(keyOf(msg));
    announce(msg);
  }
  render();
  if (!document.hidden) markViewed();
}

async function poll() {
  try {
    const fresh = await fetchMessages();
    fresh.filter(m => !known.has(m.id)).reverse().forEach(addIncoming);
  } catch (err) {
    console.warn('Message check failed:', err);
  }
}

function subscribe() {
  supabase
    .channel('graduate-messages-page')
    .on('postgres_changes', {
      event: 'INSERT',
      schema: 'public',
      table: 'messages',
      // Realtime accepts ONE filter only. Deleted messages are skipped in addIncoming().
      filter: `student_id=eq.${user.id}`
    }, payload => addIncoming(payload.new))
    .subscribe(status => {
      setLive(status === 'SUBSCRIBED');
      if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
        console.warn('Realtime not connected (' + status + '). Falling back to checking every 20 seconds.');
      }
    });
}

document.addEventListener('visibilitychange', () => {
  if (document.hidden) return;
  unseenWhileAway = 0;
  document.title = baseTitle;
  markViewed();
  poll();
});

// ---------- start ----------
async function init() {
  container.innerHTML = '<div class="empty">Loading messages...</div>';
  setLive(false);
  try {
    const { data: { user: u }, error } = await supabase.auth.getUser();
    if (error || !u) {
      container.innerHTML = '<div class="empty">Please log in to view messages.</div>';
      return;
    }
    user = u;

    allMessages = await fetchMessages();
    allMessages.forEach(m => {
      known.add(m.id);
      if (isUnread(m)) newKeys.add(keyOf(m));
    });
    render();
    await markViewed();

    setupAlertsButton();
    setupSound();
    subscribe();
    setInterval(poll, POLL_MS);
  } catch (err) {
    console.error('Error loading messages:', err);
    container.innerHTML = '<div class="empty">Error loading messages.</div>';
  }
}

init();
