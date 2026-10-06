// The string lights along the top of the room, plus the tiny sparkles that pop
// off their bulbs. The lights are rebuilt to fit the screen, so bulbs stay the
// same size and spacing on any width.

const LIGHTS_HEIGHT = 56;    // px; the post-it always starts below this (see .intro in style.css)
const WIRE_TOP = 4;          // px from the top where the wire is pinned at each end
const WIRE_SAG = 24;         // px the wire droops in the middle
const BULB_SPACING = 64;     // px between bulbs (roughly)
const BULB_COLORS = ["#fff4d1", "#ffe9b8", "#fff0c9"]; // warm white, like fairy lights

const SPAWN_INTERVAL = 350;  // ms between sparkles
const SPARKLE_SVG = `<svg viewBox="0 0 10 10"><path d="M5 0l1.2 3.8L10 5 6.2 6.2 5 10 3.8 6.2 0 5l3.8-1.2z" /></svg>`;
const SVG_NS = "http://www.w3.org/2000/svg";

const landing = document.getElementById("landing");
const room = landing.querySelector(".room");
const lights = room.querySelector(".string-lights");
let bulbs = [];

function svgElement(tag, attributes) {
  const el = document.createElementNS(SVG_NS, tag);
  for (const [name, value] of Object.entries(attributes)) el.setAttribute(name, value);
  return el;
}

function buildLights() {
  const width = window.innerWidth;
  lights.setAttribute("viewBox", `0 0 ${width} ${LIGHTS_HEIGHT}`);
  lights.replaceChildren();

  // Shared soft glow drawn behind every bulb
  const halo = svgElement("radialGradient", { id: "bulb-halo" });
  halo.append(
    svgElement("stop", { offset: "0", "stop-color": "#ffd58a", "stop-opacity": "0.75" }),
    svgElement("stop", { offset: "1", "stop-color": "#ffb45a", "stop-opacity": "0" })
  );
  const defs = svgElement("defs", {});
  defs.append(halo);
  lights.append(defs);

  // The wire is a gentle curve pinned at both edges. Along this curve x moves
  // evenly, so bulbs at even steps are evenly spaced.
  const control = WIRE_TOP + 2 * WIRE_SAG;
  const wireY = (t) => (1 - t) ** 2 * WIRE_TOP + 2 * (1 - t) * t * control + t ** 2 * WIRE_TOP;
  lights.append(svgElement("path", { d: `M0 ${WIRE_TOP} Q${width / 2} ${control} ${width} ${WIRE_TOP}` }));

  // An odd count puts one bulb exactly in the middle.
  let count = Math.max(5, Math.round(width / BULB_SPACING));
  if (count % 2 === 0) count++;

  bulbs = [];
  bag = [];
  for (let i = 0; i < count; i++) {
    const t = (i + 0.5) / count;
    const x = t * width;
    const y = wireY(t);
    const bulb = svgElement("g", { class: "bulb", style: `--delay: ${(i % 5) * 0.45}s` });
    const glass = svgElement("ellipse", { cx: x, cy: y + 12, rx: 4.5, ry: 6, fill: BULB_COLORS[i % BULB_COLORS.length] });
    bulb.append(
      svgElement("circle", { class: "halo", cx: x, cy: y + 12, r: 16 }),
      svgElement("line", { x1: x, y1: y, x2: x, y2: y + 6 }),
      glass
    );
    lights.append(bulb);
    bulbs.push(glass);
  }
}

// Hand out turns from a shuffled "bag" so every bulb sparkles equally often,
// just in a random order.
let bag = [];
function nextBulb() {
  if (!bag.length) {
    bag = [...bulbs];
    for (let i = bag.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [bag[i], bag[j]] = [bag[j], bag[i]];
    }
  }
  return bag.pop();
}

function spawnSparkle() {
  // Skip while hidden, or while the room is zooming (positions would be off).
  if (document.hidden || document.body.classList.contains("details-view") || landing.style.transform) return;

  const bulb = nextBulb();
  const bulbRect = bulb.getBoundingClientRect();
  const roomRect = room.getBoundingClientRect();
  const angle = Math.random() * Math.PI * 2;

  // Start right at the bulb's edge, then drift a few pixels outward.
  const sparkle = document.createElement("span");
  sparkle.className = "light-sparkle";
  sparkle.innerHTML = SPARKLE_SVG;
  sparkle.style.left = `${bulbRect.left - roomRect.left + bulbRect.width / 2 + Math.cos(angle) * bulbRect.width * 0.6}px`;
  sparkle.style.top = `${bulbRect.top - roomRect.top + bulbRect.height / 2 + Math.sin(angle) * bulbRect.height * 0.6}px`;
  sparkle.style.setProperty("--size", `${4 + Math.random() * 4}px`);
  sparkle.style.setProperty("--dx", `${Math.cos(angle) * 6}px`);
  sparkle.style.setProperty("--dy", `${Math.sin(angle) * 6}px`);
  sparkle.addEventListener("animationend", () => sparkle.remove());
  room.appendChild(sparkle);
}

buildLights();
let resizeTimer;
window.addEventListener("resize", () => {
  clearTimeout(resizeTimer);
  resizeTimer = setTimeout(buildLights, 150);
});

if (!window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
  setInterval(spawnSparkle, SPAWN_INTERVAL);
}
