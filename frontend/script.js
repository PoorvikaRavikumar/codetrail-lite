const API_BASE = "/api/leetcode/";
const STORAGE_KEY = "codetrailProfile";
const DEFAULT_USERNAME = "Sheetalsoule";

let currentData = null;
const charts = {};

function getSavedUsername() {
  try {
    const saved = JSON.parse(
      localStorage.getItem(STORAGE_KEY) || "{}"
    );
    return saved.username || DEFAULT_USERNAME;
  } catch {
    return DEFAULT_USERNAME;
  }
}

function saveUsername(username) {
  localStorage.setItem(
    STORAGE_KEY,
    JSON.stringify({ username })
  );
}

function getNumber(value) {
  const number = Number(value);
  return Number.isFinite(number) ? number : 0;
}

function setText(id, value) {
  const element = document.getElementById(id);
  if (element) element.textContent = value;
}

function setProgress(id, value, total) {
  const element = document.getElementById(id);
  if (!element) return;

  const percentage = total
    ? Math.min(100, (value / total) * 100)
    : 0;

  element.style.width = percentage + "%";
}

function readLeetCodeData(raw) {
  const root = raw?.data || raw || {};
  const user = root.matchedUser || root.user || root.profile || root;

  const stats =
    user.submitStats ||
    root.submitStats ||
    {};

  const accepted = stats.acSubmissionNum || [];

  function findDifficulty(name) {
    const item = accepted.find(
      item =>
        String(item.difficulty || "").toLowerCase() ===
        name.toLowerCase()
    );

    return getNumber(item?.count);
  }

  const easy = getNumber(
    root.easySolved ??
    user.easySolved ??
    findDifficulty("Easy")
  );

  const medium = getNumber(
    root.mediumSolved ??
    user.mediumSolved ??
    findDifficulty("Medium")
  );

  const hard = getNumber(
    root.hardSolved ??
    user.hardSolved ??
    findDifficulty("Hard")
  );

  const total = getNumber(
    root.totalSolved ??
    user.totalSolved ??
    easy + medium + hard
  );

  const profile = user.profile || root.profile || {};

  const calendarSource =
    user.userCalendar?.submissionCalendar ||
    root.userCalendar?.submissionCalendar ||
    root.submissionCalendar ||
    root.stats?.submissionCalendar ||
    {};

  let calendar = {};

  try {
    calendar =
      typeof calendarSource === "string"
        ? JSON.parse(calendarSource)
        : calendarSource;
  } catch {
    calendar = {};
  }

  return {
    username:
      user.username ||
      root.username ||
      getSavedUsername(),

    name:
      profile.realName ||
      user.realName ||
      root.realName ||
      "",

    ranking: getNumber(
      profile.ranking ||
      user.ranking ||
      root.ranking
    ),

    total,
    easy,
    medium,
    hard,
    calendar
  };
}

async function loadLeetCodeData() {
  const username = getSavedUsername();

  document.querySelectorAll("[data-username]").forEach(element => {
    element.textContent = username;
  });

  const status = document.getElementById("statusMessage");

  if (status) {
    status.textContent = "Loading your LeetCode profile...";
    status.className = "status";
  }

  try {
    const response = await fetch(
      API_BASE + encodeURIComponent(username)
    );

    if (!response.ok) {
      throw new Error("Backend error: " + response.status);
    }

    const raw = await response.json();

    currentData = readLeetCodeData(raw);

    updateCommonStats();
    renderPage();

    if (status) {
      status.textContent =
        "LeetCode profile loaded successfully.";

      status.className = "status success";
    }

  } catch (error) {
    console.error("LeetCode API error:", error);

    if (status) {
      status.textContent =
        "Could not load LeetCode data. Check your backend and username.";

      status.className = "status error";
    }
  }
}

function updateCommonStats() {
  if (!currentData) return;

  const d = currentData;

  const values = {
    totalSolved: d.total,
    easySolved: d.easy,
    mediumSolved: d.medium,
    hardSolved: d.hard,
    ranking: d.ranking
      ? "#" + d.ranking.toLocaleString()
      : "—",
    profileName: d.name || d.username,
    username: d.username,
    totalQuestions: d.total
  };

  Object.entries(values).forEach(([id, value]) => {
    setText(id, value);
  });

  // Progress labels
  setText("easyProgressCount", d.easy);
  setText("mediumProgressCount", d.medium);
  setText("hardProgressCount", d.hard);

  setText("easySolvedLabel", d.easy);
  setText("mediumSolvedLabel", d.medium);
  setText("hardSolvedLabel", d.hard);

  // Progress bars
  setProgress("easyProgress", d.easy, d.total);
  setProgress("mediumProgress", d.medium, d.total);
  setProgress("hardProgress", d.hard, d.total);
}

function renderPage() {
  if (!currentData) return;

  const page = document.body.dataset.page;

  if (page === "overview") renderOverview();
  if (page === "analytics") renderAnalytics();
  if (page === "activity") renderActivity();
  if (page === "recommendations") renderRecommendations();
  if (page === "profile") renderProfile();
}

function makeChart(id, type, labels, datasets, extraOptions = {}) {
  const canvas = document.getElementById(id);

  if (!canvas || typeof Chart === "undefined") return;

  if (charts[id]) {
    charts[id].destroy();
  }

  charts[id] = new Chart(canvas, {
    type,

    data: {
      labels,
      datasets
    },

    options: {
      responsive: true,
      maintainAspectRatio: false,

      plugins: {
        legend: {
          position: "bottom"
        }
      },

      ...extraOptions
    }
  });
}

// OVERVIEW PAGE

function renderOverview() {
  const d = currentData;

  makeChart(
    "overviewChart",
    "doughnut",
    ["Easy", "Medium", "Hard"],
    [{
      data: [d.easy, d.medium, d.hard],
      backgroundColor: [
        "#23c995",
        "#ffb84d",
        "#ef6b91"
      ],
      borderWidth: 0
    }],
    {
      cutout: "70%"
    }
  );

  const calendar = getCalendarEntries().slice(-7);

  makeChart(
    "overviewActivityChart",
    "bar",
    calendar.map(item =>
      new Date(item.timestamp * 1000).toLocaleDateString(
        "en",
        { weekday: "short" }
      )
    ),
    [{
      label: "Submissions",
      data: calendar.map(item => item.count),
      backgroundColor: "#8a72f8",
      borderRadius: 7
    }]
  );
}

// ANALYTICS PAGE

function renderAnalytics() {
  const d = currentData;

  makeChart(
    "difficultyChart",
    "doughnut",
    ["Easy", "Medium", "Hard"],
    [{
      data: [d.easy, d.medium, d.hard],
      backgroundColor: [
        "#23c995",
        "#ffb84d",
        "#ef6b91"
      ],
      borderWidth: 0
    }],
    {
      cutout: "68%"
    }
  );

  makeChart(
    "barChart",
    "bar",
    ["Easy", "Medium", "Hard"],
    [{
      label: "Problems solved",
      data: [d.easy, d.medium, d.hard],
      backgroundColor: [
        "#23c995",
        "#ffb84d",
        "#ef6b91"
      ],
      borderRadius: 9
    }],
    {
      plugins: {
        legend: {
          display: false
        }
      }
    }
  );
}

// ACTIVITY DATA

function getCalendarEntries() {
  const calendar = currentData?.calendar || {};

  let entries = [];

  if (Array.isArray(calendar)) {
    entries = calendar.map(item => ({
      timestamp: getNumber(
        item.timestamp ??
        item.date ??
        item.time
      ),
      count: getNumber(
        item.count ??
        item.submissions
      )
    }));
  } else {
    entries = Object.entries(calendar).map(
      ([timestamp, count]) => ({
        timestamp: getNumber(timestamp),
        count: getNumber(count)
      })
    );
  }

  return entries
    .filter(item => item.timestamp > 0)
    .sort((a, b) => a.timestamp - b.timestamp);
}

// ACTIVITY PAGE

function renderActivity() {
  const entries = getCalendarEntries();

  const today = new Date();
  const start = new Date(today);

  start.setDate(today.getDate() - 363);
  start.setHours(0, 0, 0, 0);

  const byDay = {};

  entries.forEach(item => {
    const date = new Date(item.timestamp * 1000);
    const key = date.toISOString().slice(0, 10);

    byDay[key] = item.count;
  });

  // Heatmap

  const heatmap = document.getElementById("heatmap");

  if (heatmap) {
    heatmap.innerHTML = "";

    for (let i = 0; i < 364; i++) {
      const date = new Date(start);

      date.setDate(start.getDate() + i);

      const key = date.toISOString().slice(0, 10);
      const count = byDay[key] || 0;

      let level = 0;

      if (count > 0) level = 1;
      if (count >= 3) level = 2;
      if (count >= 6) level = 3;
      if (count >= 10) level = 4;

      const cell = document.createElement("div");

      cell.className = "heat-cell level-" + level;
      cell.title = `${key}: ${count} submissions`;

      heatmap.appendChild(cell);
    }
  }

  // Statistics

  const total = entries.reduce(
    (sum, item) => sum + item.count,
    0
  );

  const activeDays = entries.filter(
    item => item.count > 0
  ).length;

  const most = entries.reduce(
    (max, item) => Math.max(max, item.count),
    0
  );

  setText("totalSubmissions", total);
  setText("activeDays", activeDays);
  setText("mostActive", most);

  setText(
    "dailyAverage",
    activeDays
      ? (total / activeDays).toFixed(1)
      : "0"
  );

  // Activity chart

  const recent = entries.slice(-30);

  makeChart(
    "activityChart",
    "line",

    recent.map(item =>
      new Date(item.timestamp * 1000).toLocaleDateString()
    ),

    [{
      label: "Submissions",
      data: recent.map(item => item.count),
      borderColor: "#7657f6",
      backgroundColor: "rgba(118,87,246,.12)",
      fill: true,
      tension: 0.35
    }]
  );

  // Recent active days

  const list = document.getElementById("recentActivity");

  if (list) {
    const active = entries
      .filter(item => item.count > 0)
      .slice(-7)
      .reverse();

    list.innerHTML = active.length
      ? active.map(item => `
          <div class="list-item">
            <span>
              ${new Date(
                item.timestamp * 1000
              ).toLocaleDateString()}
            </span>

            <strong>${item.count} submissions</strong>
          </div>
        `).join("")
      : `<div class="list-item">
           No recent submission data found.
         </div>`;
  }
}

// RECOMMENDATIONS PAGE

function renderRecommendations() {
  const d = currentData;
  const total = d.total || 0;

  const easyPercent = total ? d.easy / total * 100 : 0;
  const mediumPercent = total ? d.medium / total * 100 : 0;
  const hardPercent = total ? d.hard / total * 100 : 0;

  const recommendations = [];

  if (total === 0) {
    recommendations.push([
      "Start with the fundamentals",
      "Begin with arrays, strings and basic mathematics."
    ]);
  } else {
    if (easyPercent > 65) {
      recommendations.push([
        "Move towards Medium problems",
        "Try two pointers, binary search and sliding window."
      ]);
    }

    if (mediumPercent < 30) {
      recommendations.push([
        "Improve your DSA skills",
        "Practise stacks, queues, linked lists and hash maps."
      ]);
    }

    if (hardPercent < 5 && total >= 20) {
      recommendations.push([
        "Explore Hard problems gradually",
        "Try advanced problems once your Medium skills improve."
      ]);
    }

    recommendations.push([
      "Maintain consistency",
      "Solve one problem daily and revise your mistakes."
    ]);
  }

  const container = document.getElementById("recommendationList");

  if (container) {
    container.innerHTML = recommendations.map(
      (item, index) => `
        <div class="card recommendation">
          <h3>${index + 1}. ${item[0]}</h3>
          <p>${item[1]}</p>
        </div>
      `
    ).join("");
  }

  setText("recommendationTotal", total);
}

// PROFILE PAGE

function renderProfile() {
  const d = currentData;

  setText("profileName", d.name || d.username);
  setText("profileUsername", "@" + d.username);

  setText(
    "profileRanking",
    d.ranking
      ? "#" + d.ranking.toLocaleString()
      : "Not available"
  );

  setText("profileTotal", d.total);
  setText("profileEasy", d.easy);
  setText("profileMedium", d.medium);
  setText("profileHard", d.hard);

  const input = document.getElementById("usernameInput");

  if (input) {
    input.value = d.username;
  }
}

// PAGE INITIALIZATION

document.addEventListener("DOMContentLoaded", () => {
  const usernameInput =
    document.getElementById("usernameInput");

  const updateButton =
    document.getElementById("updateProfileBtn");

  if (updateButton && usernameInput) {
    updateButton.addEventListener("click", () => {
      const username = usernameInput.value.trim();

      if (!username) {
        alert("Please enter a LeetCode username.");
        return;
      }

      saveUsername(username);
      loadLeetCodeData();
    });
  }

  loadLeetCodeData();
});