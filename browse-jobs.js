import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js/+esm';

const SUPABASE_URL = 'https://euclknvsppptbfclwxqq.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImV1Y2xrbnZzcHBwdGJmY2x3eHFxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTc2Mjc2NTQsImV4cCI6MjA3MzIwMzY1NH0.HlGW3kZJ4CPnF2JuZGs_4ObkhxwVFTSedb7O8HHDEag';
const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

const publicJobList = document.getElementById('publicJobList');
const jobTypeFilter = document.getElementById('jobTypeFilter');
const jobTitleSearch = document.getElementById('jobTitleSearch');

let allJobs = [];
let graduateQualifications = [];

// Load jobs + graduate info
async function loadJobs() {
    publicJobList.innerHTML = '<li class="loading">Loading jobs...</li>';

    // Get logged-in user session
    const { data: { session } } = await supabase.auth.getSession();
    if (!session?.user) {
        publicJobList.innerHTML = '<li>Please log in to view jobs.</li>';
        return;
    }
    const studentId = session.user.id;

    // Fetch graduate profile
    const { data: graduate, error: gradError } = await supabase
        .from('graduates')
        .select('qualification')
        .eq('id', studentId)
        .single();

    if (gradError || !graduate) {
        publicJobList.innerHTML = `<li class="error">Error fetching graduate profile: ${gradError?.message || 'Not found'}</li>`;
        return;
    }

    const gradQualification = graduate.qualification;

    // Helper: check if job qualification contains any keywords from graduate qualification
    function qualificationMatches(gradQualification, jobQualification) {
        if (!gradQualification || !jobQualification) return false;

        const gradKeywords = gradQualification
            .toLowerCase()
            .split(/\s+/)
            .map(k => k.trim())
            .filter(k => k.length > 1);

        const jobQualLower = jobQualification.toLowerCase();

        return gradKeywords.some(keyword => jobQualLower.includes(keyword));
    }

    // Fetch all visible jobs
    const { data: jobs, error: jobsError } = await supabase
        .from('jobs')
        .select('*')
        .eq('visible', true)  // <-- Only fetch visible jobs
        .order('created_at', { ascending: false });

    if (jobsError) { 
        publicJobList.innerHTML = `<li class="error">Error fetching jobs: ${jobsError.message}</li>`; 
        return; 
    }

    // Fetch jobs the graduate already applied to
    const { data: applications } = await supabase
        .from('applications')
        .select('job_id')
        .eq('student_id', studentId);

    const appliedJobIds = applications ? applications.map(a => a.job_id) : [];

    // Filter jobs using keyword-based qualification matching
    allJobs = jobs
        .filter(job => qualificationMatches(gradQualification, job.required_qualifications))
        .map(job => ({ ...job, applied: appliedJobIds.includes(job.id) }));

    displayJobs(allJobs);
}

// Display jobs with Show More / Show Less
function displayJobs(jobs) {
    publicJobList.innerHTML = '';
    if (!jobs || jobs.length === 0) {
        publicJobList.innerHTML = '<li>No jobs available</li>';
        return;
    }

    jobs.forEach(job => {
        const li = document.createElement('li');
        const maxLength = 150;
        const isLong = job.description.length > maxLength;
        const shortDesc = isLong ? job.description.slice(0, maxLength) + '...' : job.description;

        li.innerHTML = `
            <h4>${job.title}</h4>
            <div><strong>Company:</strong> ${job.company_name}</div>
            <div><strong>Location:</strong> ${job.location}</div>
            <div><strong>Position Type:</strong> ${job.job_type}</div>
            <div><strong>Qualifications Required:</strong> ${job.required_qualifications || 'None'}</div>
            <div><strong>Job Description:</strong></div>
            <p class="desc" style="white-space: pre-line; margin:8px 0 12px 0; line-height:1.4;">${shortDesc}</p>
            ${isLong ? '<span class="viewMore" style="color:#1e3a8a; cursor:pointer; font-size:13px;">Show More</span>' : ''}
            <small>Posted on: ${new Date(job.created_at).toLocaleDateString()}</small>
        `;

        const applyBtn = document.createElement('button');
        applyBtn.className = 'blue-btn applyBtn';
        if(job.applied){
            applyBtn.textContent = 'Already Applied';
            applyBtn.disabled = true;
            applyBtn.style.backgroundColor = '#ccc';
            applyBtn.style.cursor = 'not-allowed';
        } else {
            applyBtn.textContent = 'Apply';
            applyBtn.onclick = () => {
                const url = new URL("applicationform.html", window.location.href);
                url.searchParams.set("job_id", job.id);
                url.searchParams.set("job_title", job.title);
                window.location.href = url.toString();
            };
        }

        li.appendChild(applyBtn);
        publicJobList.appendChild(li);

        // Show More / Show Less toggle
        const viewMoreLink = li.querySelector('.viewMore');
        if(viewMoreLink){
            const descEl = li.querySelector('.desc');
            viewMoreLink.addEventListener('click', ()=>{
                if(viewMoreLink.textContent === 'Show More'){
                    descEl.textContent = job.description;
                    viewMoreLink.textContent = 'Show Less';
                } else {
                    descEl.textContent = shortDesc;
                    viewMoreLink.textContent = 'Show More';
                }
            });
        }
    });
}

// Filter/search functionality
function filterJobs() {
    const type = jobTypeFilter.value.toLowerCase();
    const title = jobTitleSearch.value.toLowerCase();

    const filtered = allJobs.filter(job => {
        const matchType = !type || job.job_type.toLowerCase() === type;
        const matchTitle = !title || job.title.toLowerCase().includes(title);
        return matchType && matchTitle;
    });

    displayJobs(filtered);
}

jobTypeFilter.addEventListener('change', filterJobs);
jobTitleSearch.addEventListener('input', filterJobs);
document.getElementById('searchBtn').addEventListener('click', filterJobs);

// Initial load
loadJobs();
