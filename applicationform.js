import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js/+esm';

const SUPABASE_URL = 'https://euclknvsppptbfclwxqq.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImV1Y2xrbnZzcHBwdGJmY2x3eHFxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTc2Mjc2NTQsImV4cCI6MjA3MzIwMzY1NH0.HlGW3kZJ4CPnF2JuZGs_4ObkhxwVFTSedb7O8HHDEag';
const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);
async function checkJobValidity() {
    if (!jobId) {
        alert("No job selected.");
        window.location.href = "homepage.html";
        return false;
    }

    const { data: jobData, error } = await supabase
        .from("jobs")
        .select("*")
        .eq("id", jobId)
        .single();

    if (error || !jobData) {
        alert("Sorry, this job has just been closed or removed.");
        // Disable the form
        form.querySelectorAll("input, textarea, button, select").forEach(el => el.disabled = true);
        // Optionally redirect after a few seconds
        setTimeout(() => window.location.href = "homepage.html", 3000);
        return false;
    }

    // Optionally show job title if available
    if (jobData.title) jobTitleEl.textContent = `Applying for: ${jobData.title}`;

    return true;
}

// Call it right after DOM loads
checkJobValidity();

// Wrap everything so DOM elements are guaranteed to exist
document.addEventListener('DOMContentLoaded', () => {
  const form = document.getElementById("applicationForm");
  const newCVInput = document.getElementById("newCV");
  const previewCVBtn = document.getElementById("previewCV");
  const cvDefaultRadio = document.getElementById("cvDefault");
  const cvNewRadio = document.getElementById("cvNew");
  const jobTitleEl = document.getElementById("jobTitle");
  const coverLetterInput = document.getElementById("coverLetter");

  let defaultCVFileName = null;
  let defaultCVSignedUrl = null; // cached signed url

  // Disable upload if default selected
  function setNewCVState() {
    if (cvDefaultRadio.checked) {
      newCVInput.disabled = true;
      // clear any selected file to avoid confusion
      newCVInput.value = "";
    } else {
      newCVInput.disabled = false;
    }
  }
  // initial state
  setNewCVState();

  cvDefaultRadio.addEventListener('change', setNewCVState);
  cvNewRadio.addEventListener('change', setNewCVState);

  // Get job info from URL (if present)
  const urlParams = new URLSearchParams(window.location.search);
  const jobId = urlParams.get("job_id");
  const jobTitle = urlParams.get("job_title");
  if (jobTitle) jobTitleEl.textContent = `Applying for: ${jobTitle}`;

  // Load graduate profile and set default CV if available
  async function loadGraduateProfile() {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.user) return; // not logged in; keep form usable for testing

      const { data, error } = await supabase
        .from("graduates")
        .select("full_name, email, cellnumber, cv_url")
        .eq("id", session.user.id)
        .single();

      if (error) {
        console.error("Failed to load profile:", error);
        return;
      }

      document.getElementById("name").value = data.full_name || "";
      document.getElementById("email").value = data.email || "";
      document.getElementById("cellnumber").value = data.cellnumber || "";

      // store filename if present
      if (data.cv_url) {
        defaultCVFileName = data.cv_url; // e.g. "mycv.pdf"
        // Pre-create a signed URL (short TTL) and cache it
        const filePath = `graduates/${session.user.id}/${data.cv_url}`;
        try {
          const { data: signedData, error: signedError } = await supabase.storage
            .from("cv_bucket")
            .createSignedUrl(filePath, 300); // 5 minutes
          if (!signedError) defaultCVSignedUrl = signedData.signedUrl;
        } catch (err) {
          console.warn("Failed to create signed url for default CV:", err);
        }
      }
    } catch (err) {
      console.error("loadGraduateProfile error:", err);
    }
  }

  // Preview CV handler (works for default and uploaded file)
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
      const file = document.getElementById('newCV').files[0];
      if (!file) return alert("Please upload a CV.");
      filePath = `graduates/${session.user.id}/${file.name}`; // temporary blob handled differently
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

    const name = document.getElementById("name").value;
    const email = document.getElementById("email").value;
    const cellnumber = document.getElementById("cellnumber").value;
    const coverLetter = document.getElementById("coverLetter").value || null;
    const cvOption = document.querySelector("input[name='cvOption']:checked").value;

    let finalCVPath = null;

    // Handle CV selection
    if (cvOption === "default") {
       // fetch cv_url from DB if not loaded
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

    // Get recruiter_id for this job
    const { data: jobData, error: jobError } = await supabase
        .from("jobs")
        .select("recruiter_id")
        .eq("id", jobId)
        .single();
    if (jobError) return alert("Failed to find job: " + jobError.message);

    // Insert into applications table
    const { error: insertError } = await supabase
        .from("applications")
        .insert([{
            job_id: jobId,
            student_id: session.user.id,
            recruiter_id: jobData.recruiter_id,
            cv_url: finalCVPath,
            cover_letter: coverLetter,
            status: "pending",      // default
            created_at: new Date()
        }]);

    if (insertError) alert("Application failed: " + insertError.message);
    else alert("Application submitted successfully!");
});


  // Initial load
  loadGraduateProfile();
});
