// === FlowScope Background Service Worker ===
import { estimateFocus } from "./algorithm.js";
// Note: background.js runs in a service worker context
// Install/startup logs
chrome.runtime.onInstalled.addListener(() => {
  console.log("FlowScope extension installed 🚀");
});
console.log("Background service worker loaded 🎉");

// --- Utility Functions ---

function getTodayKey() {
  return new Date().toISOString().split("T")[0]; // e.g. "2025-09-19"
}

// Get ISO week key: "YYYY-Wxx"
function getISOWeekKey(date) {
  const tempDate = new Date(date.getTime());
  tempDate.setHours(0, 0, 0, 0);
  tempDate.setDate(tempDate.getDate() + 3 - ((tempDate.getDay() + 6) % 7));
  const week1 = new Date(tempDate.getFullYear(), 0, 4);
  const weekNumber =
    1 +
    Math.round(
      ((tempDate.getTime() - week1.getTime()) / 86400000 -
        3 +
        ((week1.getDay() + 6) % 7)) /
        7
    );
  return `${tempDate.getFullYear()}-W${weekNumber}`;
}

// --- Storage Functions ---

function saveTabSwitchCount(count) {
  const today = getTodayKey();

  chrome.storage.local.get(null, (data) => {
    let todayData = data[today] || { tabSwitches: 0, idleTime: 0 };
    todayData.tabSwitches = count;

    chrome.storage.local.set({ [today]: todayData }, () => {
      console.log("Saved tab switch count:", todayData);
    });

    cleanupOldEntries(data);
  });
}

function cleanupOldEntries(data) {
  const allDates = Object.keys(data).filter((k) => k.includes("-"));
  allDates.sort(); // oldest → newest
  const maxDays = 7;

  if (allDates.length > maxDays) {
    const toArchive = allDates.slice(0, allDates.length - maxDays);

    // Compute averages
    let totalSwitches = 0;
    let totalIdle = 0;

    toArchive.forEach((date) => {
      totalSwitches += data[date].tabSwitches || 0;
      totalIdle += data[date].idleTime || 0;
    });

    const avgSwitches = Math.round(totalSwitches / toArchive.length);
    const avgIdle = Math.round(totalIdle / toArchive.length);

    const weekKey = getISOWeekKey(new Date(toArchive[0]));

    chrome.storage.local.set(
      {
        [weekKey]: {
          avgTabSwitches: avgSwitches,
          avgIdleTime: avgIdle,
        },
      },
      () => {
        console.log("Archived weekly summary:", weekKey);
      }
    );

    chrome.storage.local.remove(toArchive, () => {
      console.log("Removed old entries:", toArchive);
    });
  }
}

// --- Tab & Window Tracking ---

let tabSwitchCount = 0;

// Fired when user switches to a new tab
chrome.tabs.onActivated.addListener(() => {
  tabSwitchCount++;
  console.log("Tab switched! Total:", tabSwitchCount);
  saveTabSwitchCount(tabSwitchCount);
});

// Fired when user switches between Chrome windows
chrome.windows.onFocusChanged.addListener((windowId) => {
  if (windowId !== chrome.windows.WINDOW_ID_NONE) {
    tabSwitchCount++;
    console.log("Window focus changed. Total switches:", tabSwitchCount);
    saveTabSwitchCount(tabSwitchCount);
  }
});


// Idle tracking: user inactive >30s
chrome.idle.setDetectionInterval(30);

chrome.idle.onStateChanged.addListener((newState) => {
  console.log("Idle state changed:", newState);
  saveTodayData((todayData) => {
    if (newState === "idle" || newState === "locked") {
      todayData.idleTime += 30; // rough approximation
    }
  });
});


// --- Scroll Tracking ---
chrome.runtime.onMessage.addListener((msg, sender) => {
  if (msg.type === "scroll") {
    saveTodayData((todayData) => {
      if (!todayData.scroll) todayData.scroll = {};
      if (!todayData.scroll[msg.url]) todayData.scroll[msg.url] = { distance: 0, events: 0 };

      todayData.scroll[msg.url].distance += msg.distance;
      todayData.scroll[msg.url].events += 1;
    });
  }
});

// --- Focus Estimation ---
function updateEstimate() {
  const W1 = collectWindowMetrics(15);   // implement to return object with rates
  const W2 = collectWindowMetrics(120);
  const result = estimateFocus(W1, W2);
  chrome.storage.local.set({ focusEstimate: result });
}
setInterval(updateEstimate, 5000);
