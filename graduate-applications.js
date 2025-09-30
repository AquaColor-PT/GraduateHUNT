import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js/+esm';

const SUPABASE_URL = 'https://euclknvsppptbfclwxqq.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImV1Y2xrbnZzcHBwdGJmY2x3eHFxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTc2Mjc2NTQsImV4cCI6MjA3MzIwMzY1NH0.HlGW3kZJ4CPnF2JuZGs_4ObkhxwVFTSedb7O8HHDEag';
const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

const applicationsContainer = document.getElementById('applicationsContainer');
const goBackBtn = document.getElementById('goBackBtn');

goBackBtn.addEventListener('click', () => history.back());

async function loadApplications() {
    applicationsContainer.innerHTML = '<p class="loading">Loading applications...</p>';

    try {
        // Get logged-in graduate
        const { data: { session } } = await supabase.auth.getSession();
        if (!session?.user) {
            window.location.href = 'homepage.html';
            return;
        }
        const graduateId = session.user.id;

        // Get applications
        const { data: applications, error: appsError } = await supabase
            .from('applications')
            .select('*')
            .eq('student_id', graduateId)
            .order('created_at', { ascending: false });

        if (appsError) throw appsError;
        if (!applications || applications.length === 0) {
            applicationsContainer.innerHTML = `<div class="no-apps">You have not applied to any jobs yet.</div>`;
            return;
        }

        // Get jobs
        const jobIds = [...new Set(applications.map(a => a.job_id))];
        const { data: jobs, error: jobsError } = await supabase
            .from('jobs')
            .select('id, title, company_name')
            .in('id', jobIds);

        if (jobsError) throw jobsError;

        const jobMap = {};
        jobs.forEach(j => jobMap[j.id] = j);

        // Build table
        let html = `<table>
            <thead>
                <tr>
                    <th>Job Title</th>
                    <th>Company</th>
                    <th>Date Applied</th>
                    <th>Status</th>
                    <th>CV</th>
                </tr>
            </thead>
            <tbody>`;

  applications.forEach(app => {
    const job = jobMap[app.job_id] || {};

    // Clean and normalize status
    const cleanStatus = (app.status || '').trim().toLowerCase();
    let statusClass = '';
    if (cleanStatus === 'pending') statusClass = 'pending';
    else if (cleanStatus === 'accepted') statusClass = 'accepted';
    else if (cleanStatus === 'rejected') statusClass = 'rejected';
    else statusClass = 'pending'; // default fallback

    const cvLink = app.cv_url 
        ? `<a href="${supabase.storage.from('cv_bucket').getPublicUrl(app.cv_url).data.publicUrl}" target="_blank" class="cv-link">View CV</a>` 
        : 'N/A';

    html += `<tr>
        <td>${job.title || 'Unknown'}</td>
        <td>${job.company_name || 'Unknown'}</td>
        <td>${new Date(app.created_at).toLocaleDateString()}</td>
        <td><span class="status ${statusClass}">${app.status}</span></td>
        <td>${cvLink}</td>
    </tr>`;
});


        html += `</tbody></table>`;
        applicationsContainer.innerHTML = html;

    } catch (err) {
        console.error("Error loading applications:", err);
        applicationsContainer.innerHTML = `<div class="no-apps">Error loading applications. Check console for details.</div>`;
    }
}

loadApplications();
