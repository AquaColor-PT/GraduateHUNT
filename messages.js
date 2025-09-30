import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js/+esm';

const SUPABASE_URL = 'https://euclknvsppptbfclwxqq.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImV1Y2xrbnZzcHBwdGJmY2x3eHFxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTc2Mjc2NTQsImV4cCI6MjA3MzIwMzY1NH0.HlGW3kZJ4CPnF2JuZGs_4ObkhxwVFTSedb7O8HHDEag';
const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

const studentsContainer = document.getElementById('studentsContainer');
const logoutBtn = document.getElementById('logoutBtn');

async function checkUser() {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session?.user) {
    window.location.href = "recruiter-login.html";
    return;
  }
  const recruiterId = session.user.id;
  loadAcceptedStudents(recruiterId);
}

async function loadAcceptedStudents(recruiterId) {
  studentsContainer.innerHTML = '<p style="text-align:center;color:#666;">Loading accepted students...</p>';

  try {
    const { data: applications, error: appsError } = await supabase
      .from('applications')
      .select('id, student_id, job_id, status')
      .eq('recruiter_id', recruiterId)
      .eq('status', 'Accepted');
    if (appsError) throw appsError;
    if (!applications || applications.length === 0) {
      studentsContainer.innerHTML = '<p style="text-align:center;color:#666;">No accepted students yet.</p>';
      return;
    }

    const jobIds = [...new Set(applications.map(a => a.job_id))];
    const studentIds = [...new Set(applications.map(a => a.student_id))];

    const { data: students } = await supabase
      .from('graduates')
      .select('id, full_name')
      .in('id', studentIds);

    const studentMap = {};
    students.forEach(s => studentMap[s.id] = s);

    const { data: jobs } = await supabase
      .from('jobs')
      .select('id, title')
      .in('id', jobIds);

    const jobMap = {};
    jobs.forEach(j => jobMap[j.id] = j.title);

    const { data: messagesData } = await supabase
      .from('messages')
      .select('student_id, job_id')
      .in('student_id', studentIds);

    const messageMap = {};
    messagesData?.forEach(m => {
      const key = `${m.student_id}_${m.job_id}`;
      messageMap[key] = (messageMap[key] || 0) + 1;
    });

    const grouped = {};
    applications.forEach(app => {
      const jobTitle = jobMap[app.job_id] || 'Unknown Job';
      if (!grouped[jobTitle]) grouped[jobTitle] = [];
      grouped[jobTitle].push(app);
    });

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
          window.location.href = `recruiter-message.html?studentId=${app.student_id}&jobId=${app.job_id}`;
        });

        card.appendChild(info);
        card.appendChild(replyBtn);
        jobSection.appendChild(card);
      });

      studentsContainer.appendChild(jobSection);
    });

  } catch (err) {
    studentsContainer.innerHTML = `<p style="text-align:center;color:red;">Error loading students: ${err.message}</p>`;
    console.error(err);
  }
}

logoutBtn.addEventListener('click', async () => {
  await supabase.auth.signOut();
  window.location.href = 'homepage.html';
});

document.addEventListener('DOMContentLoaded', checkUser);
