const API = "/api/plan";
const ICON_PATH = "/static/icons";

const goalH = document.getElementById("goal-h");
const goalM = document.getElementById("goal-m");
const goalS = document.getElementById("goal-s");
const unitSelect = document.getElementById("unit");
const generateBtn = document.getElementById("generate");
const distanceToggle = document.getElementById("distance-toggle");
const headerBadge = document.getElementById("header-badge");
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

let currentDistance = "marathon";

const DISTANCE_CONFIG = {
  "5k": { badge: "5 km", wr: 12 * 60 + 35, hourMin: 0 },
  "10k": { badge: "10 km", wr: 26 * 60 + 11, hourMin: 0 },
  half: { badge: "21.0975 km", wr: 57 * 60 + 31, hourMin: 0 },
  marathon: { badge: "42.195 km", wr: 2 * 3600 + 0 * 60 + 40, hourMin: 2 },
};

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

  const cfg = DISTANCE_CONFIG[currentDistance];

  // Below world record
  if (secs < cfg.wr) {
    const wrMsgs = {
      "5k": "<strong>Hold on.</strong> That's faster than Joshua Cheptegei's world record (12:35, Monaco 2020). Unless you've been doing altitude training with the PACE Sports Management camp in Kaptagat, we're going to need a few more seconds on that.",
      "10k": "<strong>Hold on.</strong> That's faster than Joshua Cheptegei's world record (26:11, Valencia 2020). You'd need to run every single kilometre in 2:37. That's not a training plan, that's a physics experiment. Add a minute or two.",
      half: "<strong>Hold on.</strong> That's faster than the world record (57:31, Kibiwott Kandie, Valencia 2020). Unless you've been secretly training at 2,400m altitude in Iten and your VO2max has its own Wikipedia page, we're going to need you to add a few minutes.",
      marathon: "<strong>Hold on.</strong> That's faster than the world record (2:00:40, Kelvin Kiptum, Chicago 2023). Unless you're a time traveller from a future where humans have extra tendons, we're going to need you to add a few minutes. We believe in you — just not <em>that</em> much.",
    };
    return { tone: "spicy", text: wrMsgs[currentDistance] };
  }

  const disclaimerFns = { "5k": get5kDisclaimer, "10k": get10kDisclaimer, half: getHalfDisclaimer, marathon: getMarathonDisclaimer };
  return disclaimerFns[currentDistance](secs);
}

function getMarathonDisclaimer(secs) {
  const hours = secs / 3600;

  if (hours < 2 + 5 / 60) {
    const msgs = [
      "<strong>Sub 2:05? Sure, and I'm Eliud Kipchoge's pacemaker.</strong> There are maybe 15 people alive who can do this, and they all live at altitude, eat ugali three times a day, and haven't sat in an office chair since 2007. But hey — if you've got a VO2max north of 85 and your resting heart rate is \"basically dead,\" who are we to judge? Let's see those paces.",
      "<strong>Are you... are you Kelvin Kiptum?</strong> Because sub-2:05 is not a goal, it's a press conference. You'd need to average under 4:44/mi for 26.2 miles. Most people can't hold that pace for a single mile. On a bike. Downhill. But if you insist, we'll crunch the numbers. Just know the math is judging you.",
      "<strong>We ran the numbers. The numbers ran away.</strong> Sub-2:05 puts you in a group so small they could share a matatu in Eldoret. This isn't a training plan, it's a scientific experiment. You'll need to run every interval like a cheetah who's late for a meeting. We'll generate the paces, but we're doing it with one eyebrow raised.",
    ];
    return { tone: "spicy", text: msgs[Math.floor(Math.random() * msgs.length)] };
  }
  if (hours >= 3.5) return null;
  if (hours < 2.5) {
    return { tone: "spicy", text: "<strong>Sub 2:30? OK, Kipchoge.</strong> This is elite-level territory — we're talking years of high-mileage training, peak weeks around 95 miles, a VO2max that would impress a lab tech, and a pain tolerance that borders on spiritual. If you're not already comfortably running 80+ mile weeks, maybe add a few minutes to that goal. Just a thought." };
  }
  if (hours < 2.75) {
    return { tone: "spicy", text: "<strong>Sub 2:45 is seriously fast.</strong> This plan peaks around 90 mile weeks. You'll need a well-tuned fueling strategy and the kind of discipline that makes your friends worry about you. If you can already run a 1:18 half in your sleep, carry on. Otherwise, no shame in dialing it back a notch." };
  }
  if (hours < 3) {
    return { tone: "spicy", text: "<strong>Sub-3 — the white whale of recreational marathoning.</strong> You're looking at peak weeks in the mid-80s. This takes real commitment: structured speedwork, long runs that eat your Saturday mornings, and the willingness to become the person who talks about \"easy pace\" at dinner parties. You've been warned." };
  }
  if (hours < 3.25) {
    return { tone: "warm", text: "<strong>Sub-3:15 is no joke.</strong> You're faster than ~95% of marathon finishers. Peak weeks will hit the low 80s — this needs a solid training block, smart pacing, and a healthy respect for the wall at mile 20." };
  }
  return { tone: "warm", text: "<strong>You're entering competitive territory.</strong> Sub-3:30 unlocks the full program — track intervals, tempo runs, fartlek sessions, and PM doubles. Peak weeks push into the 70–80 mile range. This is a serious training block built for experienced runners. If that sounds like you, let's go." };
}

function getHalfDisclaimer(secs) {
  const mins = secs / 60;

  if (mins < 60) {
    const msgs = [
      "<strong>Sub-60? You absolute legend.</strong> That's a pace most people can't hold for a single kilometre, sustained for 21 of them. You'd be rubbing shoulders with the Kenyans at the front of the pack. If your 10K PR starts with a 2, maybe. Otherwise, we're just impressed you typed this with a straight face.",
      "<strong>Under an hour for a half marathon.</strong> That's Faith Kipyegon territory — and she runs the 1500m. You'd need to hold ~4:33/mi for 13.1 miles without blinking. We'll generate the paces, but know that the calculator is giving you side-eye.",
      "<strong>We checked the math. The math checked itself into therapy.</strong> Sub-60 for a half marathon puts you among maybe 50 people on the planet. If you're one of them, you don't need this website. If you're not, maybe add 15 minutes and join the rest of us mortals.",
    ];
    return { tone: "spicy", text: msgs[Math.floor(Math.random() * msgs.length)] };
  }
  if (mins >= 95) return null; // 1:35+ is just finish, no disclaimer
  if (mins < 75) {
    return { tone: "spicy", text: "<strong>Sub-1:15 is elite-level half marathon running.</strong> You're looking at 5:43/mi pace for 13.1 miles — peak weeks around 60–65 miles with serious speedwork. If your 5K PR is comfortably under 17 minutes, you belong here. Otherwise, this plan will humble you before it helps you." };
  }
  if (mins < 85) {
    return { tone: "warm", text: "<strong>Sub-1:25 is seriously fast.</strong> You'll need a strong speed base and the discipline to hold pace when your legs start negotiating. Peak weeks hit 55–60 miles. This is a proper competitive block." };
  }
  return { tone: "warm", text: "<strong>You're entering competitive territory.</strong> Sub-1:35 unlocks the full program — track intervals, tempo runs, fartlek sessions, and PM doubles. Peak weeks push into the 50–65 mile range. A serious block for serious runners. If that sounds like you, let's go." };
}

function get5kDisclaimer(secs) {
  const mins = secs / 60;

  if (mins < 14) {
    const msgs = [
      "<strong>Sub-14 for a 5K.</strong> You're talking about running each kilometre in under 2:48. That's Cheptegei territory — the man who broke the world record on a track in Monaco while the rest of us were eating croissants. If your 1500m PR starts with a 3, maybe. Otherwise, we admire the audacity.",
      "<strong>Let's be real.</strong> Sub-14 means averaging 4:30/mi for 3.1 miles. There are Olympic finalists who can't do that on a good day. We'll crunch the numbers, but the numbers are laughing.",
      "<strong>You want sub-14?</strong> That puts you in a group small enough to fit in a single matatu from Eldoret to Iten. If you've been training at altitude since birth, sure. If not, add a couple of minutes and save yourself the existential crisis.",
    ];
    return { tone: "spicy", text: msgs[Math.floor(Math.random() * msgs.length)] };
  }
  if (mins >= 20) return null; // 20:00+ is just finish, no disclaimer
  if (mins < 16) {
    return { tone: "spicy", text: "<strong>Sub-16 is elite 5K running.</strong> You're in the top fraction of a percent of runners on earth. This needs years of structured training, a VO2max that makes cardiologists jealous, and the ability to hurt in ways most people reserve for tax season." };
  }
  if (mins < 18) {
    return { tone: "warm", text: "<strong>Sub-18 is seriously competitive.</strong> You'll need a strong aerobic base, disciplined speedwork, and the mental toughness to hold pace when your lungs start filing complaints. Peak weeks around 40–45 miles." };
  }
  return { tone: "warm", text: "<strong>You're entering competitive territory.</strong> Sub-20 unlocks the full program — track intervals, tempo runs, and structured fartlek. Peak weeks around 35–40 miles. This is a real training block. If you're ready, let's go." };
}

function get10kDisclaimer(secs) {
  const mins = secs / 60;

  if (mins < 28) {
    const msgs = [
      "<strong>Sub-28 for a 10K.</strong> That's 2:48/km for 10 kilometres straight. You'd be racing alongside the Kenyans and Ethiopians who grew up running to school at 2,000m altitude. If your 5K PR is under 13:30, we'll take you seriously. Otherwise, the calculator is side-eyeing you pretty hard.",
      "<strong>We admire the confidence.</strong> Sub-28 puts you in the realm of people who have actual shoe sponsorships and personal physios. Cheptegei ran 26:11 — and he's the best in the world. You do the math on how close that is.",
    ];
    return { tone: "spicy", text: msgs[Math.floor(Math.random() * msgs.length)] };
  }
  if (mins >= 42) return null; // 42:00+ is just finish, no disclaimer
  if (mins < 34) {
    return { tone: "spicy", text: "<strong>Sub-34 is elite-level 10K.</strong> Peak weeks hit 50–55 miles with serious interval sessions and tempo work. You'll need a 5K PR well under 17 minutes and the aerobic engine to back it up over double the distance." };
  }
  if (mins < 38) {
    return { tone: "warm", text: "<strong>Sub-38 is strong competitive running.</strong> You'll need consistent mileage, structured speedwork, and the patience to not go out too fast. Peak weeks around 45–50 miles." };
  }
  return { tone: "warm", text: "<strong>You're entering competitive territory.</strong> Sub-42 unlocks the full program — track intervals, tempo runs, and fartlek sessions. Peak weeks around 40–50 miles. A serious block for runners who want to race, not just finish." };
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
  if (secs < DISTANCE_CONFIG[currentDistance].wr) {
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
    const resp = await fetch(`${API}?goal=${encodeURIComponent(goal)}&unit=${unit}&distance=${currentDistance}`);
    if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
    const data = await resp.json();
    lastPlanData = data;
    renderPaces(data.paces);
    pacesSectionEl.style.display = "block";

    const isCompetitive = data.tier === "competitive";
    const hasDoubles = isCompetitive && (currentDistance === "marathon" || currentDistance === "half");
    skipPmLabel.style.display = hasDoubles ? "" : "none";
    noTrackLabel.style.display = isCompetitive ? "" : "none";
    if (!hasDoubles) {
      skipPmCheckbox.checked = false;
      dismissSkipPmMessage();
    }
    if (!isCompetitive) {
      noTrackCheckbox.checked = false;
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
  const zones = ["easy", "recovery", "race", "tempo", "threshold", "5k"];
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

// -- Distance toggle --

distanceToggle.addEventListener("click", (e) => {
  const btn = e.target.closest(".dist-btn");
  if (!btn || btn.classList.contains("active")) return;

  distanceToggle.querySelectorAll(".dist-btn").forEach((b) => b.classList.remove("active"));
  btn.classList.add("active");
  currentDistance = btn.dataset.distance;

  const cfg = DISTANCE_CONFIG[currentDistance];
  headerBadge.textContent = cfg.badge;
  goalH.min = cfg.hourMin;

  // Reset to empty state when switching distances
  resetToEmpty();
});

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
