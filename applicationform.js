import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm';

const SUPABASE_URL = 'https://euclknvsppptbfclwxqq.supabase.co';
const SUPABASE_KEY = 'sb_publishable_90JbyFsa4BuuyeuLCIActg_yXfbHQ30';
const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

const BUCKET = 'cv_bucket';
const MAX_FILE_MB = 5;
const MAX_FILE_BYTES = MAX_FILE_MB * 1024 * 1024;

const $ = id => document.getElementById(id);

const form = $('applicationForm');
const fields = $('formFields');
const messageEl = $('formMessage');
const jobTitleEl = $('jobTitle');
const jobCompanyEl = $('jobCompany');
const nameInput = $('name');
const emailInput = $('email');
const cellInput = $('cellnumber');
const cvDefaultRadio = $('cvDefault');
const cvNewRadio = $('cvNew');
const optionDefault = $('optionDefault');
const optionNew = $('optionNew');
const defaultCvText = $('defaultCvText');
const newCvWrap = $('newCvWrap');
const newCVInput = $('newCV');
const fileInfo = $('fileInfo');
const coverLetterInput = $('coverLetter');
const coverCount = $('coverCount');
const previewBtn = $('previewCV');
const submitBtn = $('submitBtn');

let userId = null;
let jobId = null;
let recruiterId = null;
let defaultCVFileName = null;

/* ---------- small helpers ---------- */
function showMessage(text, type = 'info', linkText = '', linkHref = '') {
    messageEl.className = 'message ' + type;
    messageEl.textContent = text;
    if (linkHref) {
        messageEl.append(document.createTextNode(' '));
        const a = document.createElement('a');
        a.href = linkHref;
        a.textContent = linkText;
        if (/^https?:/i.test(linkHref)) {
            a.target = '_blank';
            a.rel = 'noopener';
        }
        messageEl.append(a);
    }
    messageEl.hidden = false;
}

function clearMessage() {
    messageEl.hidden = true;
    messageEl.textContent = '';
    messageEl.className = 'message';
}

// Locks the whole form and explains why
function blockForm(text, linkText = '', linkHref = '', type = 'error') {
    fields.disabled = true;
    showMessage(text, type, linkText, linkHref);
}

function setBusy(busy) {
    submitBtn.disabled = busy;
    previewBtn.disabled = busy;
    submitBtn.textContent = busy ? 'Submitting...' : 'Submit Application';
}

function getCvOption() {
    return form.querySelector("input[name='cvOption']:checked")?.value || 'default';
}

function formatSize(bytes) {
    return bytes < 1024 * 1024
        ? Math.max(1, Math.round(bytes / 1024)) + ' KB'
        : (bytes / (1024 * 1024)).toFixed(1) + ' MB';
}

// Keeps the stored file name free of spaces and odd characters that storage can reject
function safeFileName(name) {
    const dot = name.lastIndexOf('.');
    const base = (dot > 0 ? name.slice(0, dot) : name)
        .replace(/[^a-zA-Z0-9_-]+/g, '-')
        .replace(/^-+|-+$/g, '')
        .slice(0, 60) || 'cv';
    return base + '.pdf';
}

function validateFile(file) {
    const isPdf = file.type === 'application/pdf' || /\.pdf$/i.test(file.name);
    if (!isPdf) return 'Please choose a PDF file.';
    if (file.size > MAX_FILE_BYTES) {
        return `That file is ${formatSize(file.size)}. Please choose a PDF under ${MAX_FILE_MB} MB.`;
    }
    return '';
}

/* ---------- CV choice ---------- */
function updateCvUi() {
    const useDefault = getCvOption() === 'default';
    newCvWrap.hidden = useDefault;
    newCVInput.disabled = useDefault;
    if (useDefault) {
        newCVInput.value = '';
        fileInfo.textContent = '';
    }
    optionDefault.classList.toggle('selected', useDefault);
    optionNew.classList.toggle('selected', !useDefault);
}

cvDefaultRadio.addEventListener('change', updateCvUi);
cvNewRadio.addEventListener('change', updateCvUi);

newCVInput.addEventListener('change', () => {
    const file = newCVInput.files[0];
    if (!file) {
        fileInfo.textContent = '';
        return;
    }
    const problem = validateFile(file);
    if (problem) {
        showMessage(problem, 'error');
        newCVInput.value = '';
        fileInfo.textContent = '';
        return;
    }
    clearMessage();
    fileInfo.textContent = `${file.name} (${formatSize(file.size)})`;
});

/* ---------- cover letter counter ---------- */
function updateCoverCount() {
    coverCount.textContent = `${coverLetterInput.value.length} / ${coverLetterInput.maxLength}`;
}
coverLetterInput.addEventListener('input', updateCoverCount);
updateCoverCount();

/* ---------- load everything the page needs ---------- */
async function init() {
    const params = new URLSearchParams(window.location.search);
    jobId = params.get('job_id');
    const urlTitle = params.get('job_title');

    if (urlTitle) jobTitleEl.textContent = `Applying for: ${urlTitle}`;

    if (!jobId) {
        jobTitleEl.textContent = 'No job selected';
        blockForm('Choose a job first, then press Apply.', 'Browse jobs', 'browse-jobs.html');
        return;
    }

    try {
        const { data: { session } } = await supabase.auth.getSession();
        if (!session?.user) {
            jobTitleEl.textContent = 'Please log in';
            blockForm('You need to be logged in to apply.', 'Log in', 'login-type.html');
            return;
        }
        userId = session.user.id;

        // The job (also gives us the recruiter, so we don't need a second lookup when submitting)
        const { data: job, error: jobError } = await supabase
            .from('jobs')
            .select('title, company_name, recruiter_id')
            .eq('id', jobId)
            .maybeSingle();

        if (jobError || !job) {
            jobTitleEl.textContent = 'Job not found';
            blockForm('We could not find this job. It may have been removed.', 'Browse jobs', 'browse-jobs.html');
            return;
        }

        recruiterId = job.recruiter_id;
        jobTitleEl.textContent = `Applying for: ${job.title || urlTitle || 'this job'}`;
        if (job.company_name) {
            jobCompanyEl.textContent = job.company_name;
            jobCompanyEl.hidden = false;
        }

        // Your profile
        const { data: graduate, error: gradError } = await supabase
            .from('graduates')
            .select('full_name, email, phone, cv_url')
            .eq('id', userId)
            .maybeSingle();

        if (gradError || !graduate) {
            blockForm('We could not load your profile. Please complete it before applying.', 'My profile', 'graduate-profile.html');
            return;
        }

        nameInput.value = graduate.full_name || '';
        emailInput.value = graduate.email || session.user.email || '';
        cellInput.value = graduate.phone || '';

        defaultCVFileName = graduate.cv_url || null;
        if (defaultCVFileName) {
            defaultCvText.textContent = 'Saved on your profile: ' + defaultCVFileName;
        } else {
            defaultCvText.textContent = 'No default CV saved on your profile yet.';
            cvDefaultRadio.disabled = true;
            optionDefault.classList.add('is-disabled');
            cvNewRadio.checked = true;
        }
        updateCvUi();

        // Already applied?
        const { data: existing, error: existingError } = await supabase
            .from('applications')
            .select('job_id')
            .eq('job_id', jobId)
            .eq('student_id', userId)
            .limit(1);

        if (!existingError && existing && existing.length > 0) {
            blockForm('You have already applied for this job.', 'Back to jobs', 'browse-jobs.html', 'info');
            return;
        }

        fields.disabled = false;
    } catch (err) {
        console.error('init error:', err);
        blockForm('Something went wrong while loading this page: ' + (err.message || 'unknown error'));
    }
}

/* ---------- preview CV ---------- */
previewBtn.addEventListener('click', async () => {
    clearMessage();

    if (getCvOption() === 'new') {
        const file = newCVInput.files[0];
        if (!file) {
            showMessage('Choose a PDF to upload first.', 'error');
            return;
        }
        const problem = validateFile(file);
        if (problem) {
            showMessage(problem, 'error');
            return;
        }
        const url = URL.createObjectURL(file);
        window.open(url, '_blank');
        setTimeout(() => URL.revokeObjectURL(url), 60000);
        return;
    }

    if (!defaultCVFileName) {
        showMessage('You have no default CV saved on your profile.', 'error');
        return;
    }

    // Open the tab straight away (inside the click), so pop-up blockers allow it
    const win = window.open('', '_blank');
    try {
        const { data, error } = await supabase.storage
            .from(BUCKET)
            .createSignedUrl(`graduates/${userId}/${defaultCVFileName}`, 120);
        if (error) throw error;

        if (win) {
            win.location.href = data.signedUrl;
        } else {
            showMessage('Your browser blocked the pop-up.', 'info', 'Open your CV', data.signedUrl);
        }
    } catch (err) {
        if (win) win.close();
        console.error('Preview error:', err);
        showMessage('Could not open your CV: ' + (err.message || 'unknown error'), 'error');
    }
});

/* ---------- submit ---------- */
form.addEventListener('submit', async (event) => {
    event.preventDefault();
    clearMessage();

    const option = getCvOption();
    let file = null;

    if (option === 'default') {
        if (!defaultCVFileName) {
            showMessage('You have no default CV. Please upload a new one.', 'error');
            return;
        }
    } else {
        file = newCVInput.files[0];
        if (!file) {
            showMessage('Please choose a PDF to upload.', 'error');
            return;
        }
        const problem = validateFile(file);
        if (problem) {
            showMessage(problem, 'error');
            return;
        }
    }

    setBusy(true);
    let uploadedPath = null;
    let finished = false;

    try {
        const { data: { session } } = await supabase.auth.getSession();
        if (!session?.user) {
            showMessage('Your session has expired. Please log in again.', 'error', 'Log in', 'login-type.html');
            return;
        }

        let finalCVPath;
        if (option === 'default') {
            finalCVPath = `graduates/${userId}/${defaultCVFileName}`;
        } else {
            // Unique name, so a new upload can never overwrite your default CV or an earlier application
            const path = `graduates/${userId}/${Date.now()}-${safeFileName(file.name)}`;
            const { error: uploadError } = await supabase.storage
                .from(BUCKET)
                .upload(path, file, { upsert: false, contentType: 'application/pdf' });
            if (uploadError) throw new Error('CV upload failed: ' + uploadError.message);
            uploadedPath = path;
            finalCVPath = path;
        }

        const { error: insertError } = await supabase
            .from('applications')
            .insert([{
                job_id: jobId,
                student_id: userId,
                recruiter_id: recruiterId,
                cv_url: finalCVPath,
                cover_letter: coverLetterInput.value.trim() || null,
                status: 'pending',
                created_at: new Date().toISOString()
            }]);

        if (insertError) {
            // Tidy up the file we just uploaded, since the application did not go through
            if (uploadedPath) await supabase.storage.from(BUCKET).remove([uploadedPath]);

            if (insertError.code === '23505') {
                blockForm('You have already applied for this job.', 'Back to jobs', 'browse-jobs.html', 'info');
                finished = true;
                return;
            }
            throw new Error('Application failed: ' + insertError.message);
        }

        finished = true;
        fields.disabled = true;
        showMessage('Application submitted! Taking you back to the jobs...', 'success');
        setTimeout(() => { window.location.href = 'browse-jobs.html'; }, 1800);

    } catch (err) {
        console.error('Submit error:', err);
        showMessage(err.message || 'Something went wrong. Please try again.', 'error');
    } finally {
        if (!finished) setBusy(false);
    }
});

init();
