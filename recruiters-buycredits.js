import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js/+esm';

// ---------------- Supabase setup ----------------
const SUPABASE_URL = 'https://euclknvsppptbfclwxqq.supabase.co';
const SUPABASE_KEY = 'sb_publishable_90JbyFsa4BuuyeuLCIActg_yXfbHQ30';
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

  confirmPaid.disabled = true; // Disable until proof is uploaded
  modal.classList.add('show');
}

// Hide modal
function closeModalFunc() {
  modal.classList.remove('show');
  proofFile.value = ''; // reset file input
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

// Enable confirm button only after proof is selected
proofFile.addEventListener('change', () => {
  confirmPaid.disabled = !proofFile.files.length;
});

// Submit payment
confirmPaid.addEventListener('click', async () => {
  try {
    // Get current logged-in recruiter
    const { data: { session }, error: sessionError } = await supabase.auth.getSession();
    if (sessionError || !session?.user) throw new Error("User must be logged in");
    const recruiterId = session.user.id;

    // Upload proof
    let proof_url = null;
    const file = proofFile.files[0];
    if (file) {
      const filePath = `payment-proofs/${recruiterId}/${currentRef}-${file.name}`;
      const { data: uploadData, error: uploadError } = await supabase.storage
        .from('payment-proofs')
        .upload(filePath, file, { upsert: true, contentType: file.type });

      if (uploadError) throw new Error(uploadError.message);

      const { data: publicData } = supabase.storage.from('payment-proofs').getPublicUrl(filePath);
      proof_url = publicData.publicUrl;
    }

    // Insert payment with recruiter_id
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
