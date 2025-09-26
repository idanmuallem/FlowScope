document.addEventListener("DOMContentLoaded", () => {
  chrome.storage.local.get(null, (data) => {
    const todayKey = new Date().toISOString().split("T")[0];
    const todayData = data[todayKey];

    // Today status
    let todayStatus = todayData
      ? "OK: Today’s entry exists"
      : "X: No data collected today";
    document.getElementById("today").textContent = todayStatus;

    // Weekly summary status
    const weekKeys = Object.keys(data).filter((k) => k.includes("W"));
    let weekStatus = weekKeys.length
      ? `OK: ${weekKeys.length} weekly summaries available`
      : "X: No weekly summary yet";
    document.getElementById("week").textContent = weekStatus;
  });

  chrome.storage.local.get("focusEstimate", (data) => {
    const e = data.focusEstimate;
    if (e) {
      document.getElementById("status").textContent =
        `Score: ${e.focus_score}, Label: ${e.label}, Confidence: ${e.confidence}`;
    } else {
      document.getElementById("status").textContent =
        "No focus estimate available yet";
    }
  });
});
