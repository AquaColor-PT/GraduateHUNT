import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js/+esm';

const SUPABASE_URL = 'https://euclknvsppptbfclwxqq.supabase.co';
const SUPABASE_KEY = 'sb_publishable_90JbyFsa4BuuyeuLCIActg_yXfbHQ30';
const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

// Elements
const form = document.getElementById('loginForm');
const emailInput = document.getElementById('email');
const passwordInput = document.getElementById('password');
const loginBtn = document.getElementById('loginBtn');
const message = document.getElementById('message');

// type is 'error', 'success' or '' (clears the message)
function showMessage(text, type) {
  message.textContent = text;
  message.className = type;
}

// Turns Supabase's technical errors into messages people can act on
function friendlyError(err) {
  const text = err.message || '';

  if (err.code === 'email_not_confirmed' || /not confirmed/i.test(text)) {
    return 'unverified';
  }
  if (err.code === 'invalid_credentials' || /invalid login credentials/i.test(text)) {
    return 'Wrong email or password. Please try again.';
  }
  if (err.status === 429 || /rate limit|too many/i.test(text)) {
    return 'Too many attempts. Please wait a minute and try again.';
  }
  if (/failed to fetch|network/i.test(text)) {
    return 'Could not connect. Please check your internet and try again.';
  }
  return 'Something went wrong. Please try again.';
}

// FIX: listens for the form being submitted, so the Enter key works too
form.addEventListener('submit', async (event) => {
  event.preventDefault();
  showMessage('', '');

  // Lower-case the email, because registration saves it in lower case
  const email = emailInput.value.trim().toLowerCase();
  const password = passwordInput.value;

  if (!email || !password) {
    showMessage('Enter email and password', 'error');
    return;
  }

  // FIX: stops double-clicks from sending two login requests
  loginBtn.disabled = true;
  loginBtn.textContent = 'Logging in...';

  try {
    const { data: authData, error: authError } = await supabase.auth.signInWithPassword({ email, password });
    if (authError) throw authError;

    const user = authData.user;

    // FIX: look the graduate up by their account id, not by email.
    // The old way used .single(), which throws an error when nothing matches,
    // and it compared email text exactly, so capital letters could cause a mismatch.
    const { data: graduate, error: graduateError } = await supabase
      .from('graduates')
      .select('id')
      .eq('id', user.id)
      .maybeSingle();

    if (graduateError) {
      console.error(graduateError);
      await supabase.auth.signOut();
      showMessage('We could not check your account. Please try again.', 'error');
      return;
    }

    if (!graduate) {
      // FIX: a verified graduate whose profile was never saved (for example the
      // verification page was closed too early) is no longer locked out. Their
      // sign-up details are still stored on the account, so we finish saving them now.
      const meta = user.user_metadata || {};

      if (meta.qualification) {
        const { error: insertError } = await supabase.from('graduates').insert([{
          id: user.id,
          full_name: meta.full_name,
          email: user.email,
          phone: meta.phone,
          qualification: meta.qualification,
          created_at: new Date().toISOString()
        }]);

        if (insertError) {
          console.error(insertError);
          await supabase.auth.signOut();
          showMessage('We could not finish setting up your account. Please try again.', 'error');
          return;
        }
      } else {
        await supabase.auth.signOut();
        showMessage('This account is not registered as a graduate.', 'error');
        return;
      }
    }

    showMessage('Login successful! Redirecting...', 'success');
    setTimeout(() => window.location.href = 'homepageRegisteredUser.html', 1200);

  } catch (err) {
    console.error(err);
    const friendly = friendlyError(err);

    if (friendly === 'unverified') {
      // FIX: people who haven't verified their email now get a clear next step
      showMessage('Your email is not verified yet. Check your inbox and spam folder. ', 'error');
      const resendLink = document.createElement('a');
      resendLink.href = 'verify.html';
      resendLink.textContent = 'Resend the verification email.';
      message.appendChild(resendLink);
    } else {
      showMessage(friendly, 'error');
    }
  } finally {
    loginBtn.disabled = false;
    loginBtn.textContent = 'Login';
  }
});
