import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js/+esm';

const SUPABASE_URL = 'https://euclknvsppptbfclwxqq.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImV1Y2xrbnZzcHBwdGJmY2x3eHFxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTc2Mjc2NTQsImV4cCI6MjA3MzIwMzY1NH0.HlGW3kZJ4CPnF2JuZGs_4ObkhxwVFTSedb7O8HHDEag';
const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

// Elements
const profilePicEl = document.getElementById('profilePic');
const profileNameEl = document.getElementById('profileName');
const profileCompanyEl = document.getElementById('profileCompany');
const profileCreditsEl = document.getElementById('profileCredits');
const jobForm = document.getElementById('jobForm');
const jobListEl = document.getElementById('jobList');
const logoutBtn = document.getElementById('logoutBtn');

let currentUserId = null;
let editingJobId = null; // Track which job is being edited

// ---------------- AUTH CHECK ----------------
async function checkUser() {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session?.user) {
        alert("Please log in first.");
        window.location.href = "recruiter-login.html";
        return;
    }
    currentUserId = session.user.id;
    await loadProfile();
    await loadJobs();
}
checkUser();

// ---------------- LOAD PROFILE ----------------
// Add this at the top
const profilePicContainer = document.getElementById('profilePicContainer');

// ---------------- LOAD PROFILE ----------------
async function loadProfile() {
    const { data, error } = await supabase
        .from('recruiters')
        .select('*')
        .eq('id', currentUserId)
        .single();

    if (error) return console.error("Failed to load profile:", error);

    profileNameEl.textContent = `${data.first_name} ${data.last_name}`;
    profileCompanyEl.textContent = data.company_name || 'Your Company/Agency';
    profileCreditsEl.textContent = `Credits: ${data.credits || 0}`;

    if (data.profile_url) {
        try {
            const { data: urlData, error: urlError } = supabase
                .storage
                .from('recruiter-profile-pics')
                .getPublicUrl(data.profile_url);

            if (urlError || !urlData?.publicUrl) {
                console.error("Failed to get profile pic URL", urlError);
                profilePicEl.style.display = 'none';
                profilePicContainer.style.display = 'flex'; // show placeholder
            } else {
                profilePicEl.src = urlData.publicUrl;
                profilePicEl.style.display = 'block';
                profilePicContainer.style.display = 'none';
            }
        } catch (err) {
            console.error("Unexpected error loading profile pic:", err);
            profilePicEl.style.display = 'none';
            profilePicContainer.style.display = 'flex';
        }
    } else {
        // No profile picture uploaded
        profilePicEl.style.display = 'none';
        profilePicContainer.style.display = 'flex';
    }
}












// ---------------- LOAD JOBS ----------------
async function loadJobs() {
    jobListEl.innerHTML = '';
    const { data, error } = await supabase
        .from('jobs')
        .select('*')
        .eq('recruiter_id', currentUserId)
        .order('created_at', { ascending: false });

    if (error) return console.error("Failed to load jobs:", error);

    if (!data.length) {
        jobListEl.innerHTML = '<p>No jobs posted yet.</p>';
        return;
    }

    data.forEach(job => {
        const li = document.createElement('div');
        li.classList.add('job-item');
        li.innerHTML = `
            <div>
                <strong>${job.title}</strong> (${job.job_type})<br>
                <small>${job.location}</small><br>
                <small>Company: ${job.company_name}</small>
            </div>
            <div class="job-actions">
                <button class="editBtn" data-id="${job.id}">Edit</button>
                <button class="deleteBtn" data-id="${job.id}">Delete</button>
            </div>
        `;
        jobListEl.appendChild(li);
    });
}

// ---------------- POST / UPDATE JOB ----------------
jobForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const title = document.getElementById('jobTitle').value.trim();
    const location = document.getElementById('location').value.trim();
    const jobType = document.getElementById('jobType').value;
    const description = document.getElementById('description').value.trim();
    const companyName = document.getElementById('jobCompany').value.trim(); // Fixed id

    if (!title || !location || !jobType || !description || !companyName) {
        alert("Please fill all fields, including company name.");
        return;
    }

    if (editingJobId) {
        // UPDATE existing job
        const { error } = await supabase
            .from('jobs')
            .update({ title, location, job_type: jobType, description, company_name: companyName })
            .eq('id', editingJobId);

        if (error) return alert("Failed to update job: " + error.message);

        editingJobId = null;
        alert("Job updated successfully!");
    } else {
        // INSERT new job
        const { error } = await supabase
            .from('jobs')
            .insert([{ recruiter_id: currentUserId, title, location, job_type: jobType, description, company_name: companyName }]);

        if (error) return alert("Failed to post job: " + error.message);

        alert("Job posted successfully!");
    }

    jobForm.reset();
    await loadJobs();
});

// ---------------- DELETE / EDIT JOB ----------------
jobListEl.addEventListener('click', async (e) => {
    const jobId = e.target.dataset.id;
    if (!jobId) return;

    if (e.target.classList.contains('deleteBtn')) {
        const confirmed = confirm("Are you sure you want to delete this job?");
        if (!confirmed) return;

        const { error } = await supabase
            .from('jobs')
            .delete()
            .eq('id', jobId);

        if (error) return alert("Failed to delete job: " + error.message);

        await loadJobs();
    }

    if (e.target.classList.contains('editBtn')) {
        const { data: job, error } = await supabase
            .from('jobs')
            .select('*')
            .eq('id', jobId)
            .single();

        if (error) return alert("Failed to fetch job: " + error.message);

        // Prefill the form
        document.getElementById('jobTitle').value = job.title;
        document.getElementById('location').value = job.location;
        document.getElementById('jobType').value = job.job_type;
        document.getElementById('description').value = job.description;
        document.getElementById('jobCompany').value = job.company_name; // Prefill company

        editingJobId = jobId;
        window.scrollTo({ top: jobForm.offsetTop, behavior: 'smooth' });
    }
});
const viewApplicationsBtn = document.getElementById('viewApplicationsBtn');

viewApplicationsBtn.addEventListener('click', () => {
    window.location.href = 'recruiter-applications.html';
});


// ---------------- LOGOUT ----------------
logoutBtn.addEventListener('click', async () => {
    await supabase.auth.signOut();
    window.location.href = 'homepage.html';
});
