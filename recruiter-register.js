// recruiter-register.js
import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm';

const SUPABASE_URL = 'https://euclknvsppptbfclwxqq.supabase.co';
const SUPABASE_KEY = 'sb_publishable_90JbyFsa4BuuyeuLCIActg_yXfbHQ30';
const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

const $ = (id) => document.getElementById(id);
const form = $('registerForm');
const firstNameInput = $('firstName');
const lastNameInput = $('lastName');
const emailInput = $('email');
const contactInput = $('contact');
const passwordInput = $('password');
const confirmInput = $('confirmPassword');
const companyInput = $('company');
const registrationNumberInput = $('registrationNumber');
const consentInput = $('consent');
const registerBtn = $('registerBtn');
const messageEl = $('message');

/* ---------- Helpers ---------- */
function showMessage(text, type) {
  messageEl.textContent = text;
  messageEl.className = 'message' + (type ? ' ' + type : '');
}

function fail(input, text) {
  document.querySelectorAll('input.invalid').forEach(i => i.classList.remove('invalid'));
  if (input) { input.classList.add('invalid'); input.focus(); }
  showMessage(text, 'error');
}

// Accepts 082 123 4567, 0821234567, +27 82 123 4567, +27821234567
function cleanPhone(value) {
  return value.replace(/[\s\-()]/g, '');
}
const PHONE_RE = /^(\+27|0)\d{9}$/;

// CIPC format, e.g. 2015/123456/07
const REG_RE = /^\d{4}\/\d{6}\/\d{2}$/;

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/* ---------- Show / hide password ---------- */
document.querySelectorAll('.toggle-password').forEach(btn => {
  btn.addEventListener('click', () => {
    const input = $(btn.dataset.target);
    const show = input.type === 'password';
    input.type = show ? 'text' : 'password';
    btn.textContent = show ? 'Hide' : 'Show';
    btn.setAttribute('aria-label', show ? 'Hide password' : 'Show password');
  });
});

/* ---------- Go back ---------- */
$('goBackBtn').addEventListener('click', () => {
  if (history.length > 1) history.back();
  else window.location.href = 'homepage.html';
});

/* ---------- Register ---------- */
form.addEventListener('submit', async (e) => {
  e.preventDefault();
  showMessage('', '');
  document.querySelectorAll('input.invalid').forEach(i => i.classList.remove('invalid'));

  const first_name = firstNameInput.value.trim();
  const last_name = lastNameInput.value.trim();
  const email = emailInput.value.trim().toLowerCase();
  const contact = cleanPhone(contactInput.value);
  const password = passwordInput.value;
  const company_name = companyInput.value.trim();
  const registration_number = registrationNumberInput.value.trim();

  if (!first_name) return fail(firstNameInput, 'Please enter your first name.');
  if (!last_name) return fail(lastNameInput, 'Please enter your last name.');
  if (!EMAIL_RE.test(email)) return fail(emailInput, 'Please enter a valid email address.');
  if (!PHONE_RE.test(contact)) return fail(contactInput, 'Enter a valid South African number, e.g. 082 123 4567 or +27 82 123 4567.');
  if (password.length < 8 || !/[A-Za-z]/.test(password) || !/\d/.test(password)) {
    return fail(passwordInput, 'Your password needs at least 8 characters, with a letter and a number.');
  }
  if (password !== confirmInput.value) return fail(confirmInput, 'The passwords do not match.');
  if (!company_name) return fail(companyInput, 'Please enter your company name.');
  if (!REG_RE.test(registration_number)) return fail(registrationNumberInput, 'Enter your registration number in the format 2015/123456/07.');
  if (!consentInput.checked) return fail(null, 'Please tick the box to confirm your details and agree to handle personal information responsibly.');

  registerBtn.disabled = true;
  registerBtn.textContent = 'Registering...';

  try {
    // Sign up with email verification. Works even if the site is hosted in a sub-folder.
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: new URL('verify-recruiter.html', window.location.href).href,
        data: { role: 'recruiter', first_name, last_name, company_name, registration_number, contact }
      }
    });

    if (error) throw error;

    // With email confirmation on, Supabase does not return an error for an email that is
    // already registered. It returns a user with no identities instead.
    if (data.user && Array.isArray(data.user.identities) && data.user.identities.length === 0) {
      return fail(emailInput, 'An account with this email already exists. Try logging in instead.');
    }

    showMessage('Registration successful! Please check your email to verify your account.', 'success');
    form.reset();
  } catch (err) {
    console.error('Sign-up error:', err);
    showMessage('Registration failed: ' + (err.message || 'Please try again.'), 'error');
  } finally {
    registerBtn.disabled = false;
    registerBtn.textContent = 'Register';
  }
});
