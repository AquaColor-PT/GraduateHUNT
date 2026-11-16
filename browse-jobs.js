import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm';

const SUPABASE_URL = 'https://euclknvsppptbfclwxqq.supabase.co';
const SUPABASE_KEY = 'sb_publishable_90JbyFsa4BuuyeuLCIActg_yXfbHQ30';
const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

const publicJobList = document.getElementById('publicJobList');
const jobTitleSearch = document.getElementById('jobTitleSearch');
const typeChips = document.getElementById('typeChips');
const notice = document.getElementById('notice');
const resultCount = document.getElementById('resultCount');

let allJobs = [];
let activeType = '';

/* ---------- icons (fixed strings only, never job data) ---------- */
const svg = inner =>
    `<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${inner}</svg>`;

const ICONS = {
    pin: svg('<path d="M20 10c0 6-8 12-8 12S4 16 4 10a8 8 0 0 1 16 0z"/><circle cx="12" cy="10" r="3"/>'),
    cap: svg('<path d="M22 10 12 5 2 10l10 5 10-5z"/><path d="M6 12v5c3 2 9 2 12 0v-5"/>'),
    clock: svg('<circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/>'),
    search: svg('<circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/>'),
    alert: svg('<circle cx="12" cy="12" r="10"/><path d="M12 8v4"/><path d="M12 16h.01"/>')
};

function icon(name) {
    const span = document.createElement('span');
    span.className = 'icon';
    span.innerHTML = ICONS[name];
    return span;
}

/* ---------- small DOM helpers (textContent only, so job data can never inject HTML) ---------- */
function showSkeletons(count = 4) {
    publicJobList.innerHTML = '';
    resultCount.textContent = '';
    for (let i = 0; i < count; i++) {
        const li = document.createElement('li');
        li.className = 'job-card skeleton';
        li.setAttribute('aria-hidden', 'true');
        li.innerHTML =
            '<div class="sk sk-title"></div><div class="sk sk-line"></div>' +
            '<div class="sk sk-line short"></div><div class="sk sk-btn"></div>';
        publicJobList.appendChild(li);
    }
}

function showState(title, text = '', options = {}) {
    const { iconName = 'search', isError = false, linkText = '', linkHref = '' } = options;

    publicJobList.innerHTML = '';
    resultCount.textContent = '';

    const li = document.createElement('li');
    li.className = 'state' + (isError ? ' error' : '');
    li.appendChild(icon(isError ? 'alert' : iconName));

    const h = document.createElement('h4');
    h.textContent = title;
    li.appendChild(h);

    if (text || linkHref) {
        const p = document.createElement('p');
        if (text) p.append(document.createTextNode(text));
        if (linkHref) {
            if (text) p.append(document.createTextNode(' '));
            const a = document.createElement('a');
            a.href = linkHref;
            a.textContent = linkText;
            p.append(a);
        }
        li.appendChild(p);
    }
    publicJobList.appendChild(li);
}

function showNotice(text) {
    notice.textContent = text;
    notice.hidden = !text;
}

function metaItem(iconName, label, value) {
    const div = document.createElement('div');
    div.className = 'meta-item';
    div.appendChild(icon(iconName));

    const span = document.createElement('span');
    if (label) {
        const strong = document.createElement('strong');
        strong.textContent = label + ' ';
        span.append(strong);
    }
    span.append(document.createTextNode(value));
    div.appendChild(span);
    return div;
}

function badge(text, extraClass = '') {
    const span = document.createElement('span');
    span.className = 'badge' + (extraClass ? ' ' + extraClass : '');
    span.textContent = text;
    return span;
}

function avatarColors(name) {
    let hue = 0;
    for (const ch of name) hue = (hue * 31 + ch.charCodeAt(0)) % 360;
    return { bg: `hsl(${hue} 80% 92%)`, fg: `hsl(${hue} 55% 32%)` };
}

function daysSince(dateStr) {
    const d = new Date(dateStr);
    if (isNaN(d)) return null;
    return Math.floor((Date.now() - d.getTime()) / 86400000);
}

function postedText(dateStr) {
    const days = daysSince(dateStr);
    if (days === null) return 'Posted date unknown';
    if (days <= 0) return 'Posted today';
    if (days === 1) return 'Posted yesterday';
    if (days < 7) return `Posted ${days} days ago`;
    if (days < 30) {
        const weeks = Math.floor(days / 7);
        return `Posted ${weeks} ${weeks === 1 ? 'week' : 'weeks'} ago`;
    }
    return 'Posted on ' + new Date(dateStr).toLocaleDateString();
}

/* ---------- qualification matching ---------- */
// Words that say nothing about the field of study. Without this list, a word like
// "in" or "degree" made almost every job "match" every graduate.
const STOP_WORDS = new Set([
    'in', 'of', 'and', 'the', 'for', 'with', 'to', 'an', 'or', 'on', 'at', 'by', 'from',
    'degree', 'degrees', 'diploma', 'diplomas', 'bachelor', 'bachelors', 'certificate',
    'national', 'higher', 'advanced', 'honours', 'hons', 'bsc', 'btech', 'beng',
    'sc', 'eng', 'hon', 'nqf', 'level', 'qualification', 'qualifications', 'related', 'field', 'equivalent',
    'relevant', 'matric', 'grade', 'plus', 'incl', 'science', 'sciences'
]);

function keywords(text) {
    return (text || '')
        .toLowerCase()
        .split(/[^a-z0-9+#]+/)          // splits on punctuation too, e.g. "Engineering," or "(Electrical)"
        .filter(w => w.length > 1 && !STOP_WORDS.has(w));
}

// "engineer" ~ "engineering", "account" ~ "accounting" (but never tiny words like "art" ~ "artificial")
function wordsMatch(a, b) {
    if (a === b) return true;
    return Math.min(a.length, b.length) >= 5 && (a.startsWith(b) || b.startsWith(a));
}

// What we compare against the
