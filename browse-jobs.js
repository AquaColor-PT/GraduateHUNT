import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js/+esm';

const SUPABASE_URL = 'https://euclknvsppptbfclwxqq.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImV1Y2xrbnZzcHBwdGJmY2x3eHFxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTc2Mjc2NTQsImV4cCI6MjA3MzIwMzY1NH0.HlGW3kZJ4CPnF2JuZGs_4ObkhxwVFTSedb7O8HHDEag';
const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

const publicJobList = document.getElementById('publicJobList');
const jobTypeFilter = document.getElementById('jobTypeFilter');
const jobTitleSearch = document.getElementById('jobTitleSearch');

let allJobs = [];

async function loadJobs() {
    publicJobList.innerHTML = '<li class="loading">Loading jobs...</li>';

    const { data: { session } } = await supabase.auth.getSession();
    if (!session?.user) {
        publicJobList.innerHTML = '<li>Please log in to view jobs.</li>';
        return;
    }
    const studentId = session.user.id;

    const { data: jobs, error: jobsError } = await supabase
        .from('jobs')
        .select('*')
        .order('created_at', { ascending: false });

    if (jobsError) { 
        publicJobList.innerHTML = `<li class="error">Error: ${jobsError.message}</li>`; 
        return; 
    }

    const { data: applications } = await supabase
        .from('applications')
        .select('job_id')
        .eq('student_id', studentId);

    const appliedJobIds = applications ? applications.map(a => a.job_id) : [];
    allJobs = jobs.map(job => ({ ...job, applied: appliedJobIds.includes(job.id) }));

    displayJobs(allJobs);
}

function displayJobs(jobs) {
    publicJobList.innerHTML = '';
    if (!jobs || jobs.length === 0) {
        publicJobList.innerHTML = '<li>No jobs available</li>';
        return;
    }

    jobs.forEach(job => {
        const li = document.createElement('li');

        let shortDesc = job.description.length > 150 ? job.description.slice(0,150) + '...' : job.description;

        li.innerHTML = `
            <h4>${job.title}</h4>
            <div><strong>Company:</strong> ${job.company_name}</div>
            <div><strong>Location:</strong> ${job.location}</div>
            <div><strong>Position Type:</strong> ${job.job_type}</div>
            <div><strong>Job Description:</strong></div>
            <p style="white-space: pre-line; margin:8px 0 12px 0; line-height:1.4;" class="desc">${shortDesc}</p>
            ${job.description.length > 150 ? '<span class="viewMore">View More</span>' : ''}
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

        // View More toggle
        const viewMoreLink = li.querySelector('.viewMore');
        if(viewMoreLink){
            viewMoreLink.addEventListener('click', e=>{
                const descEl = li.querySelector('.desc');
                descEl.textContent = job.description;
                viewMoreLink.style.display = 'none';
            });
        }
    });
}

// Live filter/search
function filterJobs() {
    const type = jobTypeFilter.value.toLowerCase();
    const title = jobTitleSearch.value.toLowerCase();
    const filtered = allJobs.filter(job=>{
        const matchType = !type || job.job_type.toLowerCase() === type;
        const matchTitle = !title || job.title.toLowerCase().includes(title);
        return matchType && matchTitle;
    });
    displayJobs(filtered);
}

// Trigger filtering as user types or changes type
jobTypeFilter.addEventListener('change', filterJobs);
jobTitleSearch.addEventListener('input', filterJobs);

// Load jobs initially
loadJobs();
