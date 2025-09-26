const todayEl = document.getElementById("today");
const weekEl = document.getElementById("week");
const focusEl = document.getElementById("status");
const confidenceEl = document.getElementById("confidence");
const storage = globalThis.chrome?.storage?.local;

function renderStatus(element, { state, message }) {
  const emoji = state === "ok" ? "✅" : state === "warn" ? "⚠️" : "❌";
  element.textContent = `${emoji} ${message}`;
}

document.addEventListener("DOMContentLoaded", () => {
  if (!storage) {
    focusEl.textContent = "Preview only";
    confidenceEl.textContent = "Open inside Chrome extension to view live data.";
    renderStatus(todayEl, {
      state: "warn",
      message: "Storage unavailable outside extension context",
    });
    renderStatus(weekEl, {
      state: "warn",
      message: "Weekly archive unavailable",
    });
    return;
  }

  storage.get(null, (data) => {
    const todayKey = new Date().toISOString().split("T")[0];
    const todayData = data[todayKey];

    if (todayData) {
      renderStatus(todayEl, {
        state: "ok",
        message: `Tab switches: ${todayData.tabSwitches ?? 0}, Idle: ${todayData.idleTime ?? 0}s`,
      });
    } else {
      renderStatus(todayEl, {
        state: "warn",
        message: "No activity captured yet today",
      });
    }

    const weekKeys = Object.keys(data).filter((k) => /\d{4}-W\d+/.test(k));
    if (weekKeys.length) {
      const latestWeek = weekKeys.sort().at(-1);
      const summary = data[latestWeek];
      renderStatus(weekEl, {
        state: "ok",
        message: `${weekKeys.length} archived · Avg switches ${summary?.avgTabSwitches ?? "–"}`,
      });
    } else {
      renderStatus(weekEl, {
        state: "warn",
        message: "No weekly summary archived yet",
      });
    }
  });

  storage.get("focusEstimate", (data) => {
    const estimate = data.focusEstimate;
    if (estimate) {
      const { focus_score, label, confidence } = estimate;
      focusEl.textContent = `${label} · score ${focus_score}`;
      confidenceEl.textContent = `Confidence ${Math.round(parseFloat(confidence) * 100)}%`;
    } else {
      focusEl.textContent = "Waiting for first focus estimate…";
      confidenceEl.textContent = "Stay active in the browser to generate data.";
    }
  });
});
