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
    // Check if email already exists in graduates table
    const { data: existingUser, error: userError } = await supabase
      .from('graduates')
      .select('id')
      .eq('email', email)
      .maybeSingle();

    if (existingUser) {
      messageEl.textContent = 'This email is already registered.';
      messageEl.classList.add('error');
      return;
    }

    // Sign up with Supabase Auth (email verification required)
    const { data: authData, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: window.location.origin + "/verify.html",
        data: { full_name, phone, qualification }
      }
    });

    if (error) throw error;

    // ✅ Do not insert into graduates table yet.
    // Wait until user verifies their email, then handle insert on verify.html page.

    messageEl.textContent = 'Registration successful! Please check your email to verify your account before logging in.';
    messageEl.classList.add('success');

    // Clear form
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
