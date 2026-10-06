import { apps, profile } from "./content.js";
import { icons } from "./icons.js";

// ---------------------------------------------------------------------------
// DOM
// ---------------------------------------------------------------------------
const iconGrid = document.getElementById("desktop-icons");
const windowLayer = document.getElementById("window-layer");
const taskList = document.getElementById("task-list");
const startButton = document.getElementById("start-button");
const startMenu = document.getElementById("start-menu");
const clock = document.getElementById("tray-clock");

const appsById = new Map(apps.map((app) => [app.id, app]));
const WINDOW_MARGIN = 16; // minimum gap between a new window and the screen edge
const MIN_WIDTH = 260;
const MIN_HEIGHT = 160;

// ---------------------------------------------------------------------------
// Window manager state. Each open window has one entry; the DOM is synced
// from this state in syncUI().
// ---------------------------------------------------------------------------
const windows = new Map(); // id -> { el, taskButton, minimized, maximized, z }
let focusedId = null;
let topZ = 1;
let cascade = 0;

function syncUI() {
  for (const [id, win] of windows) {
    const isFocused = id === focusedId;
    win.el.hidden = win.minimized;
    win.el.style.zIndex = win.z;
    win.el.classList.toggle("maximized", win.maximized);
    win.el.classList.toggle("inactive", !isFocused);
    win.taskButton.classList.toggle("active", isFocused && !win.minimized);
    win.taskButton.setAttribute("aria-pressed", String(isFocused && !win.minimized));
  }
}

// Focus the top-most window that isn't minimized (used after closing/minimizing).
function focusTopWindow() {
  let top = null;
  for (const [id, win] of windows) {
    if (!win.minimized && (!top || win.z > windows.get(top).z)) top = id;
  }
  focusedId = top;
}

function focusApp(id) {
  const win = windows.get(id);
  win.minimized = false;
  win.z = ++topZ;
  focusedId = id;
  syncUI();
}

function minimizeApp(id) {
  windows.get(id).minimized = true;
  focusTopWindow();
  syncUI();
}

function toggleMaximize(id) {
  const win = windows.get(id);
  win.maximized = !win.maximized;
  focusApp(id);
}

function closeApp(id) {
  const win = windows.get(id);
  win.el.remove();
  win.taskButton.remove();
  windows.delete(id);
  focusTopWindow();
  syncUI();
}

export function openApp(id) {
  if (!windows.has(id)) createWindow(appsById.get(id));
  focusApp(id);
}

export function closeAllApps() {
  for (const id of [...windows.keys()]) closeApp(id);
  cascade = 0;
}

// ---------------------------------------------------------------------------
// Window + taskbar button creation
// ---------------------------------------------------------------------------
function createWindow(app) {
  const el = document.createElement("section");
  el.className = "window";
  el.setAttribute("role", "dialog");
  el.setAttribute("aria-labelledby", `win-title-${app.id}`);
  el.innerHTML = `
    <header class="title-bar">
      <span class="title-icon">${icons[app.icon]}</span>
      <span class="title-text" id="win-title-${app.id}">${app.title}</span>
      <div class="title-controls">
        <button type="button" class="ctrl minimize" data-action="minimize" aria-label="Minimize"></button>
        <button type="button" class="ctrl maximize" data-action="maximize" aria-label="Maximize"></button>
        <button type="button" class="ctrl close" data-action="close" aria-label="Close"></button>
      </div>
    </header>
    <div class="window-body">${app.render()}</div>
    <div class="resize-handle" aria-hidden="true"></div>
  `;

  // Size and cascade new windows so they don't stack exactly on top of each other.
  const area = windowLayer.getBoundingClientRect();
  const width = Math.min(app.size.width, area.width - WINDOW_MARGIN * 2);
  const height = Math.min(app.size.height, area.height - WINDOW_MARGIN * 2);
  const offset = (cascade++ % 6) * 28;
  el.style.width = `${width}px`;
  el.style.height = `${height}px`;
  const left = app.position?.left ?? 140 + offset; // apps can request a starting spot
  const top = app.position?.top ?? 40 + offset;
  el.style.left = `${Math.max(WINDOW_MARGIN, Math.min(left, area.width - width - WINDOW_MARGIN))}px`;
  el.style.top = `${Math.max(WINDOW_MARGIN, Math.min(top, area.height - height - WINDOW_MARGIN))}px`;

  const actions = { minimize: minimizeApp, maximize: toggleMaximize, close: closeApp };
  el.querySelector(".title-controls").addEventListener("click", (e) => {
    const action = e.target.closest("[data-action]")?.dataset.action;
    if (action) actions[action](app.id);
  });
  el.addEventListener("pointerdown", () => {
    if (focusedId !== app.id) focusApp(app.id);
  });

  const titleBar = el.querySelector(".title-bar");
  titleBar.addEventListener("dblclick", (e) => {
    if (!e.target.closest(".title-controls")) toggleMaximize(app.id);
  });
  makeDraggable(el, titleBar, app.id);
  makeResizable(el, el.querySelector(".resize-handle"), app.id);

  const taskButton = document.createElement("button");
  taskButton.type = "button";
  taskButton.className = "task-button";
  taskButton.innerHTML = `<span class="task-icon">${icons[app.icon]}</span><span class="task-label">${app.title}</span>`;
  // Clicking the focused window's tab minimizes it; otherwise it restores and focuses it.
  taskButton.addEventListener("click", () => {
    const win = windows.get(app.id);
    if (focusedId === app.id && !win.minimized) minimizeApp(app.id);
    else focusApp(app.id);
  });

  windowLayer.appendChild(el);
  taskList.appendChild(taskButton);
  windows.set(app.id, {
    el,
    taskButton,
    minimized: false,
    maximized: false,
    z: 0,
  });
}

const clamp = (value, min, max) => Math.min(Math.max(value, min), max);

// Captures the pointer on `handle` and calls onMove for every move until it's released.
// Pointer events cover mouse, touch, and pen alike.
function trackPointer(handle, e, onMove) {
  e.preventDefault();
  handle.setPointerCapture(e.pointerId);
  const onUp = () => {
    handle.removeEventListener("pointermove", onMove);
    handle.removeEventListener("pointerup", onUp);
    handle.removeEventListener("pointercancel", onUp);
  };
  handle.addEventListener("pointermove", onMove);
  handle.addEventListener("pointerup", onUp);
  handle.addEventListener("pointercancel", onUp);
}

// Drag a window by its title bar, keeping at least part of it on screen.
function makeDraggable(el, handle, id) {
  handle.addEventListener("pointerdown", (e) => {
    if (e.button !== 0 || e.target.closest(".title-controls") || windows.get(id).maximized) return;
    const area = windowLayer.getBoundingClientRect();
    const startX = e.clientX - el.offsetLeft;
    const startY = e.clientY - el.offsetTop;

    trackPointer(handle, e, (ev) => {
      el.style.left = `${clamp(ev.clientX - startX, 80 - el.offsetWidth, area.width - 80)}px`;
      el.style.top = `${clamp(ev.clientY - startY, 0, area.height - 30)}px`;
    });
  });
}

// Resize a window from its bottom-right corner handle, without growing past the screen edge.
function makeResizable(el, handle, id) {
  handle.addEventListener("pointerdown", (e) => {
    if (e.button !== 0 || windows.get(id).maximized) return;
    const area = windowLayer.getBoundingClientRect();
    const startX = e.clientX;
    const startY = e.clientY;
    const startWidth = el.offsetWidth;
    const startHeight = el.offsetHeight;

    trackPointer(handle, e, (ev) => {
      const maxWidth = Math.max(MIN_WIDTH, area.width - el.offsetLeft);
      const maxHeight = Math.max(MIN_HEIGHT, area.height - el.offsetTop);
      el.style.width = `${clamp(startWidth + ev.clientX - startX, MIN_WIDTH, maxWidth)}px`;
      el.style.height = `${clamp(startHeight + ev.clientY - startY, MIN_HEIGHT, maxHeight)}px`;
    });
  });
}

// ---------------------------------------------------------------------------
// Desktop icons
// ---------------------------------------------------------------------------
for (const app of apps.filter((a) => a.showOnDesktop !== false)) {
  const button = document.createElement("button");
  button.type = "button";
  button.className = "desktop-icon";
  button.innerHTML = `${icons[app.icon]}<span>${app.title}</span>`;
  button.addEventListener("click", () => openApp(app.id));
  iconGrid.appendChild(button);
}

// ---------------------------------------------------------------------------
// Start menu
// ---------------------------------------------------------------------------
let onLogOff = () => {};

startMenu.querySelector(".start-user-name").textContent = profile.name;
startMenu.querySelector(".start-copyright").textContent = `© ${new Date().getFullYear()} ${profile.name}`;
startMenu.querySelector(".start-apps").innerHTML = apps
  .filter((app) => app.showOnDesktop !== false)
  .map((app) => `<li><button type="button" data-app="${app.id}">${icons[app.icon]}<span>${app.title}</span></button></li>`)
  .join("");
startMenu.querySelector(".start-links").innerHTML = [
  ["LinkedIn", profile.linkedin],
  ["GitHub", profile.github],
  ["Email me", `mailto:${profile.email}`],
]
  .map(([label, url]) => `<li><a href="${url}" target="_blank" rel="noopener">${label}</a></li>`)
  .join("");

function setStartMenuOpen(open) {
  startMenu.hidden = !open;
  startButton.setAttribute("aria-expanded", String(open));
}

startButton.addEventListener("click", (e) => {
  e.stopPropagation();
  setStartMenuOpen(startMenu.hidden);
});

startMenu.addEventListener("click", (e) => {
  const appButton = e.target.closest("[data-app]");
  if (appButton) openApp(appButton.dataset.app);
  if (e.target.closest(".log-off")) onLogOff();
  if (appButton || e.target.closest("a, .log-off")) setStartMenuOpen(false);
});

document.addEventListener("click", (e) => {
  if (!startMenu.hidden && !startMenu.contains(e.target)) setStartMenuOpen(false);
});

document.addEventListener("keydown", (e) => {
  if (e.key === "Escape") setStartMenuOpen(false);
});

// ---------------------------------------------------------------------------
// System tray clock
// ---------------------------------------------------------------------------
function updateClock() {
  clock.textContent = new Date().toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
}
updateClock();
setInterval(updateClock, 10_000);

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------
export function setLogOffHandler(handler) {
  onLogOff = handler;
}
