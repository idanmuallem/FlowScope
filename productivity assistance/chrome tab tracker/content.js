let lastScrollY = window.scrollY;
let lastTime = Date.now();

window.addEventListener("scroll", () => {
  const now = Date.now();
  const deltaY = Math.abs(window.scrollY - lastScrollY);
  const deltaT = (now - lastTime) / 1000; // seconds

  if (deltaT > 0) {
    const scrollSpeed = deltaY / deltaT; // px per second

    chrome.runtime.sendMessage({
      type: "scroll",
      url: location.hostname,
      speed: scrollSpeed,
      distance: deltaY
    });
  }

  lastScrollY = window.scrollY;
  lastTime = now;
});
