// Concert Companion App (Screenplay mode)
// - Audience selects Mood + Setting
// - Optional short note (comment)
// - Responses stored locally (prototype)
// - Visualization via Chart.js
// - Background glow changes based on selected mood
// - Safe handling if Chart.js fails to load
// - Resets selections after submit 

const MOODS = [
  "Happy", "Relaxed", "Melancholy", "Excited",
  "Calm", "Tense", "Awe", "Reflective"
];

const SETTINGS = [
  "A Rainy City",
  "A Deep Forest",
  "An Interior Memory",
  "A Desert Road",
  "A Quiet Beach at Night",
  "A Crowded Train Station",
  "A Snowy Mountain Pass",
  "A Sunlit Kitchen"
];

// Mood-based glow colors
const MOOD_GLOWS = {
  "Happy": "rgba(255, 230, 150, .25)",
  "Relaxed": "rgba(150, 255, 220, .20)",
  "Melancholy": "rgba(170, 160, 255, .22)",
  "Excited": "rgba(255, 160, 160, .22)",
  "Calm": "rgba(160, 210, 255, .20)",
  "Tense": "rgba(255, 180, 120, .22)",
  "Awe": "rgba(180, 255, 240, .22)",
  "Reflective": "rgba(210, 190, 255, .22)"
};

const DEFAULT_GLOW = "rgba(139,220,255,.20)";

// Storage keys (local prototype)
const RESPONSES_KEY = "concertResponses";
const EMAILS_KEY = "concertEmails";

let selectedMood = "";
let selectedSetting = "";

// IDs from your HTML
const moodButtonsWrap = document.getElementById("emotionButtons");
const settingButtonsWrap = document.getElementById("storyButtons");

const commentEl = document.getElementById("comment");
const charHintEl = document.getElementById("charHint");
const successMsgEl = document.getElementById("successMsg");

const optInEl = document.getElementById("optIn");
const emailRowEl = document.getElementById("emailRow");
const emailEl = document.getElementById("email");
const emailMsgEl = document.getElementById("emailMsg");

const refreshBtn = document.getElementById("refreshCharts");
const exportBtn = document.getElementById("exportCSV");
const clearBtn = document.getElementById("clearLocal");
const exportMsgEl = document.getElementById("exportMsg");

const submitBtn = document.getElementById("submitResponse");
const saveEmailBtn = document.getElementById("saveEmail");

let moodChart = null;
let settingChart = null;

// Friendly console warning if Chart.js doesn't load
if (typeof Chart === "undefined") {
  console.warn("Chart.js is not loaded. Charts will not render.");
}

// ---------- Helpers ----------
function createPill(label, group) {
  const btn = document.createElement("button");
  btn.type = "button";
  btn.className = "pill";
  btn.textContent = label;

  btn.addEventListener("click", () => {
    if (group === "mood") {
      selectedMood = label;
      setActivePill(moodButtonsWrap, label);

      // Update mood glow
      document.documentElement.style.setProperty("--moodGlow", MOOD_GLOWS[label] || DEFAULT_GLOW);
    } else {
      selectedSetting = label;
      setActivePill(settingButtonsWrap, label);
    }
  });

  return btn;
}

function setActivePill(container, label) {
  const pills = container.querySelectorAll(".pill");
  pills.forEach(p => p.classList.remove("active"));
  if (!label) return;

  const active = Array.from(pills).find(p => p.textContent === label);
  if (active) active.classList.add("active");
}

function loadJSON(key, fallback) {
  try {
    return JSON.parse(localStorage.getItem(key)) ?? fallback;
  } catch {
    return fallback;
  }
}

function saveJSON(key, data) {
  localStorage.setItem(key, JSON.stringify(data));
}

function getResponses() {
  return loadJSON(RESPONSES_KEY, []);
}

function addResponse(response) {
  const responses = getResponses();
  responses.push(response);
  saveJSON(RESPONSES_KEY, responses);
}

function getEmails() {
  return loadJSON(EMAILS_KEY, []);
}

function addEmail(emailRecord) {
  const emails = getEmails();
  emails.push(emailRecord);
  saveJSON(EMAILS_KEY, emails);
}

function getSessionId() {
  const k = "concertSessionId";
  let id = localStorage.getItem(k);
  if (!id) {
    id = crypto?.randomUUID ? crypto.randomUUID() : `sess_${Math.random().toString(16).slice(2)}`;
    localStorage.setItem(k, id);
  }
  return id;
}

function setMessage(el, msg, isError = false) {
  if (!el) return;
  el.textContent = msg;
  el.classList.toggle("error", isError);
}

// ---------- Render buttons ----------
function renderButtons() {
  moodButtonsWrap.innerHTML = "";
  settingButtonsWrap.innerHTML = "";

  MOODS.forEach(m => moodButtonsWrap.appendChild(createPill(m, "mood")));
  SETTINGS.forEach(s => settingButtonsWrap.appendChild(createPill(s, "setting")));
}

// ---------- Submit ----------
submitBtn.addEventListener("click", () => {
  setMessage(successMsgEl, "", false);

  if (!selectedMood || !selectedSetting) {
    setMessage(successMsgEl, "Please choose a mood and a setting.", true);
    return;
  }

  const response = {
    id: crypto?.randomUUID ? crypto.randomUUID() : `r_${Date.now()}_${Math.random().toString(16).slice(2)}`,
    timestamp: new Date().toISOString(),
    mood: selectedMood,
    setting: selectedSetting,
    note: (commentEl.value || "").trim(),
    sessionId: getSessionId()
  };

  addResponse(response);

  setMessage(successMsgEl, "Added to the script — thank you.", false);

  // Reset note + counter
  commentEl.value = "";
  charHintEl.textContent = "0 / 140";

  // Reset selections + glow (clean UX)
  selectedMood = "";
  selectedSetting = "";
  setActivePill(moodButtonsWrap, "");
  setActivePill(settingButtonsWrap, "");
  document.documentElement.style.setProperty("--moodGlow", DEFAULT_GLOW);

  renderCharts();
});

// ---------- Character counter ----------
commentEl.addEventListener("input", () => {
  const len = commentEl.value.length;
  charHintEl.textContent = `${len} / 140`;
});

// ---------- Email opt-in ----------
optInEl.addEventListener("change", () => {
  emailRowEl.style.display = optInEl.checked ? "flex" : "none";
  setMessage(emailMsgEl, "", false);
});

saveEmailBtn.addEventListener("click", () => {
  setMessage(emailMsgEl, "", false);

  if (!optInEl.checked) return;

  const email = (emailEl.value || "").trim();
  if (!email) {
    setMessage(emailMsgEl, "Please enter an email address.", true);
    return;
  }

  const ok = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
  if (!ok) {
    setMessage(emailMsgEl, "That email address doesn’t look valid.", true);
    return;
  }

  addEmail({
    email,
    consent: true,
    timestamp: new Date().toISOString(),
    event: "Markus Gottschlich Concert"
  });

  setMessage(emailMsgEl, "Saved — we’ll send highlights after the show.", false);
  emailEl.value = "";
});

// ---------- Charts ----------
function countByKey(data, key, orderedLabels) {
  const counts = {};
  orderedLabels.forEach(l => (counts[l] = 0));

  data.forEach(item => {
    const v = item[key];
    if (counts[v] !== undefined) counts[v] += 1;
    else counts[v] = 1;
  });

  return counts;
}

function renderCharts() {
  // If Chart.js failed to load, quietly skip chart rendering
  if (typeof Chart === "undefined") {
    setMessage(exportMsgEl, "Charts unavailable (Chart.js did not load).", true);
    return;
  }

  const responses = getResponses();

  const moodCounts = countByKey(responses, "mood", MOODS);
  const settingCounts = countByKey(responses, "setting", SETTINGS);

  const moodLabels = Object.keys(moodCounts);
  const moodValues = Object.values(moodCounts);

  const settingLabels = Object.keys(settingCounts);
  const settingValues = Object.values(settingCounts);

  const moodCanvas = document.getElementById("emotionChart");
  const settingCanvas = document.getElementById("storyChart");

  if (!moodCanvas || !settingCanvas) return;

  const moodCtx = moodCanvas.getContext("2d");
  const settingCtx = settingCanvas.getContext("2d");

  if (moodChart) moodChart.destroy();
  if (settingChart) settingChart.destroy();

  moodChart = new Chart(moodCtx, {
    type: "bar",
    data: {
      labels: moodLabels,
      datasets: [{ label: "Count", data: moodValues }]
    },
    options: {
      responsive: true,
      plugins: { legend: { display: false } },
      scales: {
        y: { beginAtZero: true, ticks: { precision: 0 } },
        x: { ticks: { maxRotation: 0, minRotation: 0 } }
      }
    }
  });

  settingChart = new Chart(settingCtx, {
    type: "bar",
    data: {
      labels: settingLabels,
      datasets: [{ label: "Count", data: settingValues }]
    },
    options: {
      responsive: true,
      plugins: { legend: { display: false } },
      scales: {
        y: { beginAtZero: true, ticks: { precision: 0 } },
        x: { ticks: { autoSkip: true, maxRotation: 0, minRotation: 0 } }
      }
    }
  });
}

refreshBtn.addEventListener("click", renderCharts);

// ---------- Export CSV ----------
function toCSV(rows) {
  if (!rows.length) return "";

  const headers = Object.keys(rows[0]);
  const escape = (v) => {
    const s = String(v ?? "");
    if (/[",\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
    return s;
  };

  const lines = [
    headers.join(","),
    ...rows.map(r => headers.map(h => escape(r[h])).join(","))
  ];

  return lines.join("\n");
}

exportBtn.addEventListener("click", () => {
  setMessage(exportMsgEl, "", false);

  const responses = getResponses();
  if (!responses.length) {
    setMessage(exportMsgEl, "No responses to export yet.", true);
    return;
  }

  const csv = toCSV(responses);
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);

  const a = document.createElement("a");
  a.href = url;
  a.download = "concert_script_responses.csv";
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);

  URL.revokeObjectURL(url);

  setMessage(exportMsgEl, "Exported CSV.", false);
});

// ---------- Clear local data ----------
clearBtn.addEventListener("click", () => {
  const ok = confirm("Clear local responses and emails on this device?");
  if (!ok) return;

  localStorage.removeItem(RESPONSES_KEY);
  localStorage.removeItem(EMAILS_KEY);

  setMessage(exportMsgEl, "Local data cleared.", false);
  renderCharts();
});

// ---------- Init ----------
renderButtons();
renderCharts();
document.documentElement.style.setProperty("--moodGlow", DEFAULT_GLOW);