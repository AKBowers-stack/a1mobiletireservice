const supabaseClient = window.a1Supabase;
const serviceButtons = document.querySelectorAll("[data-service]");
const selectedServiceInput = document.querySelector("[data-selected-service]");
const summaryService = document.querySelector("[data-summary-service]");
const requestForm = document.querySelector("[data-request-form]");
const formMessage = document.querySelector("[data-form-message]");
const views = document.querySelectorAll("[data-view]");
const bottomRequest = document.querySelector("[data-bottom-request]");
const jobList = document.querySelector("[data-job-list]");
const counts = {
  new: document.querySelector('[data-count="new"]'),
  accepted: document.querySelector('[data-count="accepted"]'),
  complete: document.querySelector('[data-count="complete"]'),
};
const adminLogin = document.querySelector("[data-admin-login]");
const adminView = document.querySelector("[data-view='admin']");
const adminLoginForm = document.querySelector("[data-admin-login-form]");
const adminLoginMessage = document.querySelector("[data-admin-login-message]");
const adminSignOutButtons = document.querySelectorAll("[data-admin-sign-out]");
const jobFilterButtons = document.querySelectorAll("[data-job-filter]");
const jobsTitle = document.querySelector("[data-jobs-title]");
let currentJobFilter = "active";

function setSelectedService(service, selectedButton) {
  if (!selectedServiceInput || !summaryService) return;

  serviceButtons.forEach((option) => {
    const isSelected = option === selectedButton || option.dataset.service === service;
    option.classList.toggle("is-selected", isSelected);
    option.setAttribute("aria-checked", String(isSelected));
  });

  selectedServiceInput.value = service;
  summaryService.textContent = service;
}

function formatDate(value) {
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(value));
}

function escapeHtml(value) {
  return String(value || "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function publicPhoneNumber(phone) {
  return escapeHtml(phone).replace(/\D/g, "");
}

function smsPhoneNumber(phone) {
  const cleanPhone = publicPhoneNumber(phone);
  return cleanPhone.length === 10 ? `+1${cleanPhone}` : `+${cleanPhone}`;
}

function etaMessage(eta) {
  return `A1 Mobile Tire Service update: your technician ETA is ${eta}. Reply or call 262-527-3209 with any questions.`;
}

function smsLink(phone, message) {
  const separator = /iPad|iPhone|iPod/.test(navigator.userAgent) ? "&" : "?";
  return `sms:${smsPhoneNumber(phone)}${separator}body=${encodeURIComponent(message)}`;
}

async function uploadPhoto(file) {
  if (!file || !file.name) return { photoPath: "", photoName: "" };

  const cleanName = file.name.replace(/[^a-zA-Z0-9._-]/g, "-");
  const photoPath = `${crypto.randomUUID()}-${cleanName}`;
  const { error } = await supabaseClient.storage.from("request-photos").upload(photoPath, file, {
    cacheControl: "3600",
    upsert: false,
  });

  if (error) throw error;

  return { photoPath, photoName: file.name };
}

async function getPhotoUrl(photoPath) {
  if (!photoPath) return "";

  const { data, error } = await supabaseClient.storage.from("request-photos").createSignedUrl(photoPath, 3600);
  if (error) return "";
  return data.signedUrl;
}

async function addJob(data) {
  const { error } = await supabaseClient.from("service_requests").insert(data);
  if (error) throw error;
}

async function updateJob(id, changes) {
  const { error } = await supabaseClient.from("service_requests").update(changes).eq("id", id);
  if (error) throw error;
  await renderJobs();
}

async function fetchJobs() {
  const { data, error } = await supabaseClient
    .from("service_requests")
    .select("*")
    .order("created_at", { ascending: false });

  if (error) throw error;
  return data || [];
}

async function renderJobs() {
  if (!jobList || !counts.new || !counts.accepted || !counts.complete) return;

  jobList.innerHTML = '<p class="empty-state">Loading requests...</p>';

  try {
    const jobs = await fetchJobs();
    const countByStatus = jobs.reduce(
      (totals, job) => {
        totals[job.status] = (totals[job.status] || 0) + 1;
        return totals;
      },
      { new: 0, accepted: 0, declined: 0, complete: 0 }
    );

    counts.new.textContent = countByStatus.new;
    counts.accepted.textContent = countByStatus.accepted;
    counts.complete.textContent = countByStatus.complete;

    const visibleJobs = jobs.filter((job) =>
      currentJobFilter === "archive" ? job.status === "complete" : job.status !== "complete"
    );

    if (!visibleJobs.length) {
      jobList.innerHTML =
        currentJobFilter === "archive"
          ? '<p class="empty-state">No completed requests have been archived yet.</p>'
          : '<p class="empty-state">No active requests right now.</p>';
      return;
    }

    const jobsWithPhotos = await Promise.all(
      visibleJobs.map(async (job) => ({ ...job, photo_url: await getPhotoUrl(job.photo_path) }))
    );

    jobList.innerHTML = jobsWithPhotos
      .map(
        (job) => `
          <article class="job-card" data-job-id="${job.id}" data-customer-phone="${publicPhoneNumber(job.phone)}">
            <div class="job-top">
              <div>
                <h3 class="job-title">${escapeHtml(job.service)} &middot; ${escapeHtml(job.name)}</h3>
                <p class="job-subtitle">${formatDate(job.created_at)}${job.eta ? ` &middot; ETA ${escapeHtml(job.eta)}` : ""}</p>
              </div>
              <span class="job-status ${escapeHtml(job.status)}">${escapeHtml(job.status)}</span>
            </div>

            <div class="job-details">
              <div class="detail"><span>Customer</span><strong>${escapeHtml(job.name)}</strong></div>
              <div class="detail"><span>Phone</span><strong><a href="tel:${publicPhoneNumber(job.phone)}">${escapeHtml(job.phone)}</a></strong></div>
              <div class="detail"><span>Vehicle</span><strong>${escapeHtml(job.make)} ${escapeHtml(job.model)}</strong></div>
              <div class="detail"><span>Tire size</span><strong>${escapeHtml(job.tire_size)}</strong></div>
              <div class="detail"><span>License plate</span><strong>${escapeHtml(job.license_plate || "Not recorded")}</strong></div>
              <div class="detail"><span>Location</span><strong>${escapeHtml(job.location)}</strong></div>
              <div class="detail"><span>Photo</span><strong>${escapeHtml(job.photo_name || "No photo uploaded")}</strong></div>
              <div class="detail"><span>Policy agreement</span><strong>${job.policies_accepted ? "Accepted" : "Not recorded"}</strong></div>
              <div class="detail"><span>Electronic signature</span><strong>${escapeHtml(job.signature_name || "Not recorded")}</strong></div>
              <div class="detail"><span>Signed</span><strong>${job.signed_at ? formatDate(job.signed_at) : "Not recorded"}</strong></div>
              <div class="detail"><span>Policy version</span><strong>${escapeHtml(job.policy_version || "Not recorded")}</strong></div>
            </div>

            <div class="job-notes">
              <span>Notes</span>
              <strong>${escapeHtml(job.notes || "No notes provided")}</strong>
            </div>

            ${job.photo_url ? `<img class="job-photo" src="${job.photo_url}" alt="Uploaded customer photo for ${escapeHtml(job.service)}" />` : ""}

            ${
              job.status === "complete"
                ? `
                  <div class="job-actions">
                    <button class="neutral" type="button" data-action="restore">Restore to active</button>
                    <a class="action-button neutral" href="sms:${smsPhoneNumber(job.phone)}">Text customer</a>
                    <a class="action-button neutral" href="tel:${publicPhoneNumber(job.phone)}">Call customer</a>
                  </div>
                `
                : `
                  <div class="eta-row">
                    <input type="text" value="${escapeHtml(job.eta)}" placeholder="Set ETA, ex: 25 minutes" data-eta-input />
                    <button class="neutral" type="button" data-action="eta">Save ETA</button>
                  </div>

                  <div class="job-actions">
                    <button class="accept" type="button" data-action="accept">Accept job</button>
                    <button class="decline" type="button" data-action="decline">Decline</button>
                    <button class="complete" type="button" data-action="complete">Complete &amp; archive</button>
                    <a class="action-button neutral" href="${job.eta ? smsLink(job.phone, etaMessage(job.eta)) : `sms:${smsPhoneNumber(job.phone)}`}" data-action="text-eta">Text ETA</a>
                    <a class="action-button neutral" href="sms:${smsPhoneNumber(job.phone)}">Text customer</a>
                    <a class="action-button neutral" href="tel:${publicPhoneNumber(job.phone)}">Call customer</a>
                  </div>
                `
            }
          </article>
        `
      )
      .join("");
  } catch (error) {
    jobList.innerHTML = `<p class="empty-state">Could not load requests. ${escapeHtml(error.message)}</p>`;
  }
}

async function showAdminForSession() {
  if (!adminLogin || !adminView) return;

  const { data } = await supabaseClient.auth.getSession();
  const isSignedIn = Boolean(data.session);

  adminLogin.hidden = isSignedIn;
  adminView.hidden = !isSignedIn;

  if (isSignedIn) {
    await renderJobs();
  }
}

serviceButtons.forEach((button) => {
  button.addEventListener("click", () => {
    setSelectedService(button.dataset.service, button);
  });
});

requestForm?.addEventListener("submit", async (event) => {
  event.preventDefault();

  formMessage.textContent = "Submitting request...";

  try {
    const formData = new FormData(requestForm);
    const photo = formData.get("photo");
    const uploadedPhoto = await uploadPhoto(photo);

    await addJob({
      name: formData.get("name"),
      phone: formData.get("phone"),
      make: formData.get("make"),
      model: formData.get("model"),
      tire_size: formData.get("tireSize"),
      license_plate: formData.get("licensePlate").trim().toUpperCase(),
      service: formData.get("service"),
      location: formData.get("location"),
      photo_name: uploadedPhoto.photoName,
      photo_path: uploadedPhoto.photoPath,
      notes: formData.get("notes"),
      policies_accepted: formData.get("policiesAccepted") === "on",
      signature_name: formData.get("signatureName").trim(),
      signed_at: new Date().toISOString(),
      policy_version: formData.get("policyVersion"),
    });

    requestForm.reset();
    setSelectedService("Tire replacement");
    formMessage.textContent = "Request submitted. A1 Mobile Tire Service will review your job details.";
  } catch (error) {
    formMessage.textContent = `Request could not be submitted: ${error.message}`;
  }
});

adminLoginForm?.addEventListener("submit", async (event) => {
  event.preventDefault();
  adminLoginMessage.textContent = "Signing in...";

  const formData = new FormData(adminLoginForm);
  const { error } = await supabaseClient.auth.signInWithPassword({
    email: formData.get("email"),
    password: formData.get("password"),
  });

  if (error) {
    adminLoginMessage.textContent = error.message;
    return;
  }

  adminLoginMessage.textContent = "";
  await showAdminForSession();
});

adminSignOutButtons.forEach((button) => {
  button.addEventListener("click", async () => {
    await supabaseClient.auth.signOut();
    await showAdminForSession();
  });
});

jobList?.addEventListener("click", async (event) => {
  const actionButton = event.target.closest("[data-action]");
  if (!actionButton) return;

  const jobCard = actionButton.closest("[data-job-id]");
  const jobId = jobCard.dataset.jobId;
  const action = actionButton.dataset.action;

  if (action === "accept") await updateJob(jobId, { status: "accepted" });
  if (action === "decline") await updateJob(jobId, { status: "declined" });
  if (action === "complete") await updateJob(jobId, { status: "complete" });
  if (action === "restore") await updateJob(jobId, { status: "accepted" });
  if (action === "eta") {
    const eta = jobCard.querySelector("[data-eta-input]").value.trim();
    await updateJob(jobId, { eta });
  }
  if (action === "text-eta") {
    const eta = jobCard.querySelector("[data-eta-input]").value.trim();

    if (!eta) {
      event.preventDefault();
      alert("Enter an ETA first.");
      return;
    }

    updateJob(jobId, { eta });
  }
});

jobFilterButtons.forEach((button) => {
  button.addEventListener("click", async () => {
    currentJobFilter = button.dataset.jobFilter;
    jobFilterButtons.forEach((option) => {
      const isSelected = option === button;
      option.classList.toggle("is-active", isSelected);
      option.setAttribute("aria-selected", String(isSelected));
    });
    if (jobsTitle) {
      jobsTitle.textContent = currentJobFilter === "archive" ? "Completed archive" : "Active requests";
    }
    await renderJobs();
  });
});

jobList?.addEventListener("input", (event) => {
  if (!event.target.matches("[data-eta-input]")) return;

  const jobCard = event.target.closest("[data-job-id]");
  const textEtaLink = jobCard.querySelector('[data-action="text-eta"]');
  const eta = event.target.value.trim();
  const customerPhone = jobCard.dataset.customerPhone;

  textEtaLink.href = eta
    ? smsLink(customerPhone, etaMessage(eta))
    : `sms:${smsPhoneNumber(customerPhone)}`;
});

if (bottomRequest) {
  bottomRequest.style.display = "grid";
}

views.forEach((view) => view.classList.add("is-active"));
showAdminForSession();
