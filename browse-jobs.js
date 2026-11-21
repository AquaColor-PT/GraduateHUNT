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
let activeType = '';   // the job type being filtered on ('' means all)
let requestId = 0;     // ignores slow, out-of-date responses
let liveStarted = false;

/* ---------- icons (fixed strings only, never job data) ---------- */
const svg = inner =>
    `<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${inner}</svg>`;

const ICONS = {
    pin: svg('<path d="M20 10c0 6-8 12-8 12S4 16 4 10a8 8 0 0 1 16 0z"/><circle cx="12" cy="10" r="3"/>'),
    cap: svg('<path d="M22 10 12 5 2 10l10 5 10-5z"/><path d="M6 12v5c3 2 9 2 12 0v-5"/>'),
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

/* ---------- job type pills ---------- */
// "Part-time", "part time" and "Part Time" all become the same key, so they group together
function typeKey(value) {
    return (value || '')
        .toLowerCase()
        .replace(/programme/g, 'program')
        .replace(/[^a-z0-9]/g, '');
}

const PREFERRED_TYPES = ['internship', 'learnership', 'trainingprogram', 'parttime', 'permanent', 'contract'];

function makeChip(key, label, count) {
    const chip = document.createElement('button');
    chip.type = 'button';
    chip.className = 'chip' + (key === activeType ? ' active' : '');
    chip.dataset.type = key;
    chip.setAttribute('aria-pressed', String(key === activeType));
    chip.append(document.createTextNode(label));

    const countEl = document.createElement('span');
    countEl.className = 'chip-count';
    countEl.textContent = String(count);
    chip.append(countEl);
    return chip;
}

// Builds the pills from the job types that really exist in the jobs, so a pill always has a match
function renderChips() {
    typeChips.innerHTML = '';

    const groups = new Map();
    allJobs.forEach(job => {
        const label = (job.job_type || '').trim();
        if (!label) return;
        const key = typeKey(label);
        if (!groups.has(key)) groups.set(key, { label, count: 0 });
        groups.get(key).count++;
    });

    // If the job type being filtered on has disappeared (for example the job was removed), go back to All
    if (activeType && !groups.has(activeType)) activeType = '';

    typeChips.hidden = allJobs.length === 0;
    typeChips.appendChild(makeChip('', 'All', allJobs.length));

    const keys = [...groups.keys()].sort((a, b) => {
        const ia = PREFERRED_TYPES.indexOf(a);
        const ib = PREFERRED_TYPES.indexOf(b);
        if (ia !== -1 && ib !== -1) return ia - ib;
        if (ia !== -1) return -1;
        if (ib !== -1) return 1;
        return groups.get(a).label.localeCompare(groups.get(b).label);
    });

    keys.forEach(key => {
        const g = groups.get(key);
        typeChips.appendChild(makeChip(key, g.label, g.count));
    });
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

// What we compare against the job: the field of study when there is one.
// Matric and below have no field, so they only match jobs that ask for no specific field.
// Older graduates (registered before the field existed) fall back to their qualification text.
function graduateMatchText(graduate) {
    if ((graduate.field_of_study || '').trim()) return graduate.field_of_study;

    const q = (graduate.qualification || '').trim().toLowerCase();
    if (!q || q.startsWith('matric') || q.startsWith('no matric')) return '';
    return graduate.qualification;
}

function qualificationMatches(gradText, jobQualification) {
    // A job that asks for nothing specific is open to every graduate
    if (!jobQualification || !jobQualification.trim()) return true;

    const jobWords = keywords(jobQualification);
    if (jobWords.length === 0) return true;      // e.g. only says "Matric"

    const gradWords = keywords(gradText);
    return gradWords.some(g => jobWords.some(j => wordsMatch(g, j)));
}

/* ---------- load data ---------- */
// silent = true is used by live updates: it refreshes the list in the background
// without the loading skeletons, and never replaces the list with an error message.
async function loadJobs({ silent = false } = {}) {
    const thisRequest = ++requestId;

    if (!silent) {
        showSkeletons();
        showNotice('');
    }

    // Normal loads show the problem on the page; background refreshes just log it
    const report = (title, text = '', options = {}) => {
        if (silent) console.warn(title, text);
        else showState(title, text, options);
    };

    try {
        const { data: { session } } = await supabase.auth.getSession();
        if (thisRequest !== requestId) return;
        if (!session?.user) {
            report('Please log in to view jobs', '', { linkText: 'Log in', linkHref: 'login-type.html' });
            return;
        }
        const studentId = session.user.id;
        startLive(studentId);

        let { data: graduate, error: gradError } = await supabase
            .from('graduates')
            .select('qualification, field_of_study')
            .eq('id', studentId)
            .maybeSingle();

        // If the field_of_study column has not been added to the table yet, carry on without it
        if (gradError && /field_of_study/i.test(gradError.message)) {
            ({ data: graduate, error: gradError } = await supabase
                .from('graduates')
                .select('qualification')
                .eq('id', studentId)
                .maybeSingle());
        }

        if (thisRequest !== requestId) return;

        if (gradError) {
            report('Could not load your profile', gradError.message, { isError: true });
            return;
        }
        if (!graduate) {
            report('We could not find your graduate profile', '', {
                linkText: 'Complete your profile', linkHref: 'graduate-profile.html'
            });
            return;
        }

        const gradQualification = (graduate.qualification || '').trim();
        const gradText = graduateMatchText(graduate);

        const { data: jobs, error: jobsError } = await supabase
            .from('jobs')
            .select('*')
            .eq('visible', true)
            .order('created_at', { ascending: false });

        if (thisRequest !== requestId) return;

        if (jobsError) {
            report('Could not load jobs', jobsError.message, { isError: true });
            return;
        }

        const { data: applications, error: appError } = await supabase
            .from('applications')
            .select('job_id')
            .eq('student_id', studentId);
        if (appError) console.warn('Could not load your applications:', appError.message);

        if (thisRequest !== requestId) return;

        const appliedJobIds = new Set((applications || []).map(a => a.job_id));

        // No qualification on the profile: show everything instead of an empty page
        const filterByQualification = gradQualification.length > 0;
        showNotice(filterByQualification
            ? ''
            : 'Add your qualification to your profile to see jobs that match it. Showing all jobs for now.');

        allJobs = (jobs || [])
            .filter(job => !filterByQualification || qualificationMatches(gradText, job.required_qualifications))
            .map(job => ({ ...job, applied: appliedJobIds.has(job.id) }));

        renderChips();
        filterJobs();
    } catch (err) {
        console.error(err);
        report('Something went wrong', err && err.message ? err.message : 'Please refresh the page and try again.', { isError: true });
    }
}

/* ---------- live updates ---------- */
// When a recruiter posts, edits or removes a job, when this graduate applies for a job,
// or when this graduate changes their own profile, the list refreshes by itself.
let refreshTimer;
function refreshLive() {
    clearTimeout(refreshTimer);
    refreshTimer = setTimeout(() => loadJobs({ silent: true }), 400);
}

function startLive(studentId) {
    if (liveStarted) return;
    liveStarted = true;

    let hasConnectedBefore = false;
    supabase
        .channel('browse-jobs-live')
        .on('postgres_changes', { event: '*', schema: 'public', table: 'jobs' }, refreshLive)
        .on('postgres_changes',
            { event: '*', schema: 'public', table: 'applications', filter: `student_id=eq.${studentId}` },
            refreshLive)
        .on('postgres_changes',
            { event: '*', schema: 'public', table: 'graduates', filter: `id=eq.${studentId}` },
            refreshLive)
        .subscribe((status) => {
            if (status === 'SUBSCRIBED') {
                // After a dropped connection comes back, catch up on anything missed meanwhile
                if (hasConnectedBefore) refreshLive();
                hasConnectedBefore = true;
            }
        });
}

// Phones pause background tabs, so refresh when the graduate returns to the page
document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible' && liveStarted) refreshLive();
});

/* ---------- display ---------- */
function displayJobs(jobs) {
    publicJobList.innerHTML = '';

    if (!jobs || jobs.length === 0) {
        const searching = activeType || jobTitleSearch.value.trim();
        if (allJobs.length === 0) {
            showState('No jobs match your qualification yet', 'Please check back soon.');
        } else if (searching) {
            showState('No jobs match your search', 'Try a different job type or title.');
        } else {
            showState('No jobs available');
        }
        return;
    }

    resultCount.textContent = jobs.length + (jobs.length === 1 ? ' job found' : ' jobs found');

    jobs.forEach(job => {
        const li = document.createElement('li');
        li.className = 'job-card';

        const description = job.description || 'No description provided.';
        const maxLength = 150;
        const isLong = description.length > maxLength;
        const shortDesc = isLong ? description.slice(0, maxLength) + '...' : description;

        /* header: avatar, title, company */
        const head = document.createElement('div');
        head.className = 'card-head';

        const companyName = job.company_name || 'Not specified';
        const avatar = document.createElement('div');
        avatar.className = 'avatar';
        avatar.textContent = (job.company_name || '?').trim().charAt(0).toUpperCase() || '?';
        const colors = avatarColors(companyName);
        avatar.style.background = colors.bg;
        avatar.style.color = colors.fg;
        avatar.setAttribute('aria-hidden', 'true');

        const titleWrap = document.createElement('div');
        titleWrap.className = 'card-title';
        const title = document.createElement('h4');
        title.textContent = job.title || 'Untitled job';
        const company = document.createElement('p');
        company.className = 'company';
        company.textContent = companyName;
        titleWrap.append(title, company);

        head.append(avatar, titleWrap);
        li.appendChild(head);

        /* badges: job type and "New" */
        const badges = document.createElement('div');
        badges.className = 'badges';
        badges.appendChild(badge(job.job_type || 'Position type not specified'));
        const days = daysSince(job.created_at);
        if (days !== null && days <= 7) badges.appendChild(badge('New', 'new'));
        li.appendChild(badges);

        /* meta: location and qualifications */
        const meta = document.createElement('div');
        meta.className = 'meta';
        meta.appendChild(metaItem('pin', '', job.location || 'Location not specified'));
        meta.appendChild(metaItem('cap', 'Qualifications:', job.required_qualifications || 'None'));
        li.appendChild(meta);

        /* description */
        const descEl = document.createElement('p');
        descEl.className = 'desc';
        descEl.textContent = shortDesc;
        li.appendChild(descEl);

        if (isLong) {
            const viewMore = document.createElement('button');
            viewMore.type = 'button';
            viewMore.className = 'viewMore';
            viewMore.textContent = 'Show More';
            viewMore.addEventListener('click', () => {
                const expanded = viewMore.textContent === 'Show Less';
                descEl.textContent = expanded ? shortDesc : description;
                viewMore.textContent = expanded ? 'Show More' : 'Show Less';
            });
            li.appendChild(viewMore);
        }

        /* footer: posted date and apply button */
        const foot = document.createElement('div');
        foot.className = 'card-foot';

        const posted = document.createElement('small');
        posted.textContent = postedText(job.created_at);
        foot.appendChild(posted);

        const applyBtn = document.createElement('button');
        applyBtn.type = 'button';
        applyBtn.className = 'btn';
        if (job.applied) {
            applyBtn.textContent = 'Already Applied';
            applyBtn.disabled = true;
        } else {
            applyBtn.textContent = 'Apply';
            applyBtn.addEventListener('click', () => {
                const url = new URL('applicationform.html', window.location.href);
                url.searchParams.set('job_id', job.id);
                url.searchParams.set('job_title', job.title || '');
                window.location.href = url.toString();
            });
        }
        foot.appendChild(applyBtn);
        li.appendChild(foot);

        publicJobList.appendChild(li);
    });
}

/* ---------- filter / search ---------- */
function filterJobs() {
    const title = jobTitleSearch.value.trim().toLowerCase();

    const filtered = allJobs.filter(job => {
        const matchType = !activeType || typeKey(job.job_type) === activeType;
        const matchTitle = !title || (job.title || '').toLowerCase().includes(title);
        return matchType && matchTitle;
    });

    displayJobs(filtered);
}

typeChips.addEventListener('click', (event) => {
    const chip = event.target.closest('.chip');
    if (!chip) return;

    activeType = chip.dataset.type || '';
    typeChips.querySelectorAll('.chip').forEach(c => {
        const isActive = (c.dataset.type || '') === activeType;
        c.classList.toggle('active', isActive);
        c.setAttribute('aria-pressed', String(isActive));
    });
    filterJobs();
});

jobTitleSearch.addEventListener('input', filterJobs);

loadJobs();
