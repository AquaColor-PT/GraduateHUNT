// ---------------- CONNECT TO SUPABASE ----------------
import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js/+esm';

const SUPABASE_URL = 'https://euclknvsppptbfclwxqq.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImV1Y2xrbnZzcHBwdGJmY2x3eHFxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTc2Mjc2NTQsImV4cCI6MjA3MzIwMzY1NH0.HlGW3kZJ4CPnF2JuZGs_4ObkhxwVFTSedb7O8HHDEag';
const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

// ---------------- ELEMENTS ----------------
const emailInput = document.getElementById('email');
const passwordInput = document.getElementById('password');
const loginBtn = document.getElementById('loginBtn');
const message = document.getElementById('message');

// ---------------- LOGIN ----------------
loginBtn.addEventListener('click', async () => {
    const email = emailInput.value.trim();
    const password = passwordInput.value;

    if (!email || !password) {
        message.style.color = 'red';
        message.textContent = "Enter email and password";
        return;
    }

    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) {
        message.style.color = 'red';
        message.textContent = error.message;
        return;
    }

    // ✅ Login successful, redirect to homepage for logged-in users
    message.style.color = 'green';
    message.textContent = "Login successful! Redirecting...";
    window.location.href = 'homepageRegisteredUser.html';
});

// ---------------- AUTH STATE CHANGE ----------------
supabase.auth.onAuthStateChange((event, session) => {
    if (session?.user) {
        // ✅ If already logged in, send them straight to homepage for logged-in users
        window.location.href = 'homepageRegisteredUser.html';
    }
});
