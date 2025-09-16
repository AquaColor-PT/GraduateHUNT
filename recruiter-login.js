import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js/+esm';

const SUPABASE_URL = 'https://euclknvsppptbfclwxqq.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImV1Y2xrbnZzcHBwdGJmY2x3eHFxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTc2Mjc2NTQsImV4cCI6MjA3MzIwMzY1NH0.HlGW3kZJ4CPnF2JuZGs_4ObkhxwVFTSedb7O8HHDEag';
const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

const emailInput = document.getElementById('email');
const passwordInput = document.getElementById('password');
const loginBtn = document.getElementById('loginBtn');
const messageEl = document.getElementById('message');

loginBtn.addEventListener('click', async () => {
  messageEl.textContent = '';
  messageEl.className = 'message';

  const email = emailInput.value.trim();
  const password = passwordInput.value;

  if (!email || !password) {
    messageEl.textContent = 'Please enter both email and password.';
    messageEl.classList.add('error');
    return;
  }

  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password
  });

  if (error) {
    // Check if the error is due to wrong credentials or non-existent account
    if (error.message.includes('Invalid login credentials')) {
      messageEl.textContent = 'Account does not exist or wrong credentials.';
    } else {
      messageEl.textContent = error.message;
    }
    messageEl.classList.add('error');
    return;
  }

  // Optional: check if recruiter is registered (in recruiters table)
  const { data: recruiter, error: recruiterError } = await supabase
    .from('recruiters')
    .select('verified')
    .eq('id', data.user.id)
    .single();

  if (recruiterError) {
    // If user is not in recruiters table
    messageEl.textContent = 'Account is not registered as a recruiter.';
    messageEl.classList.add('error');
    return;
  }

  if (!recruiter.verified) {
    messageEl.textContent = 'Your account is not yet verified. Please wait for admin approval.';
    messageEl.classList.add('error');
    return;
  }

  // Successful login -> redirect to recruiter dashboard
  window.location.href = 'recruiter-dashboard.html';
});

