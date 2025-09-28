import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js/+esm';

const SUPABASE_URL = 'https://euclknvsppptbfclwxqq.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImV1Y2xrbnZzcHBwdGJmY2x3eHFxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTc2Mjc2NTQsImV4cCI6MjA3MzIwMzY1NH0.HlGW3kZJ4CPnF2JuZGs_4ObkhxwVFTSedb7O8HHDEag';
const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

// Elements
const emailInput = document.getElementById('email');
const passwordInput = document.getElementById('password');
const loginBtn = document.getElementById('loginBtn');
const message = document.getElementById('message');
const togglePassword = document.getElementById('togglePassword');

// Toggle password visibility
togglePassword.addEventListener('click', () => {
  if(passwordInput.type === 'password'){
    passwordInput.type = 'text';
    togglePassword.textContent = 'Hide';
  } else {
    passwordInput.type = 'password';
    togglePassword.textContent = 'Show';
  }
});

// Login logic
loginBtn.addEventListener('click', async () => {
  const email = emailInput.value.trim();
  const password = passwordInput.value;

  if(!email || !password){
    message.style.color = 'red';
    message.textContent = "Enter email and password";
    return;
  }

  try {
    const { data: authData, error: authError } = await supabase.auth.signInWithPassword({ email, password });
    if(authError) throw authError;

    // Optional: check if graduate exists in your table
    const { data: recruiter, error: recruiterError } = await supabase
      .from('graduates')
      .select('id')
      .eq('email', email)
      .single();

    if(recruiterError || !recruiter){
      await supabase.auth.signOut();
      message.style.color = 'red';
      message.textContent = "This account is not registered as a graduate.";
      return;
    }

    

    message.style.color = 'green';
    message.textContent = "Login successful! Redirecting...";
    setTimeout(() => window.location.href = 'homepageRegisteredUser.html', 1200);

  } catch(err) {
    console.error(err);
    message.style.color = 'red';
    message.textContent = err.message;
  }
});
