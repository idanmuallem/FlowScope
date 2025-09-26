document.addEventListener("DOMContentLoaded", () => {
  chrome.storage.local.get(null, (data) => {
    const todayKey = new Date().toISOString().split("T")[0];
    const todayData = data[todayKey];

    // Today status
    const todayElement = document.getElementById("today");
    if (todayElement) {
      if (todayData) {
        const switches = todayData.tabSwitches ?? 0;
        const idle = todayData.idleTime ?? 0;
        todayElement.textContent = `Active switches: ${switches}, Idle time: ${idle}s`;
      } else {
        todayElement.textContent = "No data collected today";
      }
    }

    // Weekly summary status
    const weekKeys = Object.keys(data).filter((k) => k.includes("W"));
    const weekElement = document.getElementById("week");
    if (weekElement) {
      if (weekKeys.length) {
        const sortedKeys = weekKeys.slice().sort();
        const latestKey = sortedKeys[sortedKeys.length - 1];
        const summary = data[latestKey];
        const switches = summary?.avgTabSwitches ?? 0;
        const idle = summary?.avgIdleTime ?? 0;
        weekElement.textContent = `${latestKey}: avg switches ${switches}, idle ${idle}s`;
      } else {
        weekElement.textContent = "No weekly summary yet";
      }
    }
  });

  chrome.storage.local.get("focusEstimate", (data) => {
    const e = data.focusEstimate;
    const statusElement = document.getElementById("status");
    if (!statusElement) {
      return;
    }

    if (e) {
      statusElement.textContent = `Score: ${e.focus_score}, Label: ${e.label}, Confidence: ${e.confidence}`;
    } else {
      statusElement.textContent = "No focus estimate available yet";
    }
  });
});
