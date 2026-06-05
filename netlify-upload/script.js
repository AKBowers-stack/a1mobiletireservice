const STORAGE_KEY = "a1-mobile-tire-jobs";

const serviceButtons = document.querySelectorAll("[data-service]");
const selectedServiceInput = document.querySelector("[data-selected-service]");
const summaryService = document.querySelector("[data-summary-service]");
const requestForm = document.querySelector("[data-request-form]");
const formMessage = document.querySelector("[data-form-message]");
const viewButtons = document.querySelectorAll("[data-view-button]");
const views = document.querySelectorAll("[data-view]");
const bottomRequest = document.querySelector("[data-bottom-request]");
const jobList = document.querySelector("[data-job-list]");
const seedJobButton = document.querySelector("[data-seed-job]");
const counts = {
  new: document.querySelector('[data-count="new"]'),
  accepted: document.querySelector('[data-count="accepted"]'),
  complete: document.querySelector('[data-count="complete"]'),
};

const sampleJob = {
  name: "Jordan Smith",
  phone: "262-555-0134",
  make: "Ford",
  model: "Fusion",
  tireSize: "225/50R17",
  service: "Tire replacement",
  location: "Gas station on Main St",
  photoName: "flat-tire-photo.jpg",
  notes: "Front passenger tire is flat. Vehicle is parked near pump 4.",
};

function getJobs() {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY)) || [];
  } catch {
    return [];
  }
}

function saveJobs(jobs) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(jobs));
}

function setView(viewName) {
  views.forEach((view) => {
    view.classList.toggle("is-active", view.dataset.view === viewName);
  });

  viewButtons.forEach((button) => {
    button.classList.toggle("is-active", button.dataset.viewButton === viewName);
  });

  if (bottomRequest) {
    bottomRequest.style.display = viewName === "customer" ? "grid" : "none";
  }

  if (viewName === "admin") {
    renderJobs();
    window.location.hash = "admin";
  }
}

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

function createJob(data) {
  return {
    id: crypto.randomUUID ? crypto.randomUUID() : String(Date.now()),
    createdAt: new Date().toISOString(),
    status: "new",
    eta: "",
    ...data,
  };
}

function readPhoto(file) {
  return new Promise((resolve) => {
    if (!file || !file.name) {
      resolve("");
      return;
    }

    const reader = new FileReader();
    reader.addEventListener("load", () => resolve(reader.result));
    reader.addEventListener("error", () => resolve(""));
    reader.readAsDataURL(file);
  });
}

function addJob(data) {
  const jobs = [createJob(data), ...getJobs()];
  saveJobs(jobs);
  renderJobs();
}

function updateJob(id, changes) {
  const jobs = getJobs().map((job) => (job.id === id ? { ...job, ...changes } : job));
  saveJobs(jobs);
  renderJobs();
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

function renderJobs() {
  if (!jobList || !counts.new || !counts.accepted || !counts.complete) return;

  const jobs = getJobs();
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

  if (!jobs.length) {
    jobList.innerHTML = '<p class="empty-state">No requests yet. Submit a customer request or add a demo request.</p>';
    return;
  }

  jobList.innerHTML = jobs
    .map(
      (job) => `
        <article class="job-card" data-job-id="${job.id}">
          <div class="job-top">
            <div>
              <h3 class="job-title">${escapeHtml(job.service)} · ${escapeHtml(job.name)}</h3>
              <p class="job-subtitle">${formatDate(job.createdAt)}${job.eta ? ` · ETA ${escapeHtml(job.eta)}` : ""}</p>
            </div>
            <span class="job-status ${escapeHtml(job.status)}">${escapeHtml(job.status)}</span>
          </div>

          <div class="job-details">
            <div class="detail"><span>Customer</span><strong>${escapeHtml(job.name)}</strong></div>
            <div class="detail"><span>Phone</span><strong><a href="tel:${escapeHtml(job.phone).replace(/\\D/g, "")}">${escapeHtml(job.phone)}</a></strong></div>
            <div class="detail"><span>Vehicle</span><strong>${escapeHtml(job.make)} ${escapeHtml(job.model)}</strong></div>
            <div class="detail"><span>Tire size</span><strong>${escapeHtml(job.tireSize)}</strong></div>
            <div class="detail"><span>Location</span><strong>${escapeHtml(job.location)}</strong></div>
            <div class="detail"><span>Photo</span><strong>${escapeHtml(job.photoName || "No photo uploaded")}</strong></div>
          </div>

          <div class="job-notes">
            <span>Notes</span>
            <strong>${escapeHtml(job.notes || "No notes provided")}</strong>
          </div>

          ${
            job.photoData
              ? `<img class="job-photo" src="${job.photoData}" alt="Uploaded customer photo for ${escapeHtml(job.service)}" />`
              : ""
          }

          <div class="eta-row">
            <input type="text" value="${escapeHtml(job.eta)}" placeholder="Set ETA, ex: 25 minutes" data-eta-input />
            <button class="neutral" type="button" data-action="eta">Update ETA</button>
          </div>

          <div class="job-actions">
            <button class="accept" type="button" data-action="accept">Accept job</button>
            <button class="decline" type="button" data-action="decline">Decline</button>
            <button class="complete" type="button" data-action="complete">Mark complete</button>
            <a class="action-button neutral" href="tel:${escapeHtml(job.phone).replace(/\\D/g, "")}">Call customer</a>
          </div>
        </article>
      `
    )
    .join("");
}

serviceButtons.forEach((button) => {
  button.addEventListener("click", () => {
    setSelectedService(button.dataset.service, button);
  });
});

viewButtons.forEach((button) => {
  button.addEventListener("click", () => {
    setView(button.dataset.viewButton);
  });
});

requestForm?.addEventListener("submit", async (event) => {
  event.preventDefault();

  const formData = new FormData(requestForm);
  const photo = formData.get("photo");
  const data = {
    name: formData.get("name"),
    phone: formData.get("phone"),
    make: formData.get("make"),
    model: formData.get("model"),
    tireSize: formData.get("tireSize"),
    service: formData.get("service"),
    location: formData.get("location"),
    photoName: photo?.name || "",
    photoData: await readPhoto(photo),
    notes: formData.get("notes"),
  };

  addJob(data);
  requestForm.reset();
  setSelectedService("Tire replacement");
  formMessage.textContent = "Request submitted. A1 Mobile Tire Service has the job details ready in the admin dashboard.";
});

jobList?.addEventListener("click", (event) => {
  const actionButton = event.target.closest("[data-action]");
  if (!actionButton) return;

  const jobCard = actionButton.closest("[data-job-id]");
  const jobId = jobCard.dataset.jobId;
  const action = actionButton.dataset.action;

  if (action === "accept") updateJob(jobId, { status: "accepted" });
  if (action === "decline") updateJob(jobId, { status: "declined" });
  if (action === "complete") updateJob(jobId, { status: "complete" });
  if (action === "eta") {
    const eta = jobCard.querySelector("[data-eta-input]").value.trim();
    updateJob(jobId, { eta });
  }
});

seedJobButton?.addEventListener("click", () => {
  addJob(sampleJob);
});

if (document.querySelector('[data-view="admin"]') && !document.querySelector('[data-view="customer"]')) {
  setView("admin");
} else if (document.querySelector('[data-view="admin"]') && window.location.hash === "#admin") {
  setView("admin");
} else {
  setView("customer");
}

renderJobs();
