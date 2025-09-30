// recruiter-register.js
import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js/+esm';

const SUPABASE_URL = 'https://euclknvsppptbfclwxqq.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImV1Y2xrbnZzcHBwdGJmY2x3eHFxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTc2Mjc2NTQsImV4cCI6MjA3MzIwMzY1NH0.HlGW3kZJ4CPnF2JuZGs_4ObkhxwVFTSedb7O8HHDEag';
const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

const firstNameInput = document.getElementById('firstName');
const lastNameInput = document.getElementById('lastName');
const emailInput = document.getElementById('email');
const passwordInput = document.getElementById('password');
const companyInput = document.getElementById('company');
const registrationNumberInput = document.getElementById('registrationNumber');
const contactInput = document.getElementById('contact');
const registerBtn = document.getElementById('registerBtn');
const messageEl = document.getElementById('message');

registerBtn.addEventListener('click', async () => {
  messageEl.textContent = '';
  messageEl.className = 'message';

  const first_name = firstNameInput.value.trim();
  const last_name = lastNameInput.value.trim();
  const email = emailInput.value.trim();
  const password = passwordInput.value;
  const company_name = companyInput.value.trim();
  const registration_number = registrationNumberInput.value.trim();
  const contact = contactInput.value.trim();

  if (!first_name || !last_name || !email || !password || !company_name || !registration_number || !contact) {
    messageEl.textContent = 'Please fill in all fields.';
    messageEl.classList.add('error');
    return;
  }

  try {
    // 1. Sign up user in Supabase Auth with email verification
    const { data: authData, error: authError } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: window.location.origin + "/verify-recruiter.html",
        data: { first_name, last_name, company_name, registration_number, contact }
      }
    });

    if (authError) throw authError;

    messageEl.textContent = 'Registration successful! Please check your email to verify your account.';
    messageEl.classList.add('success');

    // Clear the form
    firstNameInput.value = '';
    lastNameInput.value = '';
    emailInput.value = '';
    passwordInput.value = '';
    companyInput.value = '';
    registrationNumberInput.value = '';
    contactInput.value = '';

  } catch (err) {
    console.error('Sign-up error:', err);
    messageEl.textContent = 'Error: ' + err.message;
    messageEl.classList.add('error');
  }
});
