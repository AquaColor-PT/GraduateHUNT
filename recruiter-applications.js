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

// Check if recruiter is logged in
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

// Load applications for recruiter's jobs
async function loadApplications() {
    applicationsContainer.innerHTML = '<p class="loading">Loading applications...</p>';

    try {
        // Get jobs posted by recruiter
        const { data: jobs, error: jobsError } = await supabase
            .from('jobs')
            .select('id, title')
            .eq('recruiter_id', currentUserId);

        if (jobsError) throw jobsError;
        allJobs = jobs || [];

        const jobIds = allJobs.map(j => j.id);
        const { data: applications, error: appsError } = await supabase
            .from('applications')
            .select('*')
            .in('job_id', jobIds)
            .order('created_at', { ascending: false });

        if (appsError) throw appsError;
        allApplications = applications || [];

        const studentIds = [...new Set(allApplications.map(a => a.student_id))];
        const { data: students } = await supabase
            .from('graduates')
            .select('id, full_name, email, phone')
            .in('id', studentIds);

        const studentMap = {};
        (students || []).forEach(s => studentMap[s.id] = s);

        displayApplications(allApplications, studentMap);

    } catch (err) {
        applicationsContainer.innerHTML = `<p class="error">Error loading applications: ${err.message}</p>`;
    }
}

// Display applications grouped by job
function displayApplications(applications, studentMap) {
    const searchTerm = jobSearchInput.value.toLowerCase();
    applicationsContainer.innerHTML = '';

    // Group applications by job
    const grouped = {};
    applications.forEach(app => {
        const jobTitle = allJobs.find(j => j.id === app.job_id)?.title || 'Unknown Job';
        if (!grouped[jobTitle]) grouped[jobTitle] = [];
        grouped[jobTitle].push(app);
    });

    // Ensure all jobs appear even if no applications
    allJobs.forEach(j => {
        if (!grouped[j.title]) grouped[j.title] = [];
    });

    // Sort job titles based on search input
    const sortedJobTitles = Object.keys(grouped).sort((a, b) => {
        if (a.toLowerCase().includes(searchTerm)) return -1;
        if (b.toLowerCase().includes(searchTerm)) return 1;
        return 0;
    });

    // Render each job group
    sortedJobTitles.forEach(jobTitle => {
        const jobGroupDiv = document.createElement('div');
        jobGroupDiv.classList.add('job-group');

        const titleEl = document.createElement('div');
        titleEl.classList.add('job-title');
        titleEl.textContent = jobTitle;
        jobGroupDiv.appendChild(titleEl);

        const appListDiv = document.createElement('div');
        appListDiv.classList.add('applicationsList');

        const appsForJob = grouped[jobTitle];
        if (!appsForJob || appsForJob.length === 0) {
            const noAppsMsg = document.createElement('div');
            noAppsMsg.textContent = "No applications yet.";
            noAppsMsg.style.fontStyle = "italic";
            noAppsMsg.style.color = "#666";
            appListDiv.appendChild(noAppsMsg);
        } else {
            appsForJob.forEach(app => {
                const student = studentMap[app.student_id] || {};
                const name = student.full_name || 'Unknown';
                const email = student.email || 'N/A';
                const phone = student.phone || 'N/A';

                const appDiv = document.createElement('div');
                appDiv.classList.add('application-item');

                let statusClass = 'status-pending';
                if (app.status === 'Accepted') statusClass = 'status-accepted';
                if (app.status === 'Rejected') statusClass = 'status-rejected';

                appDiv.innerHTML = `
                    <div>
                        <div><strong>${name}</strong></div>
                        <div>Email: ${email}</div>
                        <div>Phone: ${phone}</div>
                        ${app.cover_letter ? `<div>Message: ${app.cover_letter}</div>` : ''}
                        ${app.cv_url ? `<div><a href="${supabase.storage.from('cv_bucket').getPublicUrl(app.cv_url).data.publicUrl}" target="_blank">View CV</a></div>` : ''}
                        <div>Status: <span class="badge ${statusClass}">${app.status}</span></div>
                        <div>Applied on: ${new Date(app.created_at).toLocaleDateString()}</div>
                    </div>
                    <div>
                        <button class="accept-btn" data-id="${app.id}" data-student-id="${app.student_id}">Accept</button>
                        <button class="reject-btn" data-id="${app.id}" data-student-id="${app.student_id}">Reject</button>
                        <button class="delete-btn" data-id="${app.id}">Delete</button>
                        
                    </div>
                `;

                // Accept
                appDiv.querySelector('.accept-btn').addEventListener('click', async () => {
                    const appId = app.id;
                    const studentId = app.student_id;
                    const { error } = await supabase
                        .from('applications')
                        .update({ status: 'Accepted' })
                        .eq('id', appId);

                    if (error) alert("Failed to accept application: " + error.message);
                    else {
                        const jobTitle = allJobs.find(j => j.id === app.job_id)?.title || 'Job Post';
                        window.location.href = `recruiter-message.html?studentId=${studentId}&jobId=${app.job_id}&jobTitle=${encodeURIComponent(jobTitle)}`;
                    }
                });

                // Reject
                appDiv.querySelector('.reject-btn').addEventListener('click', async () => {
                    const appId = app.id;
                    const studentId = app.student_id;

                    const { error } = await supabase
                        .from('applications')
                        .update({ status: 'Rejected' })
                        .eq('id', appId);

                    if (error) alert("Failed to reject application: " + error.message);
                    else {
                        const jobTitle = allJobs.find(j => j.id === app.job_id)?.title || 'Job Post';
                        window.location.href = `recruiter-message.html?studentId=${studentId}&jobId=${app.job_id}&jobTitle=${encodeURIComponent(jobTitle)}`;
                    }
                });

                // Reply
               

                // Delete
                appDiv.querySelector('.delete-btn').addEventListener('click', async () => {
                    if (!confirm("Are you sure you want to delete this application?")) return;
                    const { error } = await supabase.from('applications').delete().eq('id', app.id);
                    if (error) alert("Failed to delete application: " + error.message);
                    else loadApplications();
                });

                appListDiv.appendChild(appDiv);
            });
        }

        jobGroupDiv.appendChild(appListDiv);
        applicationsContainer.appendChild(jobGroupDiv);
    });
}

// Search filter
jobSearchInput.addEventListener('input', () => loadApplications());

// Logout
logoutBtn.addEventListener('click', async () => {
    await supabase.auth.signOut();
    window.location.href = 'homepage.html';
});

// Initial load
checkUser();
