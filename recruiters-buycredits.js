import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm';

// ---------------- Supabase setup ----------------
const SUPABASE_URL = 'https://euclknvsppptbfclwxqq.supabase.co';
const SUPABASE_KEY = 'sb_publishable_90JbyFsa4BuuyeuLCIActg_yXfbHQ30';
const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

// Change this to your recruiter login page
const LOGIN_PAGE = 'recruiter-login.html';

const PRICE_PER_CREDIT = 50;   // rand
const MONTHLY_PRICE = 1500;    // rand
const MAX_FILE_BYTES = 5 * 1024 * 1024;
const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'application/pdf'];

// ---------------- DOM refs ----------------
const $ = (id) => document.getElementById(id);
const creditsBtn = $('buyCreditsBtn');
const monthlyBtn = $('buyMonthlyBtn');
const modal = $('payModal');
const modalCard = $('payCard');
const amountText = $('amountText');
const payRefEl = $('payRef');
const copyRefBtn = $('copyRef');
const proofFile = $('proofFile');
const closeModal = $('closeModal');
const confirmPaid = $('confirmPaid');
const creditsSelect = $('creditsSelect');
const payMsg = $('payMsg');

let currentAmount = 0;
let currentRef = null;
let currentType = null;
let submitting = false;

// ---------------- Helpers ----------------
function generateReference(tag) {
  const ds = new Date().toISOString().slice(0, 10).replace(/-/g, '');
  const rand = Math.random().toString(36).slice(2, 8).toUpperCase();
  return `${tag}-${ds}-${rand}`;
}

function setMsg(text, type) {
  payMsg.textContent = text;
  payMsg.className = type || '';
}

// Returns an error message, or '' if the file is fine
function checkFile(file) {
  if (!file) return 'Choose your proof of payment first.';
  if (!ALLOWED_TYPES.includes(file.type)) return 'Upload a photo (JPG, PNG, WebP, HEIC) or a PDF.';
  if (file.size > MAX_FILE_BYTES) return 'The file is too big. The limit is 5 MB.';
  return '';
}

function safeName(name) {
  return name.replace(/[^a-zA-Z0-9._-]/g, '_').slice(-80);
}

// ---------------- Modal ----------------
function openModal(amount, type) {
  currentAmount = amount;
  currentType = type;
  currentRef = generateReference(type === 'subscription' ? 'UNLIM' : 'CRD');

  amountText.textContent = `R${amount}`;
  payRefEl.textContent = currentRef;
  proofFile.value = '';
  setMsg('', '');
  copyRefBtn.textContent = 'Copy';
  confirmPaid.hidden = false;
  confirmPaid.disabled = true;
  confirmPaid.textContent = 'I have paid';
  closeModal.textContent = 'Cancel';

  modal.classList.add('show');
  modalCard.focus();
}

function closeModalFunc() {
  if (submitting) return;
  modal.classList.remove('show');
  proofFile.value = '';
}

creditsBtn.addEventListener('click', () => openModal(Number(creditsSelect.value) * PRICE_PER_CREDIT, 'credits'));
monthlyBtn.addEventListener('click', () => openModal(MONTHLY_PRICE, 'subscription'));
closeModal.addEventListener('click', closeModalFunc);
document.addEventListener('keydown', (e) => { if (e.key === 'Escape') closeModalFunc(); });

copyRefBtn.addEventListener('click', async () => {
  try {
    await navigator.clipboard.writeText(currentRef);
    copyRefBtn.textContent = 'Copied';
  } catch {
    setMsg('Could not copy. Select the reference and copy it manually.', 'error');
  }
});

proofFile.addEventListener('change', () => {
  const file = proofFile.files[0];
  const problem = file ? checkFile(file) : '';
  setMsg(problem, problem ? 'error' : '');
  confirmPaid.disabled = !file || !!problem;
});

// ---------------- Submit payment ----------------
confirmPaid.addEventListener('click', async () => {
  if (submitting) return;

  const file = proofFile.files[0];
  const problem = checkFile(file);
  if (problem) { setMsg(problem, 'error'); return; }

  submitting = true;
  confirmPaid.disabled = true;
  confirmPaid.textContent = 'Submitting...';
  setMsg('', '');
  let done = false;

  try {
    const { data: { session }, error: sessionError } = await supabase.auth.getSession();
    if (sessionError || !session?.user) {
      setMsg('Your session has ended. Please log in again.', 'error');
      setTimeout(() => { window.location.href = LOGIN_PAGE; }, 2000);
      return;
    }
    const recruiterId = session.user.id;

    // The first folder must be the recruiter's own id (the storage rules check this)
    const filePath = `${recruiterId}/${currentRef}-${safeName(file.name)}`;
    const { error: uploadError } = await supabase.storage
      .from('payment-proofs')
      .upload(filePath, file, { upsert: false, contentType: file.type });
    if (uploadError) throw new Error('Upload failed: ' + uploadError.message);

    // Only the file path is saved. The bucket is private, so admins open it with a signed link.
    const { error: insertError } = await supabase.from('payments').insert([{
      recruiter_id: recruiterId,
      reference: currentRef,
      amount_cents: currentAmount * 100,
      credits_added: currentType === 'credits' ? Number(creditsSelect.value) : null,
      type: currentType,
      proof_path: filePath,
      status: 'pending'
    }]);
    if (insertError) {
      if (insertError.code === '23505') throw new Error('This payment was already submitted.');
      throw new Error(insertError.message);
    }

    done = true;
    setMsg('Payment submitted. We will check your proof and update your account.', 'success');
    confirmPaid.hidden = true;
    closeModal.textContent = 'Close';
  } catch (err) {
    console.error('Payment submit error:', err);
    setMsg(err.message || 'Something went wrong. Please try again.', 'error');
  } finally {
    submitting = false;
    if (!done) {
      confirmPaid.disabled = false;
      confirmPaid.textContent = 'I have paid';
    }
  }
});
