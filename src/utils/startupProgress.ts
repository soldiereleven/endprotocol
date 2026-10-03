let trackingStartup = false;
let startupComplete = false;
let progress = 8;
let pendingTasks = 0;
let idleTimer: ReturnType<typeof setTimeout> | undefined;
let readyStatus = "";

function renderProgress(status?: string) {
  const bar = document.getElementById("startup-splash-progress");
  const progressbar = bar?.parentElement;
  if (bar) bar.style.width = `${progress}%`;
  progressbar?.setAttribute("aria-valuenow", String(progress));

  if (status) {
    const statusElement = document.getElementById("startup-splash-status");
    if (statusElement) statusElement.textContent = status;
  }
}

function finishWhenIdle() {
  if (!trackingStartup || startupComplete || pendingTasks !== 0) return;

  if (idleTimer) clearTimeout(idleTimer);
  idleTimer = setTimeout(() => {
    if (!trackingStartup || pendingTasks !== 0) return;

    startupComplete = true;
    progress = 100;
    renderProgress(readyStatus);
    const splash = document.getElementById("startup-splash");
    splash?.classList.add("is-hiding");
    setTimeout(() => splash?.remove(), 450);
  }, 650);
}

export function setStartupPhase(value: number, status: string) {
  progress = Math.max(progress, Math.min(94, value));
  renderProgress(status);
}

export function beginStartupTracking(status: string, ready: string) {
  trackingStartup = true;
  readyStatus = ready;
  setStartupPhase(34, status);
  requestAnimationFrame(() => requestAnimationFrame(finishWhenIdle));
}

export function trackStartupTask<T>(task: Promise<T>): Promise<T> {
  if (!trackingStartup || startupComplete) return task;

  pendingTasks += 1;
  progress = Math.min(92, Math.max(progress, 40) + 5);
  renderProgress();
  if (idleTimer) clearTimeout(idleTimer);

  return task.finally(() => {
    pendingTasks = Math.max(0, pendingTasks - 1);
    progress = Math.min(96, progress + 3);
    renderProgress();
    finishWhenIdle();
  });
}

export function failStartup(status: string) {
  trackingStartup = false;
  if (idleTimer) clearTimeout(idleTimer);
  renderProgress(status);
}
