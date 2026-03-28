const API = "/api/plan";
const ICON_PATH = "/static/icons";

const goalInput = document.getElementById("goal");
const unitSelect = document.getElementById("unit");
const generateBtn = document.getElementById("generate");
const pacesEl = document.getElementById("paces");
const pacesSectionEl = document.getElementById("paces-section");
const planEl = document.getElementById("plan");
const disclaimerEl = document.getElementById("disclaimer");
const mileageSectionEl = document.getElementById("mileage-section");
const mileageChartEl = document.getElementById("mileage-chart");

const DAYS_SHORT = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

// -- Disclaimers --

function goalToSeconds(goal) {
  const parts = goal.split(":").map(Number);
  if (parts.length === 3) return parts[0] * 3600 + parts[1] * 60 + parts[2];
  if (parts.length === 2) return parts[0] * 60 + parts[1];
  return 0;
}

function getDisclaimer(goal) {
  const secs = goalToSeconds(goal);
  if (secs <= 0) return null;

  const hours = secs / 3600;

  if (hours < 2.5) {
    return {
      tone: "spicy",
      text: "<strong>Sub 2:30? OK, Kipchoge.</strong> This is elite-level territory — we're talking years of high-mileage training, peak weeks around 95 miles, a VO2max that would impress a lab tech, and a pain tolerance that borders on spiritual. If you're not already comfortably running 80+ mile weeks, maybe add a few minutes to that goal. Just a thought.",
    };
  }
  if (hours < 2.75) {
    return {
      tone: "spicy",
      text: "<strong>Sub 2:45 is seriously fast.</strong> This plan peaks around 90 mile weeks. You'll need a well-tuned fueling strategy and the kind of discipline that makes your friends worry about you. If you can already run a 1:18 half in your sleep, carry on. Otherwise, no shame in dialing it back a notch.",
    };
  }
  if (hours < 3) {
    return {
      tone: "spicy",
      text: "<strong>Sub-3 — the white whale of recreational marathoning.</strong> You're looking at peak weeks in the mid-80s. This takes real commitment: structured speedwork, long runs that eat your Saturday mornings, and the willingness to become the person who talks about \"easy pace\" at dinner parties. You've been warned.",
    };
  }
  if (hours < 3.25) {
    return {
      tone: "warm",
      text: "<strong>Sub-3:15 is no joke.</strong> You're faster than ~95% of marathon finishers. Peak weeks will hit the low 80s — this needs a solid training block, smart pacing, and a healthy respect for the wall at mile 20.",
    };
  }
  if (hours < 3.5) {
    return {
      tone: "warm",
      text: "<strong>A solid, ambitious goal.</strong> Peak weeks around 75–80 miles. You'll want a good base behind you and a healthy respect for the taper. The hay is in the barn — trust the process and don't do anything weird on race week.",
    };
  }
  if (hours < 4) {
    return {
      tone: "chill",
      text: "<strong>Very achievable with consistent training.</strong> Peak mileage lands around 70–75 miles per week. Show up, do the work, and race day will take care of itself. The biggest risk is going out too fast — trust these paces.",
    };
  }
  return {
    tone: "chill",
    text: "<strong>Every finish line is a victory lap.</strong> Peak weeks around 70 miles. Train smart, stay consistent, and enjoy the journey. The marathon doesn't care about your pace — it only cares that you finish.",
  };
}

function renderDisclaimer(goal) {
  const d = getDisclaimer(goal);
  if (!d) {
    disclaimerEl.innerHTML = "";
    return;
  }
  disclaimerEl.innerHTML = `<div class="disclaimer-card ${d.tone}">${d.text}</div>`;
}

// -- Mileage chart --

function renderMileageChart(mileage, unit) {
  const maxMileage = Math.max(...mileage.map((w) => w.mileage));
  const unitLabel = unit === "mi" ? "mi" : "km";

  const phaseColor = {
    Build: "var(--green)",
    Peak: "var(--accent)",
    Taper: "var(--sand)",
  };

  mileageChartEl.innerHTML = mileage
    .map((w) => {
      const pct = Math.round((w.mileage / maxMileage) * 100);
      const color = phaseColor[w.phase] || "var(--text-muted)";
      return `
        <div class="chart-bar-group">
          <div class="chart-value">${w.mileage}</div>
          <div class="chart-bar-area">
            <div class="chart-bar" style="height:${pct}%; background:${color}"></div>
          </div>
          <div class="chart-label">W${w.week}</div>
        </div>`;
    })
    .join("");

  mileageSectionEl.style.display = "block";
}

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
  pacesSectionEl.style.display = "none";
  mileageSectionEl.style.display = "none";

  renderDisclaimer(goal);

  try {
    const resp = await fetch(`${API}?goal=${encodeURIComponent(goal)}&unit=${unit}`);
    if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
    const data = await resp.json();
    renderPaces(data.paces);
    pacesSectionEl.style.display = "block";
    if (data.mileage) renderMileageChart(data.mileage, unit);
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
  const iconNames = [...new Set(workouts.map((w) => w.icon))];
  await Promise.all(iconNames.map(loadIcon));

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
