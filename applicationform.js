import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js/+esm';

const SUPABASE_URL = 'https://euclknvsppptbfclwxqq.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImV1Y2xrbnZzcHBwdGJmY2x3eHFxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTc2Mjc2NTQsImV4cCI6MjA3MzIwMzY1NH0.HlGW3kZJ4CPnF2JuZGs_4ObkhxwVFTSedb7O8HHDEag';
const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

document.addEventListener('DOMContentLoaded', async () => {
  const form = document.getElementById("applicationForm");
  const newCVInput = document.getElementById("newCV");
  const previewCVBtn = document.getElementById("previewCV");
  const cvDefaultRadio = document.getElementById("cvDefault");
  const cvNewRadio = document.getElementById("cvNew");
  const jobTitleEl = document.getElementById("jobTitle");
  const coverLetterInput = document.getElementById("coverLetter");
  const nameInput = document.getElementById("name");

  let defaultCVFileName = null;
  let defaultCVSignedUrl = null; // cached signed url

  // Disable upload if default selected
  function setNewCVState() {
    if (cvDefaultRadio.checked) {
      newCVInput.disabled = true;
      newCVInput.value = "";
    } else {
      newCVInput.disabled = false;
    }
  }
  setNewCVState();
  cvDefaultRadio.addEventListener('change', setNewCVState);
  cvNewRadio.addEventListener('change', setNewCVState);

  // Get job info from URL (if present)
  const urlParams = new URLSearchParams(window.location.search);
  const jobId = urlParams.get("job_id");
  const jobTitle = urlParams.get("job_title");
  if (jobTitle) jobTitleEl.textContent = `Applying for: ${jobTitle}`;

  // Load graduate profile and autofill
  async function loadGraduateProfile() {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.user) return;

      const { data, error } = await supabase
        .from("graduates")
        .select("full_name, email, phone, cv_url")
        .eq("id", session.user.id)
        .single();

      if (error) return console.error("Failed to load profile:", error);

      // Autofill inputs
      nameInput.value = data.full_name || "";
      nameInput.disabled = true; // lock name
      document.getElementById("email").value = data.email || "";
      document.getElementById("cellnumber").value = data.phone || ""; // <- fix here

      // Store default CV
      defaultCVFileName = data.cv_url || null;

      if (data.cv_url) {
        const filePath = `graduates/${session.user.id}/${data.cv_url}`;
        try {
          const { data: signedData, error: signedError } = await supabase.storage
            .from("cv_bucket")
            .createSignedUrl(filePath, 300);
          if (!signedError) defaultCVSignedUrl = signedData.signedUrl;
        } catch (err) {
          console.warn("Failed to create signed url for default CV:", err);
        }
      }
    } catch (err) {
      console.error("loadGraduateProfile error:", err);
    }
  }

  // Preview CV
  previewCVBtn.addEventListener('click', async (e) => {
    e.preventDefault();
    const cvOption = document.querySelector("input[name='cvOption']:checked")?.value;
    if (!cvOption) return alert("Please choose a CV option.");

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.user) throw new Error("User not logged in.");

      let filePath;
      if (cvOption === "default") {
        const { data, error } = await supabase
          .from('graduates')
          .select('cv_url')
          .eq('id', session.user.id)
          .single();
        if (error || !data?.cv_url) return alert("No default CV available.");
        filePath = `graduates/${session.user.id}/${data.cv_url}`;
      } else {
        const file = newCVInput.files[0];
        if (!file) return alert("Please upload a CV.");
        return window.open(URL.createObjectURL(file), '_blank');
      }

      const { data: signedData, error: signedError } = await supabase.storage
        .from('cv_bucket')
        .createSignedUrl(filePath, 60);
      if (signedError) throw signedError;

      window.open(signedData.signedUrl, '_blank');
    } catch (err) {
      console.error(err);
      alert("Failed to preview CV: " + err.message);
    }
  });

  // Submit application
  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    const { data: { session } } = await supabase.auth.getSession();
    if (!session?.user) return alert("You must be logged in.");

    const name = nameInput.value;
    const email = document.getElementById("email").value;
    const cellnumber = document.getElementById("cellnumber").value;
    const coverLetter = coverLetterInput.value || null;
    const cvOption = document.querySelector("input[name='cvOption']:checked").value;

    let finalCVPath = null;

    if (cvOption === "default") {
      if (!defaultCVFileName) {
        const { data, error } = await supabase
          .from('graduates')
          .select('cv_url')
          .eq('id', session.user.id)
          .single();
        if (error || !data?.cv_url) return alert("No default CV available.");
        defaultCVFileName = data.cv_url;
      }
      finalCVPath = `graduates/${session.user.id}/${defaultCVFileName}`;
    } else {
      const file = newCVInput.files[0];
      if (!file) return alert("Please upload a CV.");

      const filePath = `graduates/${session.user.id}/${file.name}`;
      const { error: uploadError } = await supabase.storage
        .from("cv_bucket")
        .upload(filePath, file, { upsert: true });

      if (uploadError) return alert("CV upload failed: " + uploadError.message);
      finalCVPath = filePath;
    }

    const { data: jobData, error: jobError } = await supabase
      .from("jobs")
      .select("recruiter_id")
      .eq("id", jobId)
      .single();
    if (jobError) return alert("Failed to find job: " + jobError.message);

    const { error: insertError } = await supabase
      .from("applications")
      .insert([{
        job_id: jobId,
        student_id: session.user.id,
        recruiter_id: jobData.recruiter_id,
        cv_url: finalCVPath,
        cover_letter: coverLetter,
        status: "pending",
        created_at: new Date()
      }]);

  if (insertError) {
    alert("Application failed: " + insertError.message);
} else {
    alert("Application submitted successfully!");
    // Redirect to browse jobs
    window.location.href = 'browse-jobs.html';
}

  });

  // Initial load
  loadGraduateProfile();
});
