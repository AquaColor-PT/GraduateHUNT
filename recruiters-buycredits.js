import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js/+esm';

// Supabase setup
const SUPABASE_URL = 'https://euclknvsppptbfclwxqq.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImV1Y2xrbnZzcHBwdGJmY2x3eHFxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTc2Mjc2NTQsImV4cCI6MjA3MzIwMzY1NH0.HlGW3kZJ4CPnF2JuZGs_4ObkhxwVFTSedb7O8HHDEag';
const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);


// DOM refs
const creditsBtn = document.getElementById('buyCreditsBtn');
const monthlyBtn = document.getElementById('buyMonthlyBtn');
const modal = document.getElementById('payModal');
const amountText = document.getElementById('amountText');
const payRefEl = document.getElementById('payRef');
const proofFile = document.getElementById('proofFile');
const userRef = document.getElementById('userRef');
const closeModal = document.getElementById('closeModal');
const confirmPaid = document.getElementById('confirmPaid');
const creditsSelect = document.getElementById('creditsSelect');

let currentAmount = 0;
let currentRef = null;
let currentType = null;

// Generate payment reference
function generateReference(tag = 'GIH') {
  const dt = new Date();
  const ds = dt.toISOString().slice(0, 10).replace(/-/g, '');
  const rand = Math.random().toString(36).slice(2, 8).toUpperCase();
  return `${tag}-${ds}-${rand}`;
}

// Show modal
function openModal(amount, type) {
  currentAmount = amount;
  currentType = type;
  currentRef = generateReference(type === 'subscription' ? 'UNLIM' : 'CRD');

  amountText.textContent = `R${amount}`;
  payRefEl.textContent = currentRef;
  userRef.value = currentRef;

  modal.classList.add('show');
}

// Hide modal
function closeModalFunc() {
  modal.classList.remove('show');
}

// Event listeners
creditsBtn.addEventListener('click', () => {
  const credits = Number(creditsSelect.value);
  openModal(credits * 50, 'credits');
});

monthlyBtn.addEventListener('click', () => {
  openModal(1500, 'subscription');
});

closeModal.addEventListener('click', closeModalFunc);

// Submit payment to Supabase
confirmPaid.addEventListener('click', async () => {
  try {
    // Upload proof if exists
    let proof_url = null;
    const file = proofFile.files[0];
    if (file) {
      const { data: uploadData, error: uploadError } = await supabase.storage
        .from('payment-proofs')
        .upload(`proofs/${currentRef}-${file.name}`, file, {
          cacheControl: '3600',
          upsert: true,
          contentType: file.type
        });
      if (uploadError) throw new Error(uploadError.message);
      proof_url = `${SUPABASE_URL}/storage/v1/object/public/payment-proofs/${uploadData.path}`;
    }

    // Get current logged-in recruiter UUID
    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError || !user) throw new Error("User must be logged in");
    const recruiterId = user.id;

    // Insert payment
    const { error: insertError } = await supabase.from('payments').insert([{
      recruiter_id: recruiterId,
      reference: userRef.value,
      amount_cents: currentAmount * 100,
      credits_added: currentType === 'credits' ? Number(creditsSelect.value) : null,
      type: currentType,
      proof_url,
      status: 'pending'
    }]);

    if (insertError) throw new Error(insertError.message);

    alert('✅ Payment submitted. Admin will verify soon.');
    closeModalFunc();

  } catch (err) {
    alert('Error: ' + err.message);
  }
});
