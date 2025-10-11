import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js/+esm';

const SUPABASE_URL = 'https://euclknvsppptbfclwxqq.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImV1Y2xrbnZzcHBwdGJmY2x3eHFxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTc2Mjc2NTQsImV4cCI6MjA3MzIwMzY1NH0.HlGW3kZJ4CPnF2JuZGs_4ObkhxwVFTSedb7O8HHDEag';
const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

const publicJobList = document.getElementById('publicJobList');
const jobTypeFilter = document.getElementById('jobTypeFilter');
const jobTitleSearch = document.getElementById('jobTitleSearch');

let allJobs = [];

// Display jobs
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
            <p class="desc">${shortDesc}</p>
            ${isLong ? '<span class="toggleDesc">Show More</span>' : ''}
            <small>Posted on: ${new Date(job.created_at).toLocaleDateString()}</small>
        `;

        const applyBtn = document.createElement('button');
        applyBtn.className = 'blue-btn applyBtn';
        applyBtn.textContent = 'Apply';
        applyBtn.onclick = () => {
            const url = new URL("applicationform.html", window.location.href);
            url.searchParams.set("job_id", job.id);
            url.searchParams.set("job_title", job.title);
            window.location.href = url.toString();
        };

        li.appendChild(applyBtn);
        publicJobList.appendChild(li);

        // Show More / Show Less functionality
        const toggleLink = li.querySelector('.toggleDesc');
        if (toggleLink) {
            const descEl = li.querySelector('.desc');
            toggleLink.addEventListener('click', () => {
                if (descEl.classList.contains('expanded')) {
                    // Collapse
                    descEl.classList.remove('expanded');
                    descEl.textContent = shortDesc;
                    toggleLink.textContent = 'Show More';
                } else {
                    // Expand
                    descEl.classList.add('expanded');
                    descEl.textContent = job.description;
                    toggleLink.textContent = 'Show Less';
                }
            });
        }
    });
}

// Filter/search functionality
function filterJobs() {
    const type = jobTypeFilter.value.toLowerCase();
    const title = jobTitleSearch.value.toLowerCase();

    const filtered = allJobs.filter(job => 
        job.visible && // Only show visible jobs
        (!type || job.job_type.toLowerCase() === type) &&
        (!title || job.title.toLowerCase().includes(title))
    );

    displayJobs(filtered);
}

// Load all jobs
async function loadJobs() {
    publicJobList.innerHTML = '<li class="loading">Loading jobs...</li>';

    const { data: jobs } = await supabase
        .from('jobs')
        .select('*')
        .eq('visible', true) // Only fetch visible jobs
        .order('created_at', { ascending: false });

    allJobs = jobs || [];
    displayJobs(allJobs);
}

jobTypeFilter.addEventListener('change', filterJobs);
jobTitleSearch.addEventListener('input', filterJobs);
document.getElementById('searchBtn').addEventListener('click', filterJobs);

// Initial load
loadJobs();
