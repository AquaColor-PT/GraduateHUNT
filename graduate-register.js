// graduate-register.js
import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js/+esm';

const SUPABASE_URL = 'https://euclknvsppptbfclwxqq.supabase.co';
const SUPABASE_KEY = 'sb_publishable_90JbyFsa4BuuyeuLCIActg_yXfbHQ30';
const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

const form = document.getElementById('registerForm');
const fullNameInput = document.getElementById('fullName');
const emailInput = document.getElementById('email');
const phoneInput = document.getElementById('phone');
const qualificationInput = document.getElementById('qualification');
const passwordInput = document.getElementById('password');
const registerBtn = document.getElementById('registerBtn');
const messageEl = document.getElementById('message');

// type is 'error', 'success' or '' (clears the message)
function showMessage(text, type) {
  messageEl.textContent = text;
  messageEl.className = type;
}

// FIX: listens for the form being submitted, so the Enter key works too
form.addEventListener('submit', async (event) => {
  event.preventDefault();
  showMessage('', '');

  const full_name = fullNameInput.value.trim();
  const email = emailInput.value.trim().toLowerCase();
  const phone = phoneInput.value.trim();
  const qualification = qualificationInput.value.trim();
  const password = passwordInput.value;

  if (!full_name || !email || !phone || !qualification || !password) {
    showMessage('Please fill in all fields.', 'error');
    return;
  }

  // Phone number: allow spaces, + and dashes, but it needs 9 to 15 digits
  const phoneDigits = phone.replace(/\D/g, '');
  if (phoneDigits.length < 9 || phoneDigits.length > 15) {
    showMessage('Please enter a valid phone number.', 'error');
    return;
  }

  if (password.length < 8) {
    showMessage('Your password must be at least 8 characters.', 'error');
    return;
  }

  // FIX: stops double-clicks from sending two sign-ups
  registerBtn.disabled = true;
  registerBtn.textContent = 'Registering...';

  try {
    // Builds the link from the page's current address, so it works on any domain
    const verifyUrl = new URL('verify.html', window.location.href).href;

    // FIX: the old code looked the email up in the "graduates" table first.
    // That only works if anyone on the internet is allowed to read that table,
    // which also exposes graduates' details. Supabase Auth already checks for
    // duplicates, so we use its answer instead.
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: verifyUrl,
        data: { full_name, phone, qualification }
      }
    });

    if (error) throw error;

    // When an email is already registered, Supabase returns a user with no identities
    if (data.user && Array.isArray(data.user.identities) && data.user.identities.length === 0) {
      showMessage('This email is already registered. Please log in instead.', 'error');
      return;
    }

    // Do not insert into graduates table yet.
    // Wait until user verifies their email, then handle insert on verify.html page.

    showMessage('Registration successful! Please check your email to verify your account before logging in.', 'success');
    form.reset();

  } catch (err) {
    console.error('Sign-up error:', err);
    showMessage('Error: ' + err.message, 'error');
  } finally {
    registerBtn.disabled = false;
    registerBtn.textContent = 'Register';
  }
});
