import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js/+esm';

const SUPABASE_URL = 'https://euclknvsppptbfclwxqq.supabase.co';
const SUPABASE_KEY = 'sb_publishable_90JbyFsa4BuuyeuLCIActg_yXfbHQ30';
const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

const applicationsContainer = document.getElementById('applicationsContainer');
const logoutBtn = document.getElementById('logoutBtn');
const jobSearchInput = document.getElementById('jobSearch');

let currentUserId = null;
let allJobs = [];
let allApplications = [];
let studentMap = {};

// Escape any user-supplied text before putting it into innerHTML
const esc = s =>
    String(s ?? '').replace(/[&<>"']/g, c => ({
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#39;'
    }[c]));

// Check if recruiter is logged in
async function checkUser() {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session?.user) {
        alert('Please log in first.');
        window.location.href = 'recruiter-login.html';
        return;
    }
    currentUserId = session.user.id;
    await loadApplications();
}

// Load jobs, applications and student details from the database
async function loadApplications() {
    applicationsContainer.innerHTML = '<p class="loading">Loading applications...</p>';

    try {
        // Jobs posted by this recruiter
        const { data: jobs, error: jobsError } = await supabase
            .from('jobs')
            .select('id, title')
            .eq('recruiter_id', currentUserId);

        if (jobsError) throw jobsError;
        allJobs = jobs || [];
        allApplications = [];
        studentMap = {};

        if (!allJobs.length) {
            applicationsContainer.innerHTML = '<p class="loading">You have not posted any jobs yet.</p>';
            return;
        }

        // Applications for those jobs
        const jobIds = allJobs.map(j => j.id);
        const { data: applications, error: appsError } = await supabase
            .from('applications')
            .select('*')
            .in('job_id', jobIds)
            .order('created_at', { ascending: false });

        if (appsError) throw appsError;
        allApplications = applications || [];

        // Student details (only if there are applications)
        const studentIds = [...new Set(allApplications.map(a => a.student_id))];
        if (studentIds.length) {
            const { data: students, error: studentsError } = await supabase
                .from('graduates')
                .select('id, full_name, email, phone')
                .in('id', studentIds);

            if (studentsError) throw studentsError;
            (students || []).forEach(s => { studentMap[s.id] = s; });
        }

        displayApplications();
    } catch (err) {
        applicationsContainer.innerHTML = `<p class="error">Error loading applications: ${esc(err.message)}</p>`;
    }
}

// Update status, then go to the message page
async function updateStatus(app, status) {
    const { error } = await supabase
        .from('applications')
        .update({ status })
        .eq('id', app.id);

    if (error) {
        alert(`Failed to ${status === 'Accepted' ? 'accept' : 'reject'} application: ${error.message}`);
        return;
    }

    const jobTitle = allJobs.find(j => j.id === app.job_id)?.title || 'Job Post';
    window.location.href =
        `recruiter-message.html?studentId=${encodeURIComponent(app.student_id)}` +
        `&jobId=${encodeURIComponent(app.job_id)}` +
        `&jobTitle=${encodeURIComponent(jobTitle)}`;
}

// Open a CV using a short-lived signed URL (works for private buckets)
async function openCv(path) {
    const win = window.open('', '_blank'); // open now so the popup blocker allows it
    const { data, error } = await supabase.storage
        .from('cv_bucket')
        .createSignedUrl(path, 3600);

    if (error || !data?.signedUrl) {
        if (win) win.close();
        alert('Could not open CV: ' + (error?.message || 'unknown error'));
        return;
    }
    if (win) {
        win.opener = null;
        win.location.href = data.signedUrl;
    }
}

// Build one application row (same markup/look as the original)
function buildApplicationItem(app) {
    const student = studentMap[app.student_id] || {};
    const name = student.full_name || 'Unknown';
    const email = student.email || 'N/A';
    const phone = student.phone || 'N/A';

    let statusClass = 'status-pending';
    if (app.status === 'Accepted') statusClass = 'status-accepted';
    if (app.status === 'Rejected') statusClass = 'status-rejected';

    const appDiv = document.createElement('div');
    appDiv.classList.add('application-item');

    appDiv.innerHTML = `
        <div>
            <div><strong>${esc(name)}</strong></div>
            <div>Email: ${esc(email)}</div>
            <div>Phone: ${esc(phone)}</div>
            ${app.cover_letter ? `<div>Message: ${esc(app.cover_letter)}</div>` : ''}
            ${app.cv_url ? '<div><a href="#" class="cv-link">View CV</a></div>' : ''}
            <div>Status: <span class="badge ${statusClass}">${esc(app.status || 'Pending')}</span></div>
            <div>Applied on: ${esc(new Date(app.created_at).toLocaleDateString())}</div>
        </div>
        <div>
            ${app.status !== 'Accepted' ? '<button class="accept-btn">Accept</button>' : ''}
            ${app.status !== 'Rejected' ? '<button class="reject-btn">Reject</button>' : ''}
            <button class="delete-btn">Delete</button>
        </div>
    `;

    const cvLink = appDiv.querySelector('.cv-link');
    if (cvLink) {
        cvLink.addEventListener('click', e => {
            e.preventDefault();
            openCv(app.cv_url);
        });
    }

    appDiv.querySelector('.accept-btn')?.addEventListener('click', () => updateStatus(app, 'Accepted'));
    appDiv.querySelector('.reject-btn')?.addEventListener('click', () => updateStatus(app, 'Rejected'));

    appDiv.querySelector('.delete-btn').addEventListener('click', async () => {
        if (!confirm('Are you sure you want to delete this application?')) return;
        const { error } = await supabase.from('applications').delete().eq('id', app.id);
        if (error) alert('Failed to delete application: ' + error.message);
        else loadApplications();
    });

    return appDiv;
}

// Display applications grouped by job (filtered locally by the search box)
function displayApplications() {
    const searchTerm = jobSearchInput.value.trim().toLowerCase();
    applicationsContainer.innerHTML = '';

    // Group by job id so two jobs with the same title stay separate
    const visibleJobs = allJobs.filter(j => (j.title || '').toLowerCase().includes(searchTerm));

    if (!visibleJobs.length) {
        applicationsContainer.innerHTML = '<p class="loading">No jobs match your search.</p>';
        return;
    }

    visibleJobs.forEach(job => {
        const jobGroupDiv = document.createElement('div');
        jobGroupDiv.classList.add('job-group');

        const titleEl = document.createElement('div');
        titleEl.classList.add('job-title');
        titleEl.textContent = job.title || 'Untitled Job';
        jobGroupDiv.appendChild(titleEl);

        const appListDiv = document.createElement('div');
        appListDiv.classList.add('applicationsList');

        const appsForJob = allApplications.filter(a => a.job_id === job.id);

        if (!appsForJob.length) {
            const noAppsMsg = document.createElement('div');
            noAppsMsg.textContent = 'No applications yet.';
            noAppsMsg.style.fontStyle = 'italic';
            noAppsMsg.style.color = '#666';
            appListDiv.appendChild(noAppsMsg);
        } else {
            appsForJob.forEach(app => appListDiv.appendChild(buildApplicationItem(app)));
        }

        jobGroupDiv.appendChild(appListDiv);
        applicationsContainer.appendChild(jobGroupDiv);
    });
}

// Search filter (no database call, just re-render)
jobSearchInput.addEventListener('input', displayApplications);

// Logout
logoutBtn.addEventListener('click', async e => {
    e.preventDefault();
    await supabase.auth.signOut();
    window.location.href = 'homepage.html';
});

// Initial load
checkUser();
