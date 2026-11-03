import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js/+esm';

const SUPABASE_URL = 'https://euclknvsppptbfclwxqq.supabase.co';
const SUPABASE_KEY = 'sb_publishable_90JbyFsa4BuuyeuLCIActg_yXfbHQ30';
const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

// Elements
const emailInput = document.getElementById('email');
const passwordInput = document.getElementById('password');
const loginBtn = document.getElementById('loginBtn');
const message = document.getElementById('message');
const togglePassword = document.getElementById('togglePassword');



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
