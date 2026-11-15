import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm';

const SUPABASE_URL = 'https://euclknvsppptbfclwxqq.supabase.co';
const SUPABASE_KEY = 'sb_publishable_90JbyFsa4BuuyeuLCIActg_yXfbHQ30';
const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

const $ = (id) => document.getElementById(id);
const form = $('loginForm');
const emailInput = $('email');
const passwordInput = $('password');
const loginBtn = $('loginBtn');
const message = $('message');

function show(text, type) {
  message.textContent = text;
  message.className = 'message' + (type ? ' ' + type : '');
}

function friendlyError(err) {
  const msg = (err && err.message) || '';
  if (/invalid login credentials/i.test(msg)) return 'Incorrect email or password.';
  if (/email not confirmed/i.test(msg)) return 'Please verify your email first. Check your inbox for the verification link.';
  if (/rate limit|too many/i.test(msg)) return 'Too many attempts. Please wait a few minutes and try again.';
  return msg || 'Something went wrong. Please try again.';
}

/* ---------- Show / hide password ---------- */
$('togglePassword').addEventListener('click', (e) => {
  const showIt = passwordInput.type === 'password';
  passwordInput.type = showIt ? 'text' : 'password';
  e.currentTarget.textContent = showIt ? 'Hide' : 'Show';
  e.currentTarget.setAttribute('aria-label', showIt ? 'Hide password' : 'Show password');
});

/* ---------- Go back ---------- */
$('goBackBtn').addEventListener('click', () => {
  if (history.length > 1) history.back();
  else window.location.href = 'homepage.html';
});

/* ---------- Login ---------- */
form.addEventListener('submit', async (e) => {
  e.preventDefault();
  show('', '');

  const email = emailInput.value.trim();
  const password = passwordInput.value;

  if (!email || !password) {
    show('Enter your email and password.', 'error');
    return;
  }

  loginBtn.disabled = true;
  loginBtn.textContent = 'Logging in...';
  let redirecting = false;

  try {
    const { data: authData, error: authError } = await supabase.auth.signInWithPassword({ email, password });
    if (authError) throw authError;

    // Look the recruiter up by their account id (not by the email they typed)
    const { data: recruiter, error: recruiterError } = await supabase
      .from('recruiters')
      .select('verified')
      .eq('id', authData.user.id)
      .maybeSingle();

    if (recruiterError) throw recruiterError;

    if (!recruiter) {
      await supabase.auth.signOut();
      show('This account is not registered as a recruiter.', 'error');
      return;
    }

    if (!recruiter.verified) {
      await supabase.auth.signOut();       // do not leave unapproved recruiters logged in
      show('Your account is pending approval. Please wait for the GraduateInHunt team to verify you.', 'error');
      return;
    }

    show('Login successful! Redirecting...', 'success');
    redirecting = true;
    setTimeout(() => { window.location.href = 'recruiters-buycredits.html'; }, 1000);

  } catch (err) {
    console.error('Login error:', err);
    show(friendlyError(err), 'error');
  } finally {
    if (!redirecting) {
      loginBtn.disabled = false;
      loginBtn.textContent = 'Login';
    }
  }
});
