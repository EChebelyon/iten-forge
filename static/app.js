const API = "/api/plan";
const ICON_PATH = "/static/icons";

const goalInput = document.getElementById("goal");
const unitSelect = document.getElementById("unit");
const generateBtn = document.getElementById("generate");
const pacesEl = document.getElementById("paces");
const planEl = document.getElementById("plan");

const DAYS_SHORT = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

// -- Icon cache --

const iconCache = {};

async function loadIcon(name) {
  if (iconCache[name]) return iconCache[name];
  try {
    const resp = await fetch(`${ICON_PATH}/${name}.svg`);
    if (!resp.ok) return "";
    const svg = await resp.text();
    iconCache[name] = svg;
    return svg;
  } catch {
    return "";
  }
}

// -- Fetch plan --

async function fetchPlan() {
  const goal = goalInput.value.trim();
  const unit = unitSelect.value;

  planEl.innerHTML = '<div class="loading">Loading plan...</div>';
  pacesEl.innerHTML = "";

  try {
    const resp = await fetch(`${API}?goal=${encodeURIComponent(goal)}&unit=${unit}`);
    if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
    const data = await resp.json();
    renderPaces(data.paces);
    await renderPlan(data.workouts);
  } catch (err) {
    planEl.innerHTML = `<div class="loading">Failed to load plan: ${err.message}</div>`;
  }
}

// -- Render pace zones --

function renderPaces(paces) {
  const zones = ["easy", "recovery", "marathon", "tempo", "threshold", "5k"];
  pacesEl.innerHTML = zones
    .map(
      (z) => `
    <div class="pace-zone">
      <span class="zone-label">${z}</span>
      <span class="zone-value">${paces[z]}</span>
    </div>`
    )
    .join("");
}

// -- Render plan --

async function renderPlan(workouts) {
  // Preload all icons
  const iconNames = [...new Set(workouts.map((w) => w.icon))];
  await Promise.all(iconNames.map(loadIcon));

  // Group by week
  const weeks = {};
  for (const w of workouts) {
    if (!weeks[w.week]) weeks[w.week] = { phase: w.phase, days: [] };
    weeks[w.week].days.push(w);
  }

  let html = "";
  for (const [weekNum, week] of Object.entries(weeks)) {
    const phaseClass = `phase-${week.phase.toLowerCase()}`;
    const isFirst = weekNum === "1";

    html += `
    <div class="week${isFirst ? " open" : ""}" data-week="${weekNum}">
      <div class="week-header" onclick="toggleWeek(this)">
        <span class="week-number">W${weekNum}</span>
        <span class="week-title">Week ${weekNum}</span>
        <span class="week-phase ${phaseClass}">${week.phase}</span>
        <span class="week-toggle">&#9654;</span>
      </div>
      <div class="week-days">
        <div class="days-grid">
          ${week.days.map((d, i) => dayCard(d, i, weekNum)).join("")}
        </div>
        <div class="workout-detail" id="detail-${weekNum}"></div>
      </div>
    </div>`;
  }

  planEl.innerHTML = html;

  // Auto-show first day of week 1
  const firstCard = planEl.querySelector('.day-card[data-week="1"]');
  if (firstCard) showDetail(firstCard, workouts[0]);
}

function dayCard(workout, dayIndex, weekNum) {
  const svg = iconCache[workout.icon] || "";
  return `
    <div class="day-card"
         data-week="${weekNum}"
         data-day="${dayIndex}"
         onclick='selectDay(this, ${JSON.stringify(workout).replace(/'/g, "&#39;")})'>
      <span class="day-label">${DAYS_SHORT[dayIndex]}</span>
      <span class="day-icon">${svg}</span>
      <span class="day-title">${workout.title}</span>
      <span class="day-duration">${workout.duration}</span>
    </div>`;
}

// -- Interactions --

function toggleWeek(header) {
  header.parentElement.classList.toggle("open");
}

function selectDay(card, workout) {
  // Deactivate siblings
  const grid = card.parentElement;
  grid.querySelectorAll(".day-card").forEach((c) => c.classList.remove("active"));
  card.classList.add("active");
  showDetail(card, workout);
}

function showDetail(card, workout) {
  const weekNum = card.dataset.week;
  const detailEl = document.getElementById(`detail-${weekNum}`);

  let garminHtml = "";
  if (workout.garmin_steps && workout.garmin_steps.length > 0) {
    garminHtml = `
      <div class="detail-section">
        <div class="detail-label">Garmin Steps</div>
        <div class="garmin-steps">
          ${workout.garmin_steps.map((s) => garminStep(s)).join("")}
        </div>
      </div>`;
  }

  let eveningHtml = "";
  if (workout.evening) {
    const ev = workout.evening;
    eveningHtml = `
      <div class="detail-evening">
        <div class="detail-label">${ev.title} / ${ev.duration}</div>
        <div class="detail-text">${ev.description}</div>
      </div>`;
  }

  detailEl.innerHTML = `
    <div class="detail-title">${workout.title} &mdash; ${workout.duration}</div>
    <div class="detail-summary">${workout.summary}</div>
    <div class="detail-section">
      <div class="detail-label">Details</div>
      <div class="detail-text">${workout.details}</div>
    </div>
    ${garminHtml}
    ${eveningHtml}
  `;
  detailEl.classList.add("visible");
}

function garminStep(step) {
  const cls = `step-${step.type}`;
  let label = step.type;

  if (step.duration_min) label += ` ${step.duration_min}m`;
  else if (step.duration_sec) label += ` ${step.duration_sec}s`;
  else if (step.distance_m) label += ` ${step.distance_m}m`;
  else if (step.distance_km) label += ` ${step.distance_km}km`;

  if (step.target) label += ` @ ${step.target}`;
  return `<span class="garmin-step ${cls}">${label}</span>`;
}

// -- Init --

generateBtn.addEventListener("click", fetchPlan);
goalInput.addEventListener("keydown", (e) => {
  if (e.key === "Enter") fetchPlan();
});

fetchPlan();
