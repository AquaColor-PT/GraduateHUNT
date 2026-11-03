import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js/+esm';

const SUPABASE_URL = 'https://euclknvsppptbfclwxqq.supabase.co';
const SUPABASE_KEY = 'sb_publishable_90JbyFsa4BuuyeuLCIActg_yXfbHQ30';
const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

// Elements
const emailInput = document.getElementById('email');
const passwordInput = document.getElementById('password');
const loginBtn = document.getElementById('loginBtn');
const message = document.getElementById('message');

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

    // Check if recruiter exists in your table
    const { data: recruiter, error: recruiterError } = await supabase
      .from('recruiters')
      .select('verified')
      .eq('email', email)
      .single();

    if(recruiterError || !recruiter){
      await supabase.auth.signOut();
      message.style.color = 'red';
      message.textContent = "This account is not registered as a recruiter.";
      return;
    }

    if(!recruiter.verified){
      message.style.color = 'red';
      message.textContent = "Your account is pending approval. Please wait for the GraduateinHunt team to verify you.";
      return;
    }

    message.style.color = 'green';
    message.textContent = "Login successful! Redirecting...";

    // Redirect to recruiter-credits page instead of dashboard
    setTimeout(() => window.location.href = 'recruiters-buycredits.html', 1200);

  } catch(err) {
    console.error(err);
    message.style.color = 'red';
    message.textContent = err.message;
  }
});
