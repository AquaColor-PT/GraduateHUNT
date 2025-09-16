import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js/+esm';

const SUPABASE_URL = 'https://euclknvsppptbfclwxqq.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImV1Y2xrbnZzcHBwdGJmY2x3eHFxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTc2Mjc2NTQsImV4cCI6MjA3MzIwMzY1NH0.HlGW3kZJ4CPnF2JuZGs_4ObkhxwVFTSedb7O8HHDEag';
const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

const publicJobList = document.getElementById('publicJobList');

// Load jobs
async function loadJobs() {
    publicJobList.innerHTML = '<li class="loading">Loading jobs...</li>';

    const { data, error } = await supabase
        .from('jobs')
        .select('*')
        .order('created_at', { ascending: false });

    if(error) { 
        publicJobList.innerHTML = `<li class="error">Error: ${error.message}</li>`; 
        return; 
    }
    if(!data || data.length === 0) { 
        publicJobList.innerHTML = '<li>No jobs available</li>'; 
        return; 
    }

    publicJobList.innerHTML = '';
    data.forEach(job => {
        const li = document.createElement('li');
        li.innerHTML = `
            <h4>${job.title}</h4>
            <div><strong>Company:</strong> ${job.company_name}</div>
            <div><strong>Location:</strong> ${job.location}</div>
            <div><strong>Position Type:</strong> ${job.job_type}</div>
            <div><strong>Job Description:</strong></div>
            <p>${job.description}</p>
            <small>Posted on: ${new Date(job.created_at).toLocaleDateString()}</small>
        `;

        const applyBtn = document.createElement('button');
        applyBtn.textContent = 'Apply';
        applyBtn.className = 'applyBtn';

        // Redirect to applicationform.html with jobId and jobTitle as query parameters
       // Instead of opening modal
applyBtn.onclick = () => {
    // Redirect to application form page with job_id and title in URL
    const url = new URL("applicationform.html", window.location.origin);
    url.searchParams.set("job_id", job.id);
    url.searchParams.set("job_title", job.title);
    window.location.href = url.toString();
};

        li.appendChild(applyBtn);
        publicJobList.appendChild(li);
    });
}

// Load jobs on page load
loadJobs();
