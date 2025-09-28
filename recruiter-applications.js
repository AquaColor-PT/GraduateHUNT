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
        if (!jobs || jobs.length === 0) {
            applicationsContainer.innerHTML = '<p class="no-applications">You have not posted any jobs yet.</p>';
            return;
        }
        allJobs = jobs;

        // Get applications for these jobs
        const jobIds = jobs.map(j => j.id);
        const { data: applications, error: appsError } = await supabase
            .from('applications')
            .select('*')
            .in('job_id', jobIds)
            .order('created_at', { ascending: false });

        if (appsError) throw appsError;
        allApplications = applications || [];

        // Fetch graduates for applications
        const studentIds = [...new Set(allApplications.map(a => a.student_id))];
        const { data: students, error: studentsError } = await supabase
            .from('graduates')
            .select('id, full_name, email, phone')
            .in('id', studentIds);

        if (studentsError) throw studentsError;

        const studentMap = {};
        students.forEach(s => studentMap[s.id] = s);

        displayApplications(allApplications, studentMap);

    } catch (err) {
        console.error("Error loading applications:", err);
        applicationsContainer.innerHTML = `<p class="error">Error loading applications: ${err.message}</p>`;
    }
}

// Display applications grouped by job
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

    // Ensure all jobs appear, even if no applications
    allJobs.forEach(j => {
        if (!grouped[j.title]) grouped[j.title] = [];
    });

    // Sort job titles based on search input
    const sortedJobTitles = Object.keys(grouped).sort((a, b) => {
        if (a.toLowerCase().includes(searchTerm)) return -1;
        if (b.toLowerCase().includes(searchTerm)) return 1;
        return 0;
    });

    // Create HTML for each job group
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

                appDiv.innerHTML = `
                    <div>
                        <div><strong>Graduate:</strong> ${name}</div>
                        <div><strong>Email:</strong> ${email}</div>
                        <div><strong>Phone:</strong> ${phone}</div>
                        ${app.cover_letter ? `<div><strong>Message:</strong> ${app.cover_letter}</div>` : ''}
                        ${app.cv_url ? `<div><a href="${supabase.storage.from('cv_bucket').getPublicUrl(app.cv_url).data.publicUrl}" target="_blank" class="cv-link">View CV</a></div>` : ''}
                        <div><strong>Status:</strong> ${app.status}</div>
                        <div><small>Applied on: ${new Date(app.created_at).toLocaleDateString()}</small></div>
                        <div class="btn-group">
                            <button class="btn delete-btn" data-id="${app.id}">Delete</button>
                            <button class="btn reply-btn" data-student-id="${app.student_id}">Reply</button>
                        </div>
                    </div>
                `;

                // Event listener for Reply button
                appDiv.querySelector('.reply-btn').addEventListener('click', () => {
                    const jobTitle = allJobs.find(j => j.id === app.job_id)?.title || 'Job Post';
                    window.location.href = `recruiter-message.html?studentId=${app.student_id}&jobId=${app.job_id}&jobTitle=${encodeURIComponent(jobTitle)}`;
                });

                appListDiv.appendChild(appDiv);
            });
        }

        jobGroupDiv.appendChild(appListDiv);
        applicationsContainer.appendChild(jobGroupDiv);
    });
}


// Event delegation for DELETE buttons
applicationsContainer.addEventListener('click', async (e) => {
    const btn = e.target.closest('.delete-btn');
    if (!btn) return;

    const appId = btn.dataset.id;
    if (!appId) return;

    if (!confirm("Are you sure you want to delete this application?")) return;

    const { error } = await supabase
        .from('applications')
        .delete()
        .eq('id', appId);

    if (error) {
        alert("Failed to delete application: " + error.message);
    } else {
        loadApplications(); // reload to show "No applications yet" if needed
    }
});

// Update application status
async function updateStatus(appId, status) {
    const { error } = await supabase
        .from('applications')
        .update({ status })
        .eq('id', appId);

    if (error) alert("Failed to update status: " + error.message);
    else loadApplications();
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
