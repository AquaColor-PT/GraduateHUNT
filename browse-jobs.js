import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm';

const SUPABASE_URL = 'https://euclknvsppptbfclwxqq.supabase.co';
const SUPABASE_KEY = 'sb_publishable_90JbyFsa4BuuyeuLCIActg_yXfbHQ30';
const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

const publicJobList = document.getElementById('publicJobList');
const jobTypeFilter = document.getElementById('jobTypeFilter');
const jobTitleSearch = document.getElementById('jobTitleSearch');
const notice = document.getElementById('notice');

let allJobs = [];

/* ---------- small DOM helpers (textContent only, so job data can never inject HTML) ---------- */
function showMessage(text, className = '', linkText = '', linkHref = '') {
    publicJobList.innerHTML = '';
    const li = document.createElement('li');
    if (className) li.className = className;
    li.append(document.createTextNode(text));
    if (linkHref) {
        li.append(document.createTextNode(' '));
        const a = document.createElement('a');
        a.href = linkHref;
        a.textContent = linkText;
        li.append(a);
    }
    publicJobList.appendChild(li);
}

function showNotice(text) {
    notice.textContent = text;
    notice.hidden = !text;
}

function field(label, value) {
    const div = document.createElement('div');
    const strong = document.createElement('strong');
    strong.textContent = label + ' ';
    div.append(strong, document.createTextNode(value));
    return div;
}

/* ---------- qualification matching ---------- */
// Words that say nothing about the field of study. Without this list, a word like
// "in" or "degree" made almost every job "match" every graduate.
const STOP_WORDS = new Set([
    'in', 'of', 'and', 'the', 'for', 'with', 'to', 'an', 'or', 'on', 'at', 'by', 'from',
    'degree', 'degrees', 'diploma', 'diplomas', 'bachelor', 'bachelors', 'certificate',
    'national', 'higher', 'advanced', 'honours', 'hons', 'bsc', 'btech', 'beng',
    'nqf', 'level', 'qualification', 'qualifications', 'related', 'field', 'equivalent',
    'relevant', 'matric', 'grade', 'plus'
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

function qualificationMatches(gradQualification, jobQualification) {
    // A job that asks for nothing specific is open to every graduate
    if (!jobQualification || !jobQualification.trim()) return true;

    const jobWords = keywords(jobQualification);
    if (jobWords.length === 0) return true;      // e.g. only says "Matric"

    const gradWords = keywords(gradQualification);
    return gradWords.some(g => jobWords.some(j => wordsMatch(g, j)));
}

/* ---------- load data ---------- */
async function loadJobs() {
    showMessage('Loading jobs...', 'loading');
    showNotice('');

    try {
        const { data: { session } } = await supabase.auth.getSession();
        if (!session?.user) {
            showMessage('Please log in to view jobs.', '', 'Log in', 'login-type.html');
            return;
        }
        const studentId = session.user.id;

        const { data: graduate, error: gradError } = await supabase
            .from('graduates')
            .select('qualification')
            .eq('id', studentId)
            .maybeSingle();

        if (gradError) {
            showMessage('Error fetching graduate profile: ' + gradError.message, 'error');
            return;
        }
        if (!graduate) {
            showMessage('We could not find your graduate profile.', '', 'Complete your profile', 'graduate-profile.html');
            return;
        }

        const gradQualification = (graduate.qualification || '').trim();

        const { data: jobs, error: jobsError } = await supabase
            .from('jobs')
            .select('*')
            .eq('visible', true)
            .order('created_at', { ascending: false });

        if (jobsError) {
            showMessage('Error fetching jobs: ' + jobsError.message, 'error');
            return;
        }

        const { data: applications, error: appError } = await supabase
            .from('applications')
            .select('job_id')
            .eq('student_id', studentId);
        if (appError) console.warn('Could not load your applications:', appError.message);

        const appliedJobIds = new Set((applications || []).map(a => a.job_id));

        // No qualification on the profile: show everything instead of an empty page
        const filterByQualification = gradQualification.length > 0;
        if (!filterByQualification) {
            showNotice('Add your qualification to your profile to see jobs that match it. Showing all jobs for now.');
        }

        allJobs = (jobs || [])
            .filter(job => !filterByQualification || qualificationMatches(gradQualification, job.required_qualifications))
            .map(job => ({ ...job, applied: appliedJobIds.has(job.id) }));

        filterJobs();
    } catch (err) {
        console.error(err);
        showMessage('Something went wrong while loading jobs. Please refresh the page.', 'error');
    }
}

/* ---------- display ---------- */
function displayJobs(jobs) {
    publicJobList.innerHTML = '';

    if (!jobs || jobs.length === 0) {
        const searching = jobTypeFilter.value || jobTitleSearch.value.trim();
        showMessage(allJobs.length === 0
            ? 'No jobs match your qualification yet. Please check back soon.'
            : (searching ? 'No jobs match your search.' : 'No jobs available.'));
        return;
    }

    jobs.forEach(job => {
        const li = document.createElement('li');
        const description = job.description || 'No description provided.';
        const maxLength = 150;
        const isLong = description.length > maxLength;
        const shortDesc = isLong ? description.slice(0, maxLength) + '...' : description;

        const title = document.createElement('h4');
        title.textContent = job.title || 'Untitled job';
        li.appendChild(title);

        li.appendChild(field('Company:', job.company_name || 'Not specified'));
        li.appendChild(field('Location:', job.location || 'Not specified'));
        li.appendChild(field('Position Type:', job.job_type || 'Not specified'));
        li.appendChild(field('Qualifications Required:', job.required_qualifications || 'None'));

        const descLabel = document.createElement('div');
        const descStrong = document.createElement('strong');
        descStrong.textContent = 'Job Description:';
        descLabel.appendChild(descStrong);
        li.appendChild(descLabel);

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

        const posted = document.createElement('small');
        posted.textContent = 'Posted on: ' + (job.created_at ? new Date(job.created_at).toLocaleDateString() : 'Unknown');
        li.appendChild(posted);

        const applyBtn = document.createElement('button');
        applyBtn.type = 'button';
        applyBtn.className = 'blue-btn applyBtn';
        if (job.applied) {
            applyBtn.textContent = 'Already Applied';
            applyBtn.disabled = true;               // grey look comes from .blue-btn:disabled in the CSS
        } else {
            applyBtn.textContent = 'Apply';
            applyBtn.addEventListener('click', () => {
                const url = new URL('applicationform.html', window.location.href);
                url.searchParams.set('job_id', job.id);
                url.searchParams.set('job_title', job.title || '');
                window.location.href = url.toString();
            });
        }
        li.appendChild(applyBtn);

        publicJobList.appendChild(li);
    });
}

/* ---------- filter / search ---------- */
function filterJobs() {
    const type = jobTypeFilter.value.toLowerCase();
    const title = jobTitleSearch.value.trim().toLowerCase();

    const filtered = allJobs.filter(job => {
        const matchType = !type || (job.job_type || '').toLowerCase() === type;
        const matchTitle = !title || (job.title || '').toLowerCase().includes(title);
        return matchType && matchTitle;
    });

    displayJobs(filtered);
}

jobTypeFilter.addEventListener('change', filterJobs);
jobTitleSearch.addEventListener('input', filterJobs);
document.getElementById('searchBtn').addEventListener('click', filterJobs);

loadJobs();
