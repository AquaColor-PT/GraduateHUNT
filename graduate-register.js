// graduate-register.js
import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js/+esm';

const SUPABASE_URL = 'https://euclknvsppptbfclwxqq.supabase.co';
const SUPABASE_KEY = 'sb_publishable_90JbyFsa4BuuyeuLCIActg_yXfbHQ30';
const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

// ====================================================================
// PUT YOUR GITHUB PAGES ADDRESS HERE (the folder your site lives in).
// It must end with a slash, for example: https://yourname.github.io/yourrepo/
// Until you change it, the page uses whatever address it is opened from.
// (This is why the email link was opening on your own computer.)
// ====================================================================
const SITE_URL = 'https://YOUR-USERNAME.github.io/YOUR-REPO/';

function getVerifyUrl() {
  if (SITE_URL.includes('YOUR-')) {
    return new URL('verify.html', window.location.href).href;
  }
  return new URL('verify.html', SITE_URL).href;
}

const form = document.getElementById('registerForm');
const fullNameInput = document.getElementById('fullName');
const emailInput = document.getElementById('email');
const phoneInput = document.getElementById('phone');
const qualificationInput = document.getElementById('qualification');
const fieldOfStudyInput = document.getElementById('fieldOfStudy');
const passwordInput = document.getElementById('password');
const registerBtn = document.getElementById('registerBtn');
const messageEl = document.getElementById('message');

// type is 'error', 'success' or '' (clears the message)
function showMessage(text, type) {
  messageEl.textContent = text;
  messageEl.className = type;
}

// True when the qualification is above matric, so a field of study is needed
function needsFieldOfStudy(qualification) {
  const q = qualification.trim().toLowerCase();
  return !(q === '' || q.startsWith('no matric') || q.startsWith('matric'));
}

// Listens for the form being submitted, so the Enter key works too
form.addEventListener('submit', async (event) => {
  event.preventDefault();
  showMessage('', '');

  const full_name = fullNameInput.value.trim();
  const email = emailInput.value.trim().toLowerCase();
  const phone = phoneInput.value.trim();
  const qualification = qualificationInput.value.trim();
  const password = passwordInput.value;

  // Field of study is only kept for qualifications above matric
  const field_of_study = needsFieldOfStudy(qualification)
    ? fieldOfStudyInput.value.trim()
    : null;

  if (!full_name || !email || !phone || !qualification || !password) {
    showMessage('Please fill in all fields.', 'error');
    return;
  }

  if (needsFieldOfStudy(qualification) && !field_of_study) {
    showMessage('Please select your field of study.', 'error');
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

  // Stops double-clicks from sending two sign-ups
  registerBtn.disabled = true;
  registerBtn.textContent = 'Registering...';

  try {
    // The email link points to your GitHub Pages address (see SITE_URL above)
    const verifyUrl = getVerifyUrl();

    // Supabase Auth checks for duplicate emails itself, so we don't look in the graduates table
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: verifyUrl,
        // field_of_study is saved here so verify.html can insert it later
        data: { full_name, phone, qualification, field_of_study }
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

    showMessage('Registration successful! Please check your email (and your spam folder) to verify your account before logging in. ', 'success');

    // A link to the resend page, in case the email never arrives
    const resendLink = document.createElement('a');
    resendLink.href = 'verify.html';
    resendLink.textContent = "Didn't get it? Resend the email.";
    messageEl.appendChild(resendLink);

    form.reset();

  } catch (err) {
    console.error('Sign-up error:', err);
    showMessage('Error: ' + err.message, 'error');
  } finally {
    registerBtn.disabled = false;
    registerBtn.textContent = 'Register';
  }
});
