let lastScrollY = window.scrollY;
let lastScrollTime = Date.now();
let lastMousePosition = { x: null, y: null };

const inputBuffer = {
  keys: 0,
  mouseDistance: 0,
  mouseEvents: 0,
};

let flushTimer = null;

function scheduleFlush() {
  if (flushTimer) {
    return;
  }
  flushTimer = setTimeout(() => {
    flushTimer = null;
    flushInputBuffer();
  }, 2000);
}

function flushInputBuffer() {
  if (inputBuffer.keys === 0 && inputBuffer.mouseEvents === 0 && inputBuffer.mouseDistance === 0) {
    return;
  }

  chrome.runtime.sendMessage({
    type: "input-activity",
    keys: inputBuffer.keys,
    mouseDistance: inputBuffer.mouseDistance,
    mouseEvents: inputBuffer.mouseEvents,
  });

  inputBuffer.keys = 0;
  inputBuffer.mouseDistance = 0;
  inputBuffer.mouseEvents = 0;
}

window.addEventListener("scroll", () => {
  const now = Date.now();
  const deltaY = Math.abs(window.scrollY - lastScrollY);
  const deltaT = (now - lastScrollTime) / 1000; // seconds

  if (deltaT > 0 && deltaY > 0) {
    const scrollSpeed = deltaY / deltaT; // px per second

    chrome.runtime.sendMessage({
      type: "scroll",
      url: location.hostname,
      speed: scrollSpeed,
      distance: deltaY,
    });
  }

  lastScrollY = window.scrollY;
  lastScrollTime = now;
});

window.addEventListener("keydown", () => {
  inputBuffer.keys += 1;
  scheduleFlush();
});

window.addEventListener("mousemove", (event) => {
  if (lastMousePosition.x !== null && lastMousePosition.y !== null) {
    const deltaX = event.clientX - lastMousePosition.x;
    const deltaY = event.clientY - lastMousePosition.y;
    inputBuffer.mouseDistance += Math.sqrt(deltaX ** 2 + deltaY ** 2);
  }
  lastMousePosition = { x: event.clientX, y: event.clientY };
  inputBuffer.mouseEvents += 1;
  scheduleFlush();
});

window.addEventListener("beforeunload", () => {
  flushInputBuffer();
});

document.addEventListener("visibilitychange", () => {
  if (document.visibilityState === "hidden") {
    flushInputBuffer();
  }
});
