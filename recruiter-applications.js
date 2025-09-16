import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js/+esm';

const SUPABASE_URL = 'https://euclknvsppptbfclwxqq.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImV1Y2xrbnZzcHBwdGJmY2x3eHFxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTc2Mjc2NTQsImV4cCI6MjA3MzIwMzY1NH0.HlGW3kZJ4CPnF2JuZGs_4ObkhxwVFTSedb7O8HHDEag';
const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

const applicationsContainer = document.getElementById('applicationsContainer');
const logoutBtn = document.getElementById('logoutBtn');
const jobSearchInput = document.getElementById('jobSearch');

let currentUserId = null;
let allJobs = [];
let allApplications = [];

async function checkUser() {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session?.user) {
        alert("Please log in first.");
        window.location.href = "recruiter-login.html";
        return;
    }
    currentUserId = session.user.id;
    await loadApplications();
}

async function loadApplications() {
    applicationsContainer.innerHTML = '<p class="loading">Loading applications...</p>';

    try {
        // 1. Get jobs posted by recruiter
        const { data: jobs, error: jobsError } = await supabase
            .from('jobs')
            .select('id, title')
            .eq('recruiter_id', currentUserId);

        if (jobsError) throw jobsError;
        if (!jobs || jobs.length === 0) {
            applicationsContainer.innerHTML = '<p class="no-applications">You have not posted any jobs yet.</p>';
            return;
        }
        allJobs = jobs;

        const jobIds = jobs.map(j => j.id);

        // 2. Get applications
        const { data: applications, error: appsError } = await supabase
            .from('applications')
            .select('*')
            .in('job_id', jobIds)
            .order('created_at', { ascending: false });

        if (appsError) throw appsError;

        allApplications = applications || [];
        displayApplications(allApplications);
    } catch (err) {
        console.error("Error loading applications:", err);
        applicationsContainer.innerHTML = `<p class="error">Error loading applications: ${err.message}</p>`;
    }
}

function displayApplications(applications) {
    const searchTerm = jobSearchInput.value.toLowerCase();
    applicationsContainer.innerHTML = '';

    // group applications by job
    const grouped = {};
    applications.forEach(app => {
        const jobTitle = allJobs.find(j => j.id === app.job_id)?.title || 'Unknown Job';
        if (!grouped[jobTitle]) grouped[jobTitle] = [];
        grouped[jobTitle].push(app);
    });

    // sort job groups: searched job first
    const sortedJobTitles = Object.keys(grouped).sort((a,b) => {
        if (a.toLowerCase().includes(searchTerm)) return -1;
        if (b.toLowerCase().includes(searchTerm)) return 1;
        return 0;
    });

    sortedJobTitles.forEach(jobTitle => {
        const jobGroupDiv = document.createElement('div');
        jobGroupDiv.classList.add('job-group');

        const titleEl = document.createElement('div');
        titleEl.classList.add('job-title');
        titleEl.textContent = jobTitle;
        jobGroupDiv.appendChild(titleEl);

        const appListDiv = document.createElement('div');
        appListDiv.classList.add('applicationsList');

        grouped[jobTitle].forEach(app => {
            const appDiv = document.createElement('div');
            appDiv.classList.add('application-item');

            appDiv.innerHTML = `
                <div><strong>Graduate:</strong> ${app.student_name || 'Unknown'} (${app.student_email || 'N/A'})</div>
                ${app.cover_letter ? `<div><strong>Message:</strong> ${app.cover_letter}</div>` : ''}
                ${app.cv_url ? `<div><a href="${supabase.storage.from('cv_bucket').getPublicUrl(app.cv_url).data.publicUrl}" target="_blank">View CV</a></div>` : ''}
                <div><strong>Status:</strong> ${app.status}</div>
                <div><small>Applied on: ${new Date(app.created_at).toLocaleDateString()}</small></div>
                <button class="accept-btn">Accept</button>
                <button class="reject-btn">Reject</button>
                <button class="delete-btn">Delete</button>
            `;

            // Accept/reject/delete handlers
            appDiv.querySelector('.accept-btn').addEventListener('click', async () => updateStatus(app.id, 'accepted'));
            appDiv.querySelector('.reject-btn').addEventListener('click', async () => updateStatus(app.id, 'rejected'));
            appDiv.querySelector('.delete-btn').addEventListener('click', async () => deleteApplication(app.id));

            appListDiv.appendChild(appDiv);
        });

        jobGroupDiv.appendChild(appListDiv);
        applicationsContainer.appendChild(jobGroupDiv);
    });
}

async function updateStatus(appId, status) {
    const { error } = await supabase.from('applications').update({ status }).eq('id', appId);
    if (error) alert("Failed to update status: " + error.message);
    else loadApplications();
}

async function deleteApplication(appId) {
    const confirmDelete = confirm("Are you sure you want to delete this application?");
    if (!confirmDelete) return;
    const { error } = await supabase.from('applications').delete().eq('id', appId);
    if (error) alert("Failed to delete application: " + error.message);
    else loadApplications();
}

// search filter
jobSearchInput.addEventListener('input', () => displayApplications(allApplications));

// logout
logoutBtn.addEventListener('click', async () => {
    await supabase.auth.signOut();
    window.location.href = 'home-page.html';
});

checkUser();
