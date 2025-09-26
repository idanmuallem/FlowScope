// focus.js

// Example weights
const weights = {
  active: 0.25,
  switch: 0.15,
  keys: 0.20,
  mouse: 0.10,
  scroll: 0.15,
  notify: 0.05,
  media: 0.10,
};

function normalizeFeatures(window) {
  return {
    active: window.activeFrac,
    switch: 1 - Math.min(window.switchRate / 30, 1),
    keys: Math.min(window.keyRate / 6, 1),
    mouse: 1 - Math.min(Math.abs(window.mouseRate - 300) / 300, 1),
    scroll: 1 - Math.min(Math.abs(window.scrollRate - 800) / 800, 1),
    notify: 1 - Math.min(window.notifyRate / 30, 1),
    media: window.mediaFlag
  };
}

function score(window) {
  const f = normalizeFeatures(window);
  return Object.keys(weights)
    .reduce((sum, k) => sum + weights[k] * f[k], 0);
}

export function estimateFocus(W1, W2) {
  const s1 = score(W1);
  const s2 = score(W2);
  const focus = 0.7 * s2 + 0.3 * s1;

  let label;
  if (focus >= 0.65 && W2.activeFrac >= 0.8 && W2.switchRate <= 12) {
    label = "Focused";
  } else if (focus <= 0.40 || W2.activeFrac <= 0.4 || W2.switchRate >= 24) {
    label = "Unfocused";
  } else {
    label = "Undetermined";
  }

  const conf = Math.max(0, Math.min(1,
    0.6 * (1 - W2.stddev) + 0.4 * (1 - Math.abs(s2 - s1))
  ));

  return { focus_score: focus.toFixed(3), label, confidence: conf.toFixed(3) };
}
