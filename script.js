// Concert Companion App
// - Mood (vibe coding) + Narrative selection
// - LocalStorage persistence (easy + reliable for a prototype)
// - Simple visualization (Chart.js)
// - Email opt-in stored separately
// - NEW: background glow changes based on selected vibe

const EMOTIONS = [
  "Happy", "Relaxed", "Melancholy", "Excited",
  "Calm", "Tense", "Awe", "Reflective"
];

const STORIES = [
  "Journey", "Conflict", "Memory", "Loss",
  "Renewal", "Wonder", "Resilience", "Uncertainty"
];

// NEW: mood-based glow colors
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

// Keys for local storage
const RESPONSES_KEY = "concertResponses";
const EMAILS_KEY = "concertEmails";

let selectedEmotion = "";
let selectedStory = "";

const emotionButtonsWrap = document.getElementById("emotionButtons");
const storyButtonsWrap = document.getElementById("storyButtons");

const segmentEl = document.getElementById("segment");
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

let emotionChart = null;
let storyChart = null;

// ---------- UI helpers ----------
function createPill(label, group) {
  const btn = document.createElement("button");
  btn.type = "button";
  btn.className = "pill";
  btn.textContent = label;

  btn.addEventListener("click", () => {
    if (group === "emotion") {
      selectedEmotion = label;
      setActivePill(emotionButtonsWrap, label);

      // NEW: update mood glow based on selected vibe
      document.documentElement.style.setProperty(
        "--moodGlow",
        MOOD_GLOWS[label] || "rgba(139,220,255,.20)"
      );

    } else {
      selectedStory = label;
      setActivePill(storyButtonsWrap, label);
    }
  });

  return btn;
}

function setActivePill(container, label) {
  const pills = container.querySelectorAll(".pill");
  pills.forEach(p => p.classList.remove("active"));
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

// ---------- Build buttons ----------
function renderButtons() {
  emotionButtonsWrap.innerHTML = "";
  storyButtonsWrap.innerHTML = "";

  EMOTIONS.forEach(e => emotionButtonsWrap.appendChild(createPill(e, "emotion")));
  STORIES.forEach(s => storyButtonsWrap.appendChild(createPill(s, "story")));
}

// ---------- Response storage ----------
function getResponses() {
  return loadJSON(RESPONSES_KEY, []);
}

function addResponse(response) {
  const responses = getResponses();
  responses.push(response);
  saveJSON(RESPONSES_KEY, responses);
}

// Separate storage for emails (opt-in only)
function getEmails() {
  return loadJSON(EMAILS_KEY, []);
}

function addEmail(emailRecord) {
  const emails = getEmails();
  emails.push(emailRecord);
  saveJSON(EMAILS_KEY, emails);
}

// Create an anonymous session id (stored locally)
function getSessionId() {
  const k = "concertSessionId";
  let id = localStorage.getItem(k);
  if (!id) {
    id = crypto?.randomUUID ? crypto.randomUUID() : `sess_${Math.random().toString(16).slice(2)}`;
    localStorage.setItem(k, id);
  }
  return id;
}

// ---------- Submit logic ----------
document.getElementById("submitResponse").addEventListener("click", () => {
  successMsgEl.textContent = "";

  if (!selectedEmotion || !selectedStory) {
    successMsgEl.style.color = "#ffd1d1";
    successMsgEl.textContent = "Please select both a vibe and a story.";
    return;
  }

  const response = {
    id: crypto?.randomUUID ? crypto.randomUUID() : `r_${Date.now()}_${Math.random().toString(16).slice(2)}`,
    timestamp: new Date().toISOString(),
    emotion: selectedEmotion,
    story: selectedStory,
    segment: segmentEl.value || "",
    comment: (commentEl.value || "").trim(),
    sessionId: getSessionId()
  };

  addResponse(response);

  successMsgEl.style.color = "rgba(242,243,245,0.95)";
  successMsgEl.textContent = "Thanks! Your response was saved.";

  // Reset only comment (keep selections in case they want to submit again)
  commentEl.value = "";
  charHintEl.textContent = "0 / 140";

  renderCharts();
});

// ---------- Comment character counter ----------
commentEl.addEventListener("input", () => {
  const len = commentEl.value.length;
  charHintEl.textContent = `${len} / 140`;
});

// ---------- Email opt-in ----------
optInEl.addEventListener("change", () => {
  emailRowEl.style.display = optInEl.checked ? "flex" : "none";
  emailMsgEl.textContent = "";
});

document.getElementById("saveEmail").addEventListener("click", () => {
  emailMsgEl.textContent = "";

  if (!optInEl.checked) return;

  const email = (emailEl.value || "").trim();
  if (!email) {
    emailMsgEl.style.color = "#ffd1d1";
    emailMsgEl.textContent = "Please enter an email address.";
    return;
  }

  // Basic email pattern check
  const ok = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
  if (!ok) {
    emailMsgEl.style.color = "#ffd1d1";
    emailMsgEl.textContent = "That email address doesn’t look valid.";
    return;
  }

  addEmail({
    email,
    consent: true,
    timestamp: new Date().toISOString(),
    event: "Markus Gottschlich Concert"
  });

  emailMsgEl.style.color = "rgba(242,243,245,0.95)";
  emailMsgEl.textContent = "Saved — thank you!";

  emailEl.value = "";
});

// ---------- Visualization ----------
function countByField(data, field, orderedLabels) {
  const counts = {};
  orderedLabels.forEach(l => (counts[l] = 0));
  data.forEach(item => {
    const v = item[field];
    if (counts[v] !== undefined) counts[v] += 1;
    else counts[v] = 1;
  });
  return counts;
}

function renderCharts() {
  const responses = getResponses();

  const emotionCounts = countByField(responses, "emotion", EMOTIONS);
  const storyCounts = countByField(responses, "story", STORIES);

  const emotionLabels = Object.keys(emotionCounts);
  const emotionValues = Object.values(emotionCounts);

  const storyLabels = Object.keys(storyCounts);
  const storyValues = Object.values(storyCounts);

  const emotionCtx = document.getElementById("emotionChart").getContext("2d");
  const storyCtx = document.getElementById("storyChart").getContext("2d");

  if (emotionChart) emotionChart.destroy();
  if (storyChart) storyChart.destroy();

  emotionChart = new Chart(emotionCtx, {
    type: "bar",
    data: {
      labels: emotionLabels,
      datasets: [{ label: "Count", data: emotionValues }]
    },
    options: {
      responsive: true,
      plugins: { legend: { display: false } },
      scales: { y: { beginAtZero: true, ticks: { precision: 0 } } }
    }
  });

  storyChart = new Chart(storyCtx, {
    type: "bar",
    data: {
      labels: storyLabels,
      datasets: [{ label: "Count", data: storyValues }]
    },
    options: {
      responsive: true,
      plugins: { legend: { display: false } },
      scales: { y: { beginAtZero: true, ticks: { precision: 0 } } }
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
  const exportMsg = document.getElementById("exportMsg");
  const responses = getResponses();

  if (!responses.length) {
    exportMsg.style.color = "#ffd1d1";
    exportMsg.textContent = "No responses to export yet.";
    return;
  }

  const csv = toCSV(responses);
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);

  const a = document.createElement("a");
  a.href = url;
  a.download = "concert_responses.csv";
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);

  URL.revokeObjectURL(url);

  exportMsg.style.color = "rgba(242,243,245,0.95)";
  exportMsg.textContent = "Exported CSV.";
});

// ---------- Clear local data ----------
clearBtn.addEventListener("click", () => {
  const ok = confirm("Clear local responses and emails on this device?");
  if (!ok) return;

  localStorage.removeItem(RESPONSES_KEY);
  localStorage.removeItem(EMAILS_KEY);

  document.getElementById("exportMsg").style.color = "rgba(242,243,245,0.95)";
  document.getElementById("exportMsg").textContent = "Local data cleared.";

  renderCharts();
});

// ---------- Init ----------
renderButtons();
renderCharts();