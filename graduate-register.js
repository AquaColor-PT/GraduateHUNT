// graduate-register.js
import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js/+esm';

const SUPABASE_URL = 'https://euclknvsppptbfclwxqq.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImV1Y2xrbnZzcHBwdGJmY2x3eHFxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTc2Mjc2NTQsImV4cCI6MjA3MzIwMzY1NH0.HlGW3kZJ4CPnF2JuZGs_4ObkhxwVFTSedb7O8HHDEag';
const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

const fullNameInput = document.getElementById('fullName');
const emailInput = document.getElementById('email');
const phoneInput = document.getElementById('phone');
const qualificationInput = document.getElementById('qualification');
const passwordInput = document.getElementById('password');
const registerBtn = document.getElementById('registerBtn');
const messageEl = document.getElementById('message');

// Optional: toggle password visibility
const togglePassword = document.getElementById('togglePassword');
if (togglePassword) {
  togglePassword.addEventListener('click', () => {
    passwordInput.type = passwordInput.type === 'password' ? 'text' : 'password';
    togglePassword.textContent = passwordInput.type === 'password' ? 'Show' : 'Hide';
  });
}

registerBtn.addEventListener('click', async () => {
  messageEl.textContent = '';
  messageEl.className = 'message';

  const full_name = fullNameInput.value.trim();
  const email = emailInput.value.trim().toLowerCase();
  const phone = phoneInput.value.trim();
  const qualification = qualificationInput.value.trim();
  const password = passwordInput.value;

  if (!full_name || !email || !phone || !qualification || !password) {
    messageEl.textContent = 'Please fill in all fields.';
    messageEl.classList.add('error');
    return;
  }

  try {
    // Check if email already exists in graduates
    const { data: existingGrad } = await supabase
      .from('graduates')
      .select('id')
      .eq('email', email)
      .maybeSingle(); // use maybeSingle() to avoid error if no rows

    if (existingGrad) {
      messageEl.textContent = 'This email is already registered as a graduate.';
      messageEl.classList.add('error');
      return;
    }

    // 1. Sign up user in Supabase Auth
    const { data: authData, error: authError } = await supabase.auth.signUp({
      email,
      password
    });
    if (authError) throw authError;

    const userId = authData.user.id; // Use Auth user ID as graduate ID

    // 2. Insert graduate info into table with id = Auth user ID
    const { data, error } = await supabase.from('graduates').insert([{
      id: userId,
      full_name,
      email,
      phone,
      qualification,
      created_at: new Date().toISOString()
    }]);

    if (error) {
      messageEl.textContent = error.message;
      messageEl.classList.add('error');
      return;
    }

    messageEl.textContent = 'Graduate registration successful! Check your email to confirm.';
    messageEl.classList.add('success');

    // Clear the form
    fullNameInput.value = '';
    emailInput.value = '';
    phoneInput.value = '';
    qualificationInput.value = '';
    passwordInput.value = '';

  } catch (err) {
    console.error('Sign-up error:', err);
    messageEl.textContent = 'Error: ' + err.message;
    messageEl.classList.add('error');
  }
});
