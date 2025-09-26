import { estimateFocus } from "./algorithm.js";

// Note: background.js runs in a service worker context
// Install/startup logs
chrome.runtime.onInstalled.addListener(() => {
  console.log("FlowScope extension installed 🚀");
});
console.log("Background service worker loaded 🎉");

// === In-memory metric tracking ===

const MAX_EVENT_AGE_MS = 15 * 60 * 1000; // retain 15 minutes of history for metrics

const DATE_KEY_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

const history = {
  tabSwitches: [],
  scrolls: [],
  inputs: [],
};

let currentActivityState = "active";
let currentActivitySince = Date.now();
const activitySegments = [];
let currentDayKey = getTodayKey();
let tabSwitchCount = 0;
let estimateUpdateTimer = null;

function normalizeState(state) {
  return state === "idle" || state === "locked" ? "idle" : "active";
}

function pruneOldEvents(list, cutoff) {
  while (list.length && list[0].time < cutoff) {
    list.shift();
  }
}

function pruneActivity(cutoff) {
  while (activitySegments.length && activitySegments[0].end <= cutoff) {
    activitySegments.shift();
  }
}

function recordActivityTransition(newState) {
  const normalizedState = normalizeState(newState);
  if (normalizedState === currentActivityState) {
    return;
  }
  const now = Date.now();
  activitySegments.push({
    state: currentActivityState,
    start: currentActivitySince,
    end: now,
  });
  currentActivityState = normalizedState;
  currentActivitySince = now;
  const cutoff = now - MAX_EVENT_AGE_MS;
  pruneActivity(cutoff);
}

function recordEvent(list, payload = {}) {
  const now = Date.now();
  list.push({ time: now, ...payload });
  const cutoff = now - MAX_EVENT_AGE_MS;
  pruneOldEvents(list, cutoff);
}

// --- Utility Functions ---

function getTodayKey() {
  return new Date().toISOString().split("T")[0]; // e.g. "2025-09-19"
}

function ensureCurrentDay() {
  const today = getTodayKey();
  if (today !== currentDayKey) {
    currentDayKey = today;
    tabSwitchCount = 0;
  }
  return currentDayKey;
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

function cleanupOldEntries(data) {
  const allDates = Object.keys(data).filter((k) => DATE_KEY_PATTERN.test(k));
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
        if (chrome.runtime.lastError) {
          console.error("Failed to archive weekly summary:", chrome.runtime.lastError);
        } else {
          console.log("Archived weekly summary:", weekKey);
        }
      }
    );

    chrome.storage.local.remove(toArchive, () => {
      if (chrome.runtime.lastError) {
        console.error("Failed to remove old entries:", chrome.runtime.lastError);
      } else {
        console.log("Removed old entries:", toArchive);
      }
    });
  }
}

function withTodayData(mutator) {
  const today = ensureCurrentDay();
  chrome.storage.local.get(null, (data) => {
    if (chrome.runtime.lastError) {
      console.error("Failed to read storage:", chrome.runtime.lastError);
      return;
    }
    const todayData = {
      tabSwitches: 0,
      idleTime: 0,
      scroll: {},
      ...(data[today] || {}),
    };

    todayData.tabSwitches = tabSwitchCount;

    if (typeof mutator === "function") {
      mutator(todayData);
    }

    chrome.storage.local.set({ [today]: todayData }, () => {
      if (chrome.runtime.lastError) {
        console.error("Failed to persist today data:", chrome.runtime.lastError);
        return;
      }
      console.log("Saved today data:", todayData);
      requestEstimateUpdate();
    });

    const updatedData = { ...data, [today]: todayData };
    cleanupOldEntries(updatedData);
  });
}

function initializeTodayState() {
  const today = ensureCurrentDay();
  chrome.storage.local.get(today, (data) => {
    if (chrome.runtime.lastError) {
      console.error("Failed to initialize today state:", chrome.runtime.lastError);
      return;
    }
    const saved = data[today];
    if (saved && typeof saved.tabSwitches === "number") {
      tabSwitchCount = saved.tabSwitches;
    }
  });
}

function handleTabSwitch() {
  ensureCurrentDay();
  tabSwitchCount += 1;
  recordEvent(history.tabSwitches);
  withTodayData(() => {});
  console.log("Tab/window switch recorded. Total:", tabSwitchCount);
  requestEstimateUpdate();
}

// Fired when user switches to a new tab
chrome.tabs.onActivated.addListener(() => {
  handleTabSwitch();
});

// Fired when user switches between Chrome windows
chrome.windows.onFocusChanged.addListener((windowId) => {
  if (windowId !== chrome.windows.WINDOW_ID_NONE) {
    handleTabSwitch();
  }
});

// Idle tracking: user inactive >30s
chrome.idle.setDetectionInterval(30);

chrome.idle.onStateChanged.addListener((newState) => {
  console.log("Idle state changed:", newState);
  recordActivityTransition(newState);
  withTodayData((todayData) => {
    if (normalizeState(newState) === "idle") {
      todayData.idleTime += 30; // rough approximation
    }
  });
});

// --- Message Handling ---
chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg.type === "scroll") {
    const urlKey = msg.url || "unknown";
    recordEvent(history.scrolls, { distance: msg.distance, speed: msg.speed });
    withTodayData((todayData) => {
      if (!todayData.scroll[urlKey]) {
        todayData.scroll[urlKey] = { distance: 0, events: 0 };
      }

      todayData.scroll[urlKey].distance += msg.distance;
      todayData.scroll[urlKey].events += 1;
    });
    requestEstimateUpdate();
  } else if (msg.type === "input-activity") {
    recordEvent(history.inputs, {
      keys: msg.keys,
      mouseDistance: msg.mouseDistance,
      mouseEvents: msg.mouseEvents,
    });
    requestEstimateUpdate();
  }
  return false;
});

// --- Focus Metrics Aggregation ---
function sumFromEvents(events, startTime, accessor) {
  return events.reduce((total, event) => {
    return event.time >= startTime ? total + accessor(event) : total;
  }, 0);
}

function collectWindowMetrics(windowSeconds) {
  const now = Date.now();
  const windowMs = windowSeconds * 1000;
  const startTime = now - windowMs;

  pruneOldEvents(history.tabSwitches, now - MAX_EVENT_AGE_MS);
  pruneOldEvents(history.scrolls, now - MAX_EVENT_AGE_MS);
  pruneOldEvents(history.inputs, now - MAX_EVENT_AGE_MS);
  pruneActivity(now - MAX_EVENT_AGE_MS);

  const switchesInWindow = history.tabSwitches.filter((event) => event.time >= startTime);
  const switchRate = switchesInWindow.length === 0
    ? 0
    : (switchesInWindow.length / windowSeconds) * 60;

  const keyCount = sumFromEvents(history.inputs, startTime, (event) => event.keys || 0);
  const keyRate = windowSeconds > 0 ? keyCount / windowSeconds : 0;

  const totalMouseDistance = sumFromEvents(
    history.inputs,
    startTime,
    (event) => event.mouseDistance || 0
  );
  const mouseRate = windowSeconds > 0 ? totalMouseDistance / windowSeconds : 0;

  const totalScroll = sumFromEvents(history.scrolls, startTime, (event) => event.distance || 0);
  const scrollRate = windowSeconds > 0 ? totalScroll / windowSeconds : 0;

  const activeMs = (() => {
    let activeDuration = 0;

    activitySegments.forEach((segment) => {
      const segmentStart = Math.max(segment.start, startTime);
      const segmentEnd = Math.min(segment.end, now);
      if (segmentEnd > segmentStart && segment.state === "active") {
        activeDuration += segmentEnd - segmentStart;
      }
    });

    const ongoingSegmentEnd = now;
    const ongoingStart = Math.max(currentActivitySince, startTime);
    if (ongoingSegmentEnd > ongoingStart && currentActivityState === "active") {
      activeDuration += ongoingSegmentEnd - ongoingStart;
    }

    return activeDuration;
  })();

  const activeFrac = windowMs > 0 ? activeMs / windowMs : 0;

  let stddev = 0.3;
  if (switchesInWindow.length >= 2) {
    const intervals = [];
    for (let i = 1; i < switchesInWindow.length; i += 1) {
      intervals.push((switchesInWindow[i].time - switchesInWindow[i - 1].time) / 1000);
    }
    if (intervals.length > 0) {
      const mean = intervals.reduce((sum, val) => sum + val, 0) / intervals.length;
      const variance = intervals.reduce((sum, val) => sum + (val - mean) ** 2, 0) / intervals.length;
      stddev = Math.min(1, Math.sqrt(variance) / 60);
    }
  }

  return {
    activeFrac: Math.max(0, Math.min(1, activeFrac)),
    switchRate,
    keyRate,
    mouseRate,
    scrollRate,
    notifyRate: 0,
    mediaFlag: 0,
    stddev,
  };
}

// --- Focus Estimation ---
function requestEstimateUpdate(immediate = false) {
  if (immediate) {
    if (estimateUpdateTimer) {
      clearTimeout(estimateUpdateTimer);
      estimateUpdateTimer = null;
    }
    updateEstimate();
    return;
  }

  if (estimateUpdateTimer) {
    return;
  }

  estimateUpdateTimer = setTimeout(() => {
    estimateUpdateTimer = null;
    updateEstimate();
  }, 750);
}

function updateEstimate() {
  const W1 = collectWindowMetrics(15);
  const W2 = collectWindowMetrics(120);
  const result = estimateFocus(W1, W2);
  chrome.storage.local.set({ focusEstimate: result }, () => {
    if (chrome.runtime.lastError) {
      console.error("Failed to persist focus estimate:", chrome.runtime.lastError);
    }
  });
}
initializeTodayState();
updateEstimate();
setInterval(updateEstimate, 5000);
