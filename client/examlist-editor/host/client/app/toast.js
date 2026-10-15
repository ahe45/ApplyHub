let toastTimer = 0;
let toastFadeTimer = 0;
let toastDeadline = 0;
let toastRemainingMs = 3000;
const toastDurationMs = 3000;
const toastFadeDurationMs = 320;

function getToastRoot() {
  const toastRoot = document.getElementById("examlist-toast-root");
  return toastRoot instanceof HTMLElement ? toastRoot : null;
}

function ensureToastRoot() {
  const existingToastRoot = getToastRoot();

  if (existingToastRoot) {
    return existingToastRoot;
  }

  const toastRoot = document.createElement("div");
  toastRoot.id = "examlist-toast-root";
  toastRoot.className = "toast-root";
  toastRoot.setAttribute("aria-live", "polite");
  toastRoot.setAttribute("aria-atomic", "true");
  document.body.appendChild(toastRoot);
  return toastRoot;
}

export function hideToast() {
  if (toastTimer) {
    window.clearTimeout(toastTimer);
    toastTimer = 0;
  }
  if (toastFadeTimer) {
    window.clearTimeout(toastFadeTimer);
    toastFadeTimer = 0;
  }

  const toastRoot = getToastRoot();

  if (!toastRoot) {
    return;
  }

  toastRoot.classList.remove("has-toast");
  toastRoot.replaceChildren();
}

function scheduleToastDismiss(toastMessage, delayMs = toastRemainingMs) {
  if (toastTimer) window.clearTimeout(toastTimer);
  const normalizedDelay = Math.max(0, Number(delayMs) || 0);
  toastRemainingMs = normalizedDelay;
  toastDeadline = Date.now() + normalizedDelay;
  toastTimer = window.setTimeout(() => {
    toastTimer = 0;
    toastRemainingMs = 0;
    toastMessage.classList.add("is-fading");
    toastFadeTimer = window.setTimeout(() => {
      toastFadeTimer = 0;
      hideToast();
    }, toastFadeDurationMs);
  }, normalizedDelay);
}

export function showToast(message = "", options = {}) {
  const normalizedMessage = String(message || "").trim();
  const normalizedOptions = typeof options === "string" ? { tone: options } : options || {};

  hideToast();

  if (!normalizedMessage) {
    return;
  }

  const toastRoot = ensureToastRoot();
  const toastMessage = document.createElement("div");
  const tone = String(normalizedOptions.tone || "").trim().toLowerCase();
  const toneClass = ["error", "warning"].includes(tone) ? ` is-${tone}` : "";

  toastMessage.className = `toast-message${toneClass}`;
  toastMessage.setAttribute("role", tone === "error" ? "alert" : "status");
  toastMessage.textContent = normalizedMessage;
  toastRoot.replaceChildren(toastMessage);
  toastRoot.classList.add("has-toast");
  toastRemainingMs = toastDurationMs;
  toastMessage.addEventListener("mouseenter", () => {
    if (toastMessage.classList.contains("is-fading")) {
      if (toastFadeTimer) window.clearTimeout(toastFadeTimer);
      toastFadeTimer = 0;
      toastMessage.classList.remove("is-fading");
      toastRemainingMs = toastDurationMs;
      return;
    }
    if (toastTimer) {
      toastRemainingMs = Math.max(0, toastDeadline - Date.now());
      window.clearTimeout(toastTimer);
      toastTimer = 0;
    }
  });
  toastMessage.addEventListener("mouseleave", () => {
    scheduleToastDismiss(toastMessage, toastRemainingMs > 0 ? toastRemainingMs : toastDurationMs);
  });
  scheduleToastDismiss(toastMessage, toastDurationMs);
}
