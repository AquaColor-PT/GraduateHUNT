import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js/+esm';

const SUPABASE_URL = 'https://euclknvsppptbfclwxqq.supabase.co';
const SUPABASE_KEY = 'sb_publishable_90JbyFsa4BuuyeuLCIActg_yXfbHQ30';
const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

const applicationsContainer = document.getElementById('applicationsContainer');
const goBackBtn = document.getElementById('goBackBtn');
const logoutBtn = document.getElementById('logoutBtn');

goBackBtn.addEventListener('click', () => { window.location.href = 'homepageRegisteredUser.html'; });

logoutBtn.addEventListener('click', async () => {
  await supabase.auth.signOut();
  window.location.href = 'homepage.html';
});

// Prevents job titles or company names from being read as HTML
function esc(value) {
  const div = document.createElement('div');
  div.textContent = value ?? '';
  return div.innerHTML;
}

function setStats(total, pending, accepted, rejected) {
  document.getElementById('statTotal').textContent = total;
  document.getElementById('statPending').textContent = pending;
  document.getElementById('statAccepted').textContent = accepted;
  document.getElementById('statRejected').textContent = rejected;
}

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
      setStats(0, 0, 0, 0);
      applicationsContainer.innerHTML = `
        <div class="no-apps">
          You have not applied to any jobs yet.<br>
          <a href="browse-jobs.html">Browse jobs</a>
        </div>`;
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
    (jobs || []).forEach(j => { jobMap[j.id] = j; });

    // Build table + count statuses
    let pending = 0, accepted = 0, rejected = 0;

    let rows = '';
    applications.forEach(app => {
      const job = jobMap[app.job_id] || {};

      const cleanStatus = (app.status || '').trim().toLowerCase();
      let statusClass = 'pending'; // default fallback
      if (cleanStatus === 'accepted') { statusClass = 'accepted'; accepted++; }
      else if (cleanStatus === 'rejected') { statusClass = 'rejected'; rejected++; }
      else { pending++; }

      const cvLink = app.cv_url
        ? `<a href="${supabase.storage.from('cv_bucket').getPublicUrl(app.cv_url).data.publicUrl}" target="_blank" rel="noopener" class="cv-link">View CV</a>`
        : 'N/A';

      rows += `<tr>
        <td class="title">${esc(job.title) || 'Unknown'}</td>
        <td>${esc(job.company_name) || 'Unknown'}</td>
        <td>${new Date(app.created_at).toLocaleDateString()}</td>
        <td><span class="status ${statusClass}">${esc(app.status || 'pending')}</span></td>
        <td>${cvLink}</td>
      </tr>`;
    });

    setStats(applications.length, pending, accepted, rejected);

    applicationsContainer.innerHTML = `
      <div class="table-card">
        <table>
          <thead>
            <tr>
              <th>Job Title</th>
              <th>Company</th>
              <th>Date Applied</th>
              <th>Status</th>
              <th>CV</th>
            </tr>
          </thead>
          <tbody>${rows}</tbody>
        </table>
      </div>`;

  } catch (err) {
    console.error("Error loading applications:", err);
    applicationsContainer.innerHTML = `<div class="no-apps">Error loading applications. Check console for details.</div>`;
  }
}

loadApplications();
