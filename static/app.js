const API = "/api/plan";
const ICON_PATH = "/static/icons";

const goalH = document.getElementById("goal-h");
const goalM = document.getElementById("goal-m");
const goalS = document.getElementById("goal-s");
const unitSelect = document.getElementById("unit");
const generateBtn = document.getElementById("generate");
const skipPmCheckbox = document.getElementById("skip-pm");
const noTrackCheckbox = document.getElementById("no-track");
const skipPmLabel = skipPmCheckbox.closest(".toggle-label");
const noTrackLabel = noTrackCheckbox.closest(".toggle-label");
const skipPmMessageEl = document.getElementById("skip-pm-message");
const aboutSectionEl = document.getElementById("about-section");
const pacesEl = document.getElementById("paces");
const pacesSectionEl = document.getElementById("paces-section");
const planEl = document.getElementById("plan");
const disclaimerEl = document.getElementById("disclaimer");
const mileageSectionEl = document.getElementById("mileage-section");
const mileageChartEl = document.getElementById("mileage-chart");
const mileageSubtitleEl = document.getElementById("mileage-subtitle");

const WORLD_RECORD_SECS = 2 * 3600 + 0 * 60 + 40; // 2:00:40

const DAYS_SHORT = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

// Stash the last fetched data so the toggle can re-render without refetching
let lastPlanData = null;

// -- Skip PM messages --

const SKIP_PM_MESSAGES = [
  "<strong>Good call.</strong> The elites in Iten who run doubles? That's their full-time job. They wake up, run, nap, eat, run again. No commute, no emails, no bedtime negotiations with a toddler. You have a life — quality over quantity. Take your kids on a bike ride. Grab a smoothie with a friend. Walk on the beach. Those miles you're trading are buying better sleep, real connection, and the kind of emotional health that actually makes you faster.",
  "<strong>Wise move.</strong> In the Kenyan training camps, doubles work because the athletes sleep 10 hours a night and someone else cooks their ugali. You're out here juggling a job, a family, and whatever your inbox did today. Swap the PM run for something that fills your cup — call a friend, cook dinner with your partner, play with your dog. Rested legs and a happy brain will carry you further than 4 extra miles ever could.",
  "<strong>Look at you, choosing life.</strong> Eliud Kipchoge doesn't do his own laundry. The runners in Iten have a support system built for doubles. You are not in Iten. You are a mere mortal with responsibilities and people who like seeing your face. Go be present. Recovery happens in relationships too, and the runners who last decades are the ones who didn't sacrifice every evening at the altar of junk miles.",
  "<strong>Smart.</strong> That PM recovery run was worth maybe 4 miles. You know what's also worth 4 miles? Sitting on a porch doing nothing. Riding bikes with your kids. Going for a walk and actually looking at trees. The Iten elites can absorb doubles because running is literally all they do. For the rest of us, quality beats volume every time. Your aerobic base will survive. Your friendships might not if you keep ditching dinner.",
  "<strong>Permission granted.</strong> Here's a secret the Kenyan coaches won't tell you: the magic isn't in the mileage, it's in the recovery. And recovery isn't just sleep — it's laughing with friends, being outside without a pace target, remembering you're a human who runs, not a runner who occasionally humans. Go live. You're basically training right now.",
];

let skipPmTimer = null;

function dismissSkipPmMessage() {
  if (skipPmTimer) {
    clearTimeout(skipPmTimer);
    skipPmTimer = null;
  }
  const card = skipPmMessageEl.querySelector(".skip-pm-card");
  if (card) {
    card.classList.add("fading");
    card.addEventListener("animationend", () => {
      skipPmMessageEl.innerHTML = "";
    });
  }
}

function renderSkipPmMessage(show) {
  if (skipPmTimer) {
    clearTimeout(skipPmTimer);
    skipPmTimer = null;
  }
  if (!show) {
    skipPmMessageEl.innerHTML = "";
    return;
  }
  const msg = SKIP_PM_MESSAGES[Math.floor(Math.random() * SKIP_PM_MESSAGES.length)];
  skipPmMessageEl.innerHTML = `<div class="skip-pm-card">${msg}<button class="skip-pm-close" onclick="dismissSkipPmMessage()" aria-label="Close">&times;</button></div>`;

  skipPmTimer = setTimeout(() => {
    dismissSkipPmMessage();
  }, 30000);
}

// -- Disclaimers --

function getGoalString() {
  const h = goalH.value.trim();
  const m = goalM.value.trim();
  const s = goalS.value.trim();
  if (!h && !m && !s) return "";
  return `${h || "0"}:${(m || "0").padStart(2, "0")}:${(s || "0").padStart(2, "0")}`;
}

function goalToSeconds(goal) {
  const parts = goal.split(":").map(Number);
  if (parts.length === 3) return parts[0] * 3600 + parts[1] * 60 + parts[2];
  if (parts.length === 2) return parts[0] * 60 + parts[1];
  return 0;
}

function getDisclaimer(secs) {
  if (secs <= 0) return null;

  const hours = secs / 3600;

  // Below world record — you're not Kelvin Kiptum
  if (secs < WORLD_RECORD_SECS) {
    return {
      tone: "spicy",
      text: "<strong>Hold on.</strong> That's faster than the world record (2:00:40, Kelvin Kiptum, Chicago 2023). Unless you're a time traveller from a future where humans have extra tendons, we're going to need you to add a few minutes. We believe in you — just not <em>that</em> much.",
    };
  }

  // Sub-2:05 — comical territory
  if (hours < 2 + 5 / 60) {
    const msgs = [
      "<strong>Sub 2:05? Sure, and I'm Eliud Kipchoge's pacemaker.</strong> There are maybe 15 people alive who can do this, and they all live at altitude, eat ugali three times a day, and haven't sat in an office chair since 2007. But hey — if you've got a VO2max north of 85 and your resting heart rate is \"basically dead,\" who are we to judge? Let's see those paces.",
      "<strong>Are you... are you Kelvin Kiptum?</strong> Because sub-2:05 is not a goal, it's a press conference. You'd need to average under 4:44/mi for 26.2 miles. Most people can't hold that pace for a single mile. On a bike. Downhill. But if you insist, we'll crunch the numbers. Just know the math is judging you.",
      "<strong>We ran the numbers. The numbers ran away.</strong> Sub-2:05 puts you in a group so small they could share a matatu in Eldoret. This isn't a training plan, it's a scientific experiment. You'll need to run every interval like a cheetah who's late for a meeting. We'll generate the paces, but we're doing it with one eyebrow raised.",
    ];
    return {
      tone: "spicy",
      text: msgs[Math.floor(Math.random() * msgs.length)],
    };
  }

  // 3:30+ is the default "Just Finish" plan — no disclaimer needed
  if (hours >= 3.5) return null;

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
  return {
    tone: "warm",
    text: "<strong>You're entering competitive territory.</strong> Sub-3:30 unlocks the full program — track intervals, tempo runs, fartlek sessions, and PM doubles. Peak weeks push into the 70–80 mile range. This is a serious training block built for experienced runners. If that sounds like you, let's go.",
  };
}

function renderDisclaimer(secs) {
  const d = getDisclaimer(secs);
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

function resetToEmpty() {
  lastPlanData = null;
  planEl.innerHTML = '<div class="loading">Enter your goal time above to get started.</div>';
  pacesEl.innerHTML = "";
  pacesSectionEl.style.display = "none";
  mileageSectionEl.style.display = "none";
  disclaimerEl.innerHTML = "";
  aboutSectionEl.style.display = "";
  skipPmLabel.style.display = "none";
  noTrackLabel.style.display = "none";
  skipPmCheckbox.checked = false;
  noTrackCheckbox.checked = false;
  dismissSkipPmMessage();
}

async function fetchPlan() {
  const goal = getGoalString();
  const unit = unitSelect.value;

  if (!goal || goal === "0:00:00") {
    resetToEmpty();
    return;
  }

  const secs = goalToSeconds(goal);

  // Below world record — show disclaimer but don't generate
  if (secs < WORLD_RECORD_SECS) {
    renderDisclaimer(secs);
    lastPlanData = null;
    planEl.innerHTML = "";
    pacesEl.innerHTML = "";
    pacesSectionEl.style.display = "none";
    mileageSectionEl.style.display = "none";
    aboutSectionEl.style.display = "none";
    return;
  }

  planEl.innerHTML = '<div class="loading">Loading plan...</div>';
  pacesEl.innerHTML = "";
  pacesSectionEl.style.display = "none";
  mileageSectionEl.style.display = "none";
  aboutSectionEl.style.display = "none";

  renderDisclaimer(secs);

  try {
    const resp = await fetch(`${API}?goal=${encodeURIComponent(goal)}&unit=${unit}`);
    if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
    const data = await resp.json();
    lastPlanData = data;
    renderPaces(data.paces);
    pacesSectionEl.style.display = "block";

    const isCompetitive = data.tier === "competitive";
    skipPmLabel.style.display = isCompetitive ? "" : "none";
    noTrackLabel.style.display = isCompetitive ? "" : "none";
    if (!isCompetitive) {
      skipPmCheckbox.checked = false;
      noTrackCheckbox.checked = false;
      dismissSkipPmMessage();
    }

    mileageSubtitleEl.textContent = isCompetitive
      ? "Estimated weekly volume across all sessions, including doubles."
      : "Estimated weekly volume. Consistency beats mileage.";

    renderWithPmToggle();
  } catch (err) {
    planEl.innerHTML = `<div class="loading">Failed to load plan: ${err.message}</div>`;
  }
}

function renderWithPmToggle() {
  if (!lastPlanData) return;
  const skipPm = skipPmCheckbox.checked;
  const noTrack = noTrackCheckbox.checked;
  const unit = unitSelect.value;

  let workouts = lastPlanData.workouts;
  if (noTrack) {
    workouts = workouts.map((w) => {
      if (w.alt) {
        return { ...w, icon: w.alt.icon, title: w.alt.title, duration: w.alt.duration, summary: w.alt.summary, details: w.alt.details, garmin_steps: w.alt.garmin_steps };
      }
      return w;
    });
  }
  if (skipPm) {
    workouts = workouts.map((w) => ({ ...w, evening: w.evening?.title?.includes("Recovery") ? null : w.evening }));
  }

  if (lastPlanData.mileage) {
    let mileage = lastPlanData.mileage;
    if (skipPm) {
      // Strip recovery doubles: 3 x 40min sessions at recovery pace
      // Approximate the mileage reduction per week
      const recoveryPaceMinPerUnit = estimateRecoveryPace(lastPlanData.paces);
      const doublesPerWeek = 3;
      const doubleMinutes = 40;
      const doublesDistance = (doublesPerWeek * doubleMinutes) / recoveryPaceMinPerUnit;
      mileage = mileage.map((w, i) => {
        const reduction = (i === 11) ? doublesDistance * (2 / 3) : doublesDistance; // week 12 only has 2
        return { ...w, mileage: Math.round((w.mileage - reduction) * 10) / 10 };
      });
    }
    renderMileageChart(mileage, unit);
  }

  renderPlan(workouts);
}

function estimateRecoveryPace(paces) {
  // Parse recovery pace string like "10:30-11:00/mi" → midpoint in minutes
  const raw = paces.recovery || "";
  const match = raw.match(/(\d+):(\d+)/);
  if (!match) return 11; // fallback
  return parseInt(match[1]) + parseInt(match[2]) / 60;
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

// -- Time input helpers --

function autoAdvance(current, next) {
  current.addEventListener("input", () => {
    const val = current.value;
    if (val.length >= 2 && next) next.focus();
  });
}

autoAdvance(goalH, goalM);
autoAdvance(goalM, goalS);

// Clamp values on blur
[goalH, goalM, goalS].forEach((field) => {
  field.addEventListener("blur", () => {
    const min = parseInt(field.min) || 0;
    const max = parseInt(field.max) || 59;
    let val = parseInt(field.value);
    if (isNaN(val)) { field.value = ""; return; }
    if (val < min) val = min;
    if (val > max) val = max;
    field.value = field === goalH ? val : String(val).padStart(2, "0");
  });
});

// Reactive: if all fields are cleared, reset to empty state
[goalH, goalM, goalS].forEach((field) => {
  field.addEventListener("input", () => {
    if (!goalH.value && !goalM.value && !goalS.value) {
      resetToEmpty();
    }
  });
});

// -- Init --

generateBtn.addEventListener("click", fetchPlan);

[goalH, goalM, goalS].forEach((field) => {
  field.addEventListener("keydown", (e) => {
    if (e.key === "Enter") fetchPlan();
  });
});

skipPmCheckbox.addEventListener("change", () => {
  renderSkipPmMessage(skipPmCheckbox.checked);
  renderWithPmToggle();
});

noTrackCheckbox.addEventListener("change", () => {
  renderWithPmToggle();
});

// Show empty state on load
resetToEmpty();
