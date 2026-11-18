import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js/+esm';

const SUPABASE_URL = 'https://euclknvsppptbfclwxqq.supabase.co';
const SUPABASE_KEY = 'sb_publishable_90JbyFsa4BuuyeuLCIActg_yXfbHQ30';
const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

const studentsContainer = document.getElementById('studentsContainer');
const logoutBtn = document.getElementById('logoutBtn');

function showMessage(text, color = '#666') {
  studentsContainer.innerHTML = '';
  const p = document.createElement('p');
  p.style.cssText = `text-align:center;color:${color};`;
  p.textContent = text;
  studentsContainer.appendChild(p);
}

async function checkUser() {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session?.user) {
    window.location.href = 'recruiter-login.html';
    return;
  }
  await loadAcceptedStudents(session.user.id);
}

async function loadAcceptedStudents(recruiterId) {
  showMessage('Loading accepted students...');

  try {
    // 1. Accepted applications for this recruiter
    const { data: applications, error: appsError } = await supabase
      .from('applications')
      .select('id, student_id, job_id, status')
      .eq('recruiter_id', recruiterId)
      .eq('status', 'Accepted');
    if (appsError) throw appsError;

    if (!applications || applications.length === 0) {
      showMessage('No accepted students yet.');
      return;
    }

    const jobIds = [...new Set(applications.map(a => a.job_id))];
    const studentIds = [...new Set(applications.map(a => a.student_id))];

    // 2. Students
    const { data: students, error: studentsError } = await supabase
      .from('graduates')
      .select('id, full_name')
      .in('id', studentIds);
    if (studentsError) throw studentsError;

    const studentMap = {};
    (students || []).forEach(s => { studentMap[s.id] = s; });

    // 3. Jobs
    const { data: jobs, error: jobsError } = await supabase
      .from('jobs')
      .select('id, title')
      .in('id', jobIds);
    if (jobsError) throw jobsError;

    const jobMap = {};
    (jobs || []).forEach(j => { jobMap[j.id] = j.title; });

    // 4. Messages (only for these students and jobs)
    const { data: messagesData, error: msgError } = await supabase
      .from('messages')
      .select('student_id, job_id')
      .in('student_id', studentIds)
      .in('job_id', jobIds);
    if (msgError) throw msgError;

    const messageMap = {};
    (messagesData || []).forEach(m => {
      const key = `${m.student_id}_${m.job_id}`;
      messageMap[key] = (messageMap[key] || 0) + 1;
    });

    // 5. Group applications by job title
    const grouped = {};
    applications.forEach(app => {
      const jobTitle = jobMap[app.job_id] || 'Unknown Job';
      if (!grouped[jobTitle]) grouped[jobTitle] = [];
      grouped[jobTitle].push(app);
    });

    // 6. Render
    studentsContainer.innerHTML = '';
    Object.keys(grouped).forEach(jobTitle => {
      const jobSection = document.createElement('div');
      jobSection.style.marginBottom = '20px';

      const jobHeader = document.createElement('h2');
      jobHeader.textContent = jobTitle;
      jobHeader.style.color = '#1e3a8a';
      jobHeader.style.marginBottom = '10px';
      jobSection.appendChild(jobHeader);

      grouped[jobTitle].forEach(app => {
        const student = studentMap[app.student_id] || {};

        const card = document.createElement('div');
        card.classList.add('student-card');

        const info = document.createElement('div');
        info.classList.add('student-info');

        const nameEl = document.createElement('div');
        nameEl.classList.add('student-name');
        nameEl.textContent = student.full_name || 'Unknown';

        const statusEl = document.createElement('div');
        statusEl.classList.add('message-indicator');
        statusEl.textContent = `Status: ${app.status}`;

        const key = `${app.student_id}_${app.job_id}`;
        const messageEl = document.createElement('div');
        messageEl.classList.add('message-indicator');
        messageEl.textContent = messageMap[key] ? 'Has messages' : 'No messages';

        info.appendChild(nameEl);
        info.appendChild(statusEl);
        info.appendChild(messageEl);

        const replyBtn = document.createElement('button');
        replyBtn.classList.add('reply-btn');
        replyBtn.textContent = 'Reply';
        replyBtn.addEventListener('click', () => {
          window.location.href =
            `recruiter-message.html?studentId=${encodeURIComponent(app.student_id)}&jobId=${encodeURIComponent(app.job_id)}`;
        });

        card.appendChild(info);
        card.appendChild(replyBtn);
        jobSection.appendChild(card);
      });

      studentsContainer.appendChild(jobSection);
    });
  } catch (err) {
    console.error(err);
    showMessage(`Error loading students: ${err.message}`, 'red');
  }
}

logoutBtn?.addEventListener('click', async (e) => {
  e.preventDefault(); // wait for signOut before navigating
  await supabase.auth.signOut();
  window.location.href = 'homepage.html';
});

// Module scripts are deferred, so the DOM is already ready here
checkUser();
