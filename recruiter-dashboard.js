import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js/+esm';

const SUPABASE_URL = 'https://euclknvsppptbfclwxqq.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImV1Y2xrbnZzcHBwdGJmY2x3eHFxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTc2Mjc2NTQsImV4cCI6MjA3MzIwMzY1NH0.HlGW3kZJ4CPnF2JuZGs_4ObkhxwVFTSedb7O8HHDEag';
const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

const profilePicEl = document.getElementById('profilePic');
const profilePicContainer = document.getElementById('profilePicContainer');
const profileNameEl = document.getElementById('profileName');
const profileCompanyEl = document.getElementById('profileCompany');
const profileCreditsEl = document.getElementById('profileCredits');
const jobForm = document.getElementById('jobForm');
const jobListEl = document.getElementById('jobList');
const logoutBtn = document.getElementById('logoutBtn');
const declarationCheckbox = document.getElementById('declaration');

let currentUserId = null;
let editingJobId = null;

// Auth check
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

// Load profile
async function loadProfile() {
    const { data, error } = await supabase
        .from('recruiters')
        .select('*')
        .eq('id', currentUserId)
        .single();
    if (error) return console.error(error);

    profileNameEl.textContent = `${data.first_name} ${data.last_name}`;
    profileCompanyEl.textContent = data.company_name || 'Your Company/Agency';
    profileCreditsEl.textContent = `Credits: ${data.credits || 0}`;

    if (data.profile_url) {
        const { data: urlData } = supabase.storage.from('recruiter-profile-pics').getPublicUrl(data.profile_url);
        if (urlData?.publicUrl) {
            profilePicEl.src = urlData.publicUrl;
            profilePicEl.style.display = 'block';
            profilePicContainer.style.display = 'none';
        }
    }
}

// Load jobs
async function loadJobs() {
    jobListEl.innerHTML = '';
    const { data, error } = await supabase
        .from('jobs')
        .select('*')
        .eq('recruiter_id', currentUserId)
        .order('created_at', { ascending: false });
    if (error) return console.error(error);

    if (!data.length) {
        jobListEl.innerHTML = '<p>No jobs posted yet.</p>';
        return;
    }

    data.forEach(job => {
        const div = document.createElement('div');
        div.classList.add('job-item');
        div.innerHTML = `
            <div>
              <strong>${job.title}</strong> (${job.job_type})<br>
              <small>${job.location}</small><br>
              <small>Company: ${job.company_name}</small><br>
              <p style="white-space: pre-line; color:#555; margin-top:8px;">${job.description}</p>
            </div>
            <div>
              <button class="editBtn" data-id="${job.id}">Edit</button>
              <button class="deleteBtn" data-id="${job.id}">Delete</button>
            </div>
        `;
        jobListEl.appendChild(div);
    });
}

// Post/update job
jobForm.addEventListener('submit', async (e) => {
    e.preventDefault();

    if (!declarationCheckbox.checked) {
        alert("You must agree to the declaration before posting a job.");
        return;
    }

    const title = document.getElementById('jobTitle').value.trim();
    const location = document.getElementById('location').value.trim();
    const jobType = document.getElementById('jobType').value;
    const description = document.getElementById('description').value.trim();
    const companyName = document.getElementById('jobCompany').value.trim();

    if (!title || !location || !jobType || !description || !companyName) {
        alert("Please fill all fields.");
        return;
    }

    if (editingJobId) {
        const { error } = await supabase.from('jobs').update({ title, location, job_type: jobType, description, company_name: companyName }).eq('id', editingJobId);
        if (error) return alert(error.message);
        editingJobId = null;
        alert("Job updated successfully!");
    } else {
        const { error } = await supabase.from('jobs').insert([{ recruiter_id: currentUserId, title, location, job_type: jobType, description, company_name: companyName }]);
        if (error) return alert(error.message);
        alert("Job posted successfully!");
    }

    jobForm.reset();
    await loadJobs();
});

// Edit/Delete jobs
jobListEl.addEventListener('click', async (e) => {
    const jobId = e.target.dataset.id;
    if (!jobId) return;

    if (e.target.classList.contains('deleteBtn')) {
        if (!confirm("Are you sure?")) return;
        const { error } = await supabase.from('jobs').delete().eq('id', jobId);
        if (error) return alert(error.message);
        await loadJobs();
    }

    if (e.target.classList.contains('editBtn')) {
        const { data: job, error } = await supabase.from('jobs').select('*').eq('id', jobId).single();
        if (error) return alert(error.message);

        document.getElementById('jobTitle').value = job.title;
        document.getElementById('location').value = job.location;
        document.getElementById('jobType').value = job.job_type;
        document.getElementById('description').value = job.description;
        document.getElementById('jobCompany').value = job.company_name;

        editingJobId = jobId;
        window.scrollTo({ top: jobForm.offsetTop, behavior: 'smooth' });
    }
});

// Logout
logoutBtn.addEventListener('click', async () => {
    await supabase.auth.signOut();
    window.location.href = 'homepage.html';
});
