import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js/+esm';

const SUPABASE_URL = 'https://euclknvsppptbfclwxqq.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImV1Y2xrbnZzcHBwdGJmY2x3eHFxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTc2Mjc2NTQsImV4cCI6MjA3MzIwMzY1NH0.HlGW3kZJ4CPnF2JuZGs_4ObkhxwVFTSedb7O8HHDEag';
const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

// DOM elements
const container = document.getElementById("messagesContainer");
const badge = document.getElementById("messageBadge");

// Helper: message status styling
function getStatusInfo(status) {
  switch(status?.toLowerCase()){
    case 'unread': return { color: 'orange', icon: '📨' };
    case 'viewed': return { color: 'blue', icon: '👁️' };
    default: return { color: '#2980b9', icon: '' };
  }
}

// Render messages in UI
function renderMessages(messages) {
  container.innerHTML = "";
  if (!messages || messages.length === 0) {
    container.innerHTML = "<p class='empty'>No messages yet.</p>";
    badge.style.display = "none";
    return;
  }

  const unread = messages.filter(m => m.status?.toLowerCase() === 'unread');
  badge.style.display = unread.length > 0 ? "inline-block" : "none";

  // Keep only latest message per recruiter/job
  const latestByJob = {};
  messages.forEach(msg => {
    const key = `${msg.recruiter_id || 'null'}_${msg.job_id || 'null'}`;
    if (!latestByJob[key] || new Date(msg.created_at) > new Date(latestByJob[key].created_at)) {
      latestByJob[key] = msg;
    }
  });

  Object.values(latestByJob).forEach(msg => {
    const card = document.createElement("div");
    card.className = "message-card";

    const date = new Date(msg.created_at).toLocaleString();
    const { color, icon } = getStatusInfo(msg.status);

    card.innerHTML = `
      <div class="message-header">
        <span>From: ${msg.company_name || 'Recruiter'}</span>
        <span>${date}</span>
      </div>
      <div>
        <strong>Job Applied For:</strong> 
        <a href="job-details.html?jobId=${msg.job_id || ''}" target="_blank">${msg.job_title || 'Unknown Job'}</a>
      </div>
      <div class="content">${msg.message || ''}</div>
      <div class="status" style="color:${color}">${icon} ${msg.status || ''}</div>
      <div class="btn-group">
        <button class="reply-btn">Reply</button>
        <button class="delete-btn">Delete</button>
      </div>
    `;

    container.appendChild(card);

    // Reply button
    card.querySelector('.reply-btn').addEventListener('click', () => {
      const recruiterIdParam = msg.recruiter_id || '';
      const jobIdParam = msg.job_id || '';
      const jobTitleParam = encodeURIComponent(msg.job_title || '');
      const companyParam = encodeURIComponent(msg.company_name || 'Recruiter');

      window.location.href = `graduate-reply.html?recruiterId=${recruiterIdParam}&jobId=${jobIdParam}&jobTitle=${jobTitleParam}&companyName=${companyParam}`;
    });

    // Delete button (safe for null UUIDs)
    card.querySelector('.delete-btn').addEventListener('click', async () => {
      if (!confirm("Are you sure you want to delete this conversation?")) return;

      try {
        const { data: { user }, error: userError } = await supabase.auth.getUser();
        if (userError || !user) throw new Error("You must be logged in.");

        let query = supabase
          .from('messages')
          .update({ student_deleted: true })
          .eq('student_id', user.id)
          .eq('student_deleted', false);

        if (msg.recruiter_id) query = query.eq('recruiter_id', msg.recruiter_id);
        if (msg.job_id) query = query.eq('job_id', msg.job_id);

        const { error } = await query;
        if (error) throw error;

        card.remove();
      } catch (err) {
        console.error(err);
        alert("Failed to delete messages: " + err.message);
      }
    });
  });
}

// Load all messages for student
async function loadMessages() {
  container.innerHTML = "<p class='empty'>Loading messages...</p>";

  try {
    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError || !user || !user.id) {
      container.innerHTML = "<p class='empty'>Please log in to view messages.</p>";
      return;
    }

    const { data: messages, error } = await supabase
      .from("messages")
      .select("id, message, status, created_at, recruiter_id, company_name, job_title, job_id, student_deleted")
      .eq("student_id", user.id)
      .eq("student_deleted", false)
      .order("created_at", { ascending: false });

    if (error) throw error;

    renderMessages(messages);

    // Mark unread messages as viewed
    const unread = messages.filter(m => m.status?.toLowerCase() === 'unread');
    if (unread.length > 0) {
      const ids = unread.map(m => m.id);
      await supabase.from('messages').update({ status: 'viewed' }).in('id', ids);
      badge.style.display = "none";
    }

    // Realtime subscription
    supabase
      .channel('graduate-messages')
      .on('postgres_changes', { 
        event: 'INSERT', 
        schema: 'public', 
        table: 'messages', 
        filter: `student_id=eq.${user.id},student_deleted=eq.false`
      }, payload => {
        messages.unshift(payload.new);
        renderMessages(messages);
        badge.style.display = "inline-block";
        setTimeout(() => alert("You have a new message!"), 500);
      })
      .subscribe();

  } catch (err) {
    console.error("Error loading messages:", err);
    container.innerHTML = "<p class='empty'>Error loading messages.</p>";
  }
}

document.addEventListener('DOMContentLoaded', loadMessages);
