import * as THREE from "https://cdn.skypack.dev/three@0.129.0/build/three.module.js";
import { GLTFLoader } from "https://cdn.skypack.dev/three@0.129.0/examples/jsm/loaders/GLTFLoader.js";
import { openApp, closeAllApps, setLogOffHandler } from "./desktop.js";
import "./room.js";

// ---------------------------------------------------------------------------
// Config
// ---------------------------------------------------------------------------
const MODEL_PATH = "models/pc/scene.gltf";
const CAMERA_ELEVATION = 14;        // degrees the camera looks down: near eye level, to match the flat wall
const CAMERA_FOV = 50;              // a narrower lens than before, so the table isn't stretched
// Where things should land on screen (fractions of the screen height, from the top):
// the top of the PC sits just under the post-it, and the floor in front of the table near the bottom.
const FRAMING = {
  wide: { pcTop: 0.56, floor: 1.22 },
  tall: { pcTop: 0.47, floor: 1.04 },
};
const PC_FORWARD = 0.22;            // how far toward the front edge of the desk the PC sits (in PC heights)

// Wall decor layout, matching the mockup's proportions. It's worked out from
// where the desk and PC land on screen, so it holds on any screen shape.
const WALL = {
  postitToDesk: 0.8,     // post-it width, as a fraction of the desk's on-screen width
  postitShare: 0.55,     // post-it width, as a fraction of the cork board's width
  maxScreenShare: { wide: 0.36, tall: 0.86 }, // the post-it never gets wider than this much of the screen
  lightsClearance: 72,   // px from the top kept clear for the string lights
  noteDrop: 40,          // px (design size) the pink note hangs below the post-it; matches .spin-note
  boardPadTop: 0.1,      // gap above the post-it, as a fraction of its height
  noteWidth: 112,        // px (design size) of a pinned note, to check it fits beside the post-it
  artShare: 0.11,        // framed art width, as a fraction of the board's width
};

const AUTO_ROTATE_SPEED = 0.3;      // rad/s while idle
const INERTIA_DECAY = 3.0;          // exponential decay rate of spin velocity (per second)
const MIN_ANGULAR_SPEED = 0.01;     // below this, inertia stops and auto-rotate resumes
const VELOCITY_SAMPLES = 6;         // pointer samples averaged to compute release velocity
const POINTER_SENSITIVITY = 0.008;  // pixels -> radians

const RESET_DURATION = 500;         // ms to spin the PC back to face the front before zooming in
const ROOM_ZOOM_SCALE = 9;          // how far the room zooms into the monitor
const ROOM_ZOOM_DURATION = 1100;    // ms
// Where the monitor's screen is, as fractions of the model's bounding box (x: left→right,
// y: bottom→top, z: back→front) while it faces the front.
const SCREEN_POINT = { x: 0.4, y: 0.74, z: 0.62 };
const FADE = { delay: 450, duration: 600, hold: 100 };
const LOG_OFF_FADE = { delay: 0, duration: 450, hold: 100 };

// ---------------------------------------------------------------------------
// DOM
// ---------------------------------------------------------------------------
const landing = document.getElementById("landing");
const container = document.getElementById("container3D");
const corkboard = landing.querySelector(".corkboard");
const cat = landing.querySelector(".cat");
const intro = landing.querySelector(".intro");
const steam = landing.querySelector(".steam");
const wallArt = { left: landing.querySelector(".wall-art.left"), right: landing.querySelector(".wall-art.right") };
const learnMoreButton = document.getElementById("learn-more");
const desktop = document.getElementById("desktop");
const fadeOverlay = document.getElementById("fade-overlay");

// ---------------------------------------------------------------------------
// Scene setup. The wall, cork board and string lights are flat HTML behind the
// canvas; the desk, floor and everything on them are 3D so they share one
// perspective. The camera stays fixed; dragging spins the PC itself.
// ---------------------------------------------------------------------------
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(CAMERA_FOV, window.innerWidth / window.innerHeight, 0.1, 10000);

const renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.shadowMap.enabled = true;
renderer.setSize(window.innerWidth, window.innerHeight);
container.appendChild(renderer.domElement);

// Warm evening key light from the upper right (casts the shadows), plus a dim
// warm fill so shadowed sides aren't black. The desk lamp adds its own glow.
const topLight = new THREE.DirectionalLight(0xffd29c, 0.85);
topLight.castShadow = true;
topLight.shadow.mapSize.set(2048, 2048);
topLight.shadow.radius = 4;           // soften the shadow edge
topLight.shadow.bias = -0.0005;       // avoid striped "shadow acne" on self-shadowed surfaces
topLight.shadow.normalBias = 0.02;
scene.add(topLight, topLight.target);
scene.add(new THREE.AmbientLight(0xffd6b8, 0.42));

let model = null;
let initialModelQuaternion = null;
let room = null; // sizes of the 3D room, used for framing (set once the PC loads)

new GLTFLoader().load(
  MODEL_PATH,
  (gltf) => {
    // Wrap the model in a pivot at its visual center so it spins in place
    // rather than around the file's origin.
    const box = new THREE.Box3().setFromObject(gltf.scene);
    const dimensions = box.getSize(new THREE.Vector3());
    gltf.scene.position.sub(box.getCenter(new THREE.Vector3()));
    gltf.scene.traverse((child) => {
      if (child.isMesh) child.castShadow = child.receiveShadow = true; // shade itself too
    });
    model = new THREE.Group();
    model.add(gltf.scene);
    model.position.set(0, dimensions.y / 2, dimensions.y * PC_FORWARD); // on the tabletop, toward the front
    initialModelQuaternion = model.quaternion.clone();
    scene.add(model);

    room = buildRoom(dimensions);
    frameScene();
    cat.style.visibility = "visible";
    steam.style.visibility = "visible";
  },
  undefined,
  (error) => {
    console.error("Failed to load model:", error);
    landing.classList.add("ready");
  }
);

// ---------------------------------------------------------------------------
// The 3D room: table, floor, rug, baseboard and desk props. Everything is
// sized relative to the PC's height ("unit") so it stays in proportion.
// ---------------------------------------------------------------------------
const material = (color, map) => new THREE.MeshLambertMaterial({ color, map });
function mesh(geometry, color, map) {
  const m = new THREE.Mesh(geometry, material(color, map));
  m.castShadow = m.receiveShadow = true;
  return m;
}

// Simple painted wood grain: soft stripes along one direction.
function woodTexture(base, line, stripeSpacing, repeatX, repeatY) {
  const size = 256;
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = size;
  const ctx = canvas.getContext("2d");
  ctx.fillStyle = base;
  ctx.fillRect(0, 0, size, size);
  ctx.strokeStyle = line;
  for (let x = 0; x < size; x += stripeSpacing) {
    ctx.globalAlpha = 0.35 + Math.random() * 0.3;
    ctx.lineWidth = 1 + Math.random() * 1.5;
    ctx.beginPath();
    ctx.moveTo(x + Math.random() * 4, 0);
    ctx.bezierCurveTo(x + 6, size * 0.3, x - 6, size * 0.7, x + Math.random() * 4, size);
    ctx.stroke();
  }
  const texture = new THREE.CanvasTexture(canvas);
  texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
  texture.repeat.set(repeatX, repeatY);
  return texture;
}

function buildRoom(dimensions) {
  const unit = dimensions.y;
  const spinRadius = Math.hypot(dimensions.x, dimensions.z) / 2; // keep props clear of the spinning PC

  const table = {
    width: 2 * (spinRadius + unit * 0.72),
    depth: 2 * spinRadius + unit * 0.5,
    thickness: unit * 0.08,
    height: unit * 1.55, // tabletop to floor
  };
  const floorY = -table.height;
  const wallZ = -(table.depth / 2 + unit * 0.06); // the table sits nearly flush against the wall

  // Tabletop and four legs
  const top = mesh(
    new THREE.BoxGeometry(table.width, table.thickness, table.depth),
    0xffffff,
    woodTexture("#8f5e3c", "#6a4129", 18, 3, 1)
  );
  top.position.y = -table.thickness / 2;
  scene.add(top);
  const legSize = unit * 0.08;
  const legHeight = table.height - table.thickness;
  for (const sx of [-1, 1]) {
    for (const sz of [-1, 1]) {
      const leg = mesh(new THREE.BoxGeometry(legSize, legHeight, legSize), 0x5e3a24);
      leg.position.set(
        sx * (table.width / 2 - legSize),
        floorY + legHeight / 2,
        sz * (table.depth / 2 - legSize)
      );
      scene.add(leg);
    }
  }

  // Floor (from the wall forward) and a baseboard where it meets the wall
  const floorDepth = unit * 30;
  const floor = mesh(
    new THREE.PlaneGeometry(unit * 60, floorDepth),
    0xffffff,
    woodTexture("#4a3128", "#2c1c16", 32, 12, 6)
  );
  floor.rotation.x = -Math.PI / 2;
  floor.position.set(0, floorY, wallZ + floorDepth / 2);
  floor.castShadow = false;
  const baseboard = mesh(new THREE.BoxGeometry(unit * 60, unit * 0.12, unit * 0.03), 0x5a3f33);
  baseboard.position.set(0, floorY + unit * 0.06, wallZ + unit * 0.015);
  scene.add(floor, baseboard);

  // Invisible wall that only shows shadows, so the desk, PC and lamp cast
  // shadows onto the (HTML) wall and cork board behind them.
  const wallShadows = new THREE.Mesh(
    new THREE.PlaneGeometry(unit * 60, unit * 20),
    new THREE.ShadowMaterial({ opacity: 0.4 })
  );
  wallShadows.position.set(0, floorY + unit * 10, wallZ);
  wallShadows.receiveShadow = true;
  scene.add(wallShadows);

  // A soft oval rug under the table
  const rug = new THREE.Mesh(new THREE.CircleGeometry(1, 48), material(0x7a6656));
  rug.rotation.x = -Math.PI / 2;
  rug.scale.set(table.width * 0.42, table.depth * 0.75, 1);
  rug.position.set(0, floorY + unit * 0.004, unit * 0.2);
  rug.receiveShadow = true;
  const rugBorder = new THREE.Mesh(new THREE.RingGeometry(0.86, 0.9, 48), material(0x957f6a));
  rugBorder.rotation.x = -Math.PI / 2;
  rugBorder.scale.copy(rug.scale);
  rugBorder.position.set(0, floorY + unit * 0.006, unit * 0.2);
  rugBorder.receiveShadow = true;
  scene.add(rug, rugBorder);

  const mugTop = addDeskProps(unit, spinRadius);

  // Light from the upper right; fit its shadow area around the table and floor.
  const span = table.width;
  topLight.position.set(span * 0.6, span * 0.45, span); // low and in front, so shadows climb onto the wall and cork board
  const shadowCamera = topLight.shadow.camera;
  shadowCamera.left = shadowCamera.bottom = -span;
  shadowCamera.right = shadowCamera.top = span;
  shadowCamera.near = 0.1;
  shadowCamera.far = span * 4;
  shadowCamera.updateProjectionMatrix();

  return { unit, spinRadius, table, floorY, wallZ, mugTop };
}

// A potted plant, a coffee mug and a desk lamp on the tabletop (y = 0).
function addDeskProps(unit, spinRadius) {
  // Plant: a tapered pot with a rim, and a fan of leaves.
  const plant = new THREE.Group();
  const potHeight = unit * 0.24;
  const pot = mesh(new THREE.CylinderGeometry(unit * 0.11, unit * 0.08, potHeight, 16), 0xf0ab92);
  pot.position.y = potHeight / 2;
  const rim = mesh(new THREE.CylinderGeometry(unit * 0.12, unit * 0.12, unit * 0.045, 16), 0xe6967c);
  rim.position.y = potHeight;
  plant.add(pot, rim);
  const leafColors = [0x7cc464, 0x66b34f, 0x92d27a];
  const leafCount = 9;
  for (let i = 0; i < leafCount; i++) {
    const leaf = mesh(new THREE.SphereGeometry(unit * 0.05, 10, 8), leafColors[i % leafColors.length]);
    const length = unit * (0.32 + (i % 3) * 0.06);
    leaf.scale.set(1, length / (unit * 0.1), 0.35); // long, flat leaf
    const pivot = new THREE.Group();          // pivot at the soil so leaves fan outward
    pivot.position.y = potHeight;
    pivot.rotation.y = (i / leafCount) * Math.PI * 2;
    pivot.rotation.z = 0.25 + (i % 2) * 0.25;  // lean out at alternating angles
    leaf.position.y = length / 2;
    pivot.add(leaf);
    plant.add(pivot);
  }
  plant.position.set(-(spinRadius + unit * 0.3), 0, -spinRadius * 0.2);

  // Mug: an open pink cup with a handle, filled with coffee.
  const mug = new THREE.Group();
  const mugHeight = unit * 0.2;
  const mugRadius = unit * 0.085;
  const cup = mesh(new THREE.CylinderGeometry(mugRadius, unit * 0.075, mugHeight, 24, 1, true), 0xf393ad);
  cup.material.side = THREE.DoubleSide; // open top, so you can see inside
  cup.position.y = mugHeight / 2;
  const lip = mesh(new THREE.TorusGeometry(mugRadius, unit * 0.006, 6, 24), 0xf7a9bd);
  lip.rotation.x = Math.PI / 2;
  lip.position.y = mugHeight;
  const coffee = new THREE.Mesh(new THREE.CircleGeometry(mugRadius * 0.97, 24), material(0x5a3220));
  coffee.rotation.x = -Math.PI / 2;
  coffee.position.y = mugHeight * 0.82;
  const crema = new THREE.Mesh(new THREE.RingGeometry(mugRadius * 0.55, mugRadius * 0.95, 24), material(0x8a5634));
  crema.rotation.x = -Math.PI / 2;
  crema.position.y = mugHeight * 0.82 + unit * 0.001;
  const handle = mesh(new THREE.TorusGeometry(unit * 0.045, unit * 0.014, 8, 16), 0xf393ad);
  handle.position.set(unit * 0.09, mugHeight / 2, 0);
  mug.add(cup, lip, coffee, crema, handle);
  mug.rotation.y = -0.5; // turn the handle toward the viewer a little
  mug.position.set(spinRadius + unit * 0.12, 0, spinRadius * 0.5); // front right

  // Desk lamp: base, arm and a mustard shade, with a real warm light inside.
  const lamp = new THREE.Group();
  const base = mesh(new THREE.CylinderGeometry(unit * 0.09, unit * 0.1, unit * 0.025, 20), 0x3b2f2a);
  base.position.y = unit * 0.0125;
  const armHeight = unit * 0.42;
  const arm = mesh(new THREE.CylinderGeometry(unit * 0.012, unit * 0.012, armHeight, 8), 0x3b2f2a);
  arm.position.y = armHeight / 2;
  const head = new THREE.Group();     // shade + bulb, tilted to point down at the desk
  head.position.y = armHeight;
  head.rotation.z = -0.9; // shade opening points down and to the left, toward the PC
  const shade = mesh(new THREE.ConeGeometry(unit * 0.1, unit * 0.13, 20, 1, true), 0xe9b44c);
  shade.material.side = THREE.DoubleSide;
  const bulb = new THREE.Mesh(
    new THREE.SphereGeometry(unit * 0.035, 12, 10),
    new THREE.MeshBasicMaterial({ color: 0xfff1c4 }) // always bright, like it's glowing
  );
  bulb.position.y = -unit * 0.04;
  const lampLight = new THREE.PointLight(0xffb86b, 0.9, unit * 4);
  lampLight.position.y = -unit * 0.06;
  head.add(shade, bulb, lampLight);
  lamp.add(base, arm, head);
  lamp.position.set(spinRadius + unit * 0.38, 0, -spinRadius * 0.45); // back right
  lamp.scale.setScalar(1.3);

  scene.add(plant, mug, lamp);
  return new THREE.Vector3(mug.position.x, mugHeight, mug.position.z);
}

// ---------------------------------------------------------------------------
// Framing: place the camera so the PC sits just under the post-it and the
// floor in front of the table reaches near the bottom of the screen, on any
// screen shape. Then line the cork board and cat up with the 3D room.
// ---------------------------------------------------------------------------
const elevation = THREE.MathUtils.degToRad(CAMERA_ELEVATION);

function placeCamera(distance, targetY) {
  camera.position.set(0, targetY + distance * Math.sin(elevation), distance * Math.cos(elevation));
  camera.lookAt(0, targetY, 0);
  camera.updateMatrixWorld();
}

// Screen position of a 3D point, in pixels.
function toScreen(x, y, z) {
  const p = new THREE.Vector3(x, y, z).project(camera);
  return { x: ((p.x + 1) / 2) * window.innerWidth, y: ((1 - p.y) / 2) * window.innerHeight };
}

// Binary search for the value in [lo, hi] where fn(value) crosses 0 (fn increasing).
function solve(fn, lo, hi) {
  for (let i = 0; i < 40; i++) {
    const mid = (lo + hi) / 2;
    if (fn(mid) < 0) lo = mid;
    else hi = mid;
  }
  return (lo + hi) / 2;
}

function frameScene() {
  if (!room) return;
  const { unit, spinRadius, table, floorY, wallZ } = room;
  const height = window.innerHeight;
  camera.updateProjectionMatrix();
  const preset = camera.aspect > 1 ? FRAMING.wide : FRAMING.tall;
  const goal = preset;
  const pcTop = [0, unit, unit * PC_FORWARD];
  const floorFront = [0, floorY, table.depth / 2 + unit * 0.2];
  const propEdge = spinRadius + unit * 0.55; // outermost desk prop

  // For a given distance, slide the camera up/down until the PC top hits its spot.
  const aimAt = (distance) => {
    const targetY = solve((ty) => {
      placeCamera(distance, ty);
      return toScreen(...pcTop).y / height - goal.pcTop;
    }, -unit * 20, unit * 20);
    placeCamera(distance, targetY);
  };

  // Pull back until the floor in front of the table is in its spot...
  let distance = solve((d) => {
    aimAt(d);
    return goal.floor - toScreen(...floorFront).y / height;
  }, unit, unit * 60);
  // ...and further if needed so the desk props fit across narrow screens.
  aimAt(distance);
  if (toScreen(propEdge, 0, 0).x > window.innerWidth * 0.97) {
    distance = solve((d) => (aimAt(d), window.innerWidth * 0.97 - toScreen(propEdge, 0, 0).x), distance, unit * 60);
    aimAt(distance);
  }
  camera.near = distance / 100;
  camera.far = distance * 20;
  camera.updateProjectionMatrix();

  layoutWall();

  // Cat: curled up on the rug, tucked toward the back under the table, sized to the room.
  const catSpot = toScreen(-table.width * 0.2, floorY, -table.depth * 0.15);
  const catEdge = toScreen(-table.width * 0.2 + unit * 1.1, floorY, -table.depth * 0.15);
  cat.style.left = `${catSpot.x}px`;
  cat.style.top = `${catSpot.y}px`;
  cat.style.width = `${catEdge.x - catSpot.x}px`;

  // Steam: just above the mug's rim.
  const { mugTop } = room;
  // Steam: rising from just above the coffee, toward the back of the mug.
  const steamBase = [mugTop.x, mugTop.y + unit * 0.08, mugTop.z - unit * 0.05];
  const steamSpot = toScreen(...steamBase);
  const steamEdge = toScreen(steamBase[0] + unit * 0.3, steamBase[1], steamBase[2]);
  steam.style.left = `${steamSpot.x}px`;
  steam.style.top = `${steamSpot.y}px`;
  steam.style.width = `${steamEdge.x - steamSpot.x}px`;
}

// Place the cork board, post-it, pinned notes and framed art around the desk.
// The pink "spin me!" note always ends right at the top of the monitor, so its
// arrow points at the PC, and the post-it sits above it in the cork board.
function layoutWall() {
  const { unit, table } = room;
  const width = window.innerWidth;
  const card = intro.querySelector(".intro-card");
  card.style.zoom = 1; // measure at the design size
  const designWidth = card.offsetWidth;
  const designHeight = card.offsetHeight;

  const deskLeft = toScreen(-table.width / 2, 0, table.depth / 2);
  const deskRight = toScreen(table.width / 2, 0, table.depth / 2);
  const centerX = (deskLeft.x + deskRight.x) / 2;
  const monitorTop = toScreen(0, unit, unit * PC_FORWARD).y;

  // Size the post-it from the desk, but never wider than the screen allows or
  // so tall that it runs into the string lights.
  const maxShare = camera.aspect > 1 ? WALL.maxScreenShare.wide : WALL.maxScreenShare.tall;
  let scale = Math.min((deskRight.x - deskLeft.x) * WALL.postitToDesk, width * maxShare) / designWidth;
  scale = Math.min(scale, (monitorTop - WALL.lightsClearance) / (designHeight + WALL.noteDrop));
  const postitWidth = designWidth * scale;
  const postitHeight = designHeight * scale;
  const postitBottom = monitorTop - WALL.noteDrop * scale; // the pink note's bottom lands on the monitor
  const postitTop = postitBottom - postitHeight;
  landing.style.setProperty("--wall-scale", scale.toFixed(4));
  intro.style.left = `${centerX}px`;
  intro.style.top = `${postitTop}px`;
  // Resize with zoom rather than a scale transform, so the text is laid out and
  // drawn at its real size and stays crisp (a scaled transform blurs it).
  card.style.zoom = scale;

  // Cork board: wide and short around the post-it, its bottom tucked behind the desk.
  const boardWidth = Math.min(postitWidth / WALL.postitShare, width * 0.96);
  const boardTop = postitTop - postitHeight * WALL.boardPadTop;
  // Ends just above the back edge of the desk, so the desk looks flush with the wall.
  const deskBack = toScreen(0, 0, -table.depth / 2).y;
  const boardBottom = Math.max(deskBack - postitHeight * 0.06, postitBottom + postitHeight * 0.3);
  const boardLeft = centerX - boardWidth / 2;
  Object.assign(corkboard.style, {
    left: `${boardLeft}px`,
    top: `${boardTop}px`,
    width: `${boardWidth}px`,
    height: `${boardBottom - boardTop}px`,
  });

  // Pinned notes go in the space beside the post-it, only if they fit there.
  const sideSpace = (boardWidth - postitWidth) / 2;
  const noteWidth = WALL.noteWidth * scale;
  const notesFit = sideSpace > noteWidth * 1.15;
  for (const note of corkboard.querySelectorAll(".pinned-note")) {
    note.hidden = !notesFit;
    const inset = `${Math.max(0, (sideSpace - noteWidth) / 2)}px`;
    if (note.classList.contains("pink")) note.style.left = inset;
    else note.style.right = inset;
  }

  // Framed art either side of the board, hidden if it would run off screen.
  const artWidth = boardWidth * WALL.artShare;
  for (const [side, sign] of [["left", -1], ["right", 1]]) {
    const x = centerX + sign * (boardWidth / 2 + artWidth * 1.1);
    const art = wallArt[side];
    art.hidden = x - artWidth / 2 < 8 || x + artWidth / 2 > width - 8;
    Object.assign(art.style, {
      left: `${x}px`,
      top: `${boardTop + artWidth * (side === "left" ? 0.2 : 0.6)}px`,
      width: `${artWidth}px`,
    });
  }
  landing.classList.add("ready");
}

// ---------------------------------------------------------------------------
// Tweens: small helper so all timed animations run in the render loop.
// ---------------------------------------------------------------------------
const tweens = new Set();
const easeOutCubic = (t) => 1 - Math.pow(1 - t, 3);

function startTween(duration, onUpdate, onComplete) {
  tweens.add({ start: performance.now(), duration, onUpdate, onComplete });
}

function updateTweens(now) {
  for (const tween of tweens) {
    const t = Math.min((now - tween.start) / tween.duration, 1);
    tween.onUpdate(easeOutCubic(t));
    if (t === 1) {
      tweens.delete(tween);
      tween.onComplete?.();
    }
  }
}

// ---------------------------------------------------------------------------
// Spin: dragging left/right turns the PC; on release it keeps spinning with
// inertia, then settles into a slow auto-rotate.
// ---------------------------------------------------------------------------
let isDragging = false;
let autoRotateEnabled = true;
let angularVelocity = 0;  // rad/s
let spinDirection = 1;    // auto-rotate continues in the direction of the last throw
let lastPointerX = 0;
let lastPointerTime = 0;
const velocitySamples = [];

// Drags anywhere on the room spin the PC (except on the post-it's button).
landing.style.touchAction = "none"; // let touch drags spin the PC instead of scrolling

landing.addEventListener("pointerdown", (e) => {
  if (e.button !== 0 || !autoRotateEnabled || e.target.closest("button, a")) return;
  isDragging = true;
  lastPointerX = e.clientX;
  lastPointerTime = performance.now();
  velocitySamples.length = 0;
  landing.setPointerCapture(e.pointerId);
});

landing.addEventListener("pointermove", (e) => {
  if (!isDragging) return;
  const now = performance.now();
  const dt = (now - lastPointerTime) / 1000;
  if (dt <= 0) return;

  const turn = (e.clientX - lastPointerX) * POINTER_SENSITIVITY;
  if (model) model.rotation.y += turn;

  velocitySamples.push(turn / dt);
  if (velocitySamples.length > VELOCITY_SAMPLES) velocitySamples.shift();
  angularVelocity = velocitySamples.reduce((sum, v) => sum + v, 0) / velocitySamples.length;

  lastPointerX = e.clientX;
  lastPointerTime = now;
});

function endDrag(e) {
  if (!isDragging) return;
  isDragging = false;
  if (landing.hasPointerCapture(e.pointerId)) landing.releasePointerCapture(e.pointerId);
  if (angularVelocity !== 0) spinDirection = Math.sign(angularVelocity);
}
landing.addEventListener("pointerup", endDrag);
landing.addEventListener("pointercancel", endDrag);

function updateSpin(dt) {
  if (!model || isDragging || !autoRotateEnabled) return;

  if (Math.abs(angularVelocity) > MIN_ANGULAR_SPEED) {
    model.rotation.y += angularVelocity * dt;
    angularVelocity *= Math.exp(-INERTIA_DECAY * dt);
  } else {
    angularVelocity = 0;
    model.rotation.y += spinDirection * AUTO_ROTATE_SPEED * dt;
  }
}

// ---------------------------------------------------------------------------
// Render loop
// ---------------------------------------------------------------------------
let inDetailsView = false;
let lastFrameTime = performance.now();

function animate(now) {
  requestAnimationFrame(animate);
  const dt = Math.min((now - lastFrameTime) / 1000, 0.05); // clamp so tab switches don't cause jumps
  lastFrameTime = now;

  if (inDetailsView) return; // canvas is hidden; skip rendering

  updateTweens(now);
  updateSpin(dt);
  renderer.render(scene, camera);
}
requestAnimationFrame(animate);

// The post-it's size depends on its handwriting fonts, so lay out again once they've loaded.
document.fonts?.ready.then(() => frameScene());

window.addEventListener("resize", () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  renderer.setSize(window.innerWidth, window.innerHeight);
  frameScene();
});

// ---------------------------------------------------------------------------
// "Learn more" transition: turn the PC to face front, then zoom the whole room
// into its monitor and fade to white into the desktop. "Log Off" reverses it.
// ---------------------------------------------------------------------------
let isTransitioning = false;

// Fades the overlay to white, calls onPeak while fully white, then fades back out.
function runFade({ delay, duration, hold }, onPeak) {
  fadeOverlay.style.transitionDuration = `${duration}ms`;
  setTimeout(() => {
    fadeOverlay.classList.add("visible");
    setTimeout(() => {
      onPeak();
      fadeOverlay.classList.remove("visible");
    }, duration + hold);
  }, delay);
}

// Screen position (in pixels) of the monitor, so the room zooms toward it.
function monitorScreenPosition() {
  if (!model) return { x: window.innerWidth / 2, y: window.innerHeight / 2 };
  const box = new THREE.Box3().setFromObject(model);
  const point = new THREE.Vector3(
    THREE.MathUtils.lerp(box.min.x, box.max.x, SCREEN_POINT.x),
    THREE.MathUtils.lerp(box.min.y, box.max.y, SCREEN_POINT.y),
    THREE.MathUtils.lerp(box.min.z, box.max.z, SCREEN_POINT.z)
  ).project(camera);
  return {
    x: ((point.x + 1) / 2) * window.innerWidth,
    y: ((1 - point.y) / 2) * window.innerHeight,
  };
}

// Scales the whole landing (room + PC together) around the monitor.
function setRoomZoom(zoomedIn, { animate, easing = "ease-in" }) {
  landing.style.transition = animate ? `transform ${ROOM_ZOOM_DURATION}ms ${easing}` : "none";
  landing.style.transform = zoomedIn ? `scale(${ROOM_ZOOM_SCALE})` : "";
}

function zoomIntoMonitor() {
  const { x, y } = monitorScreenPosition();
  landing.style.transformOrigin = `${x}px ${y}px`;
  setRoomZoom(true, { animate: true, easing: "cubic-bezier(0.55, 0, 0.85, 0.35)" });
  runFade(FADE, () => {
    setDetailsView(true);
    openApp("about");
    openApp("tips"); // opened last so it starts on top
  });
}

function setDetailsView(visible) {
  inDetailsView = visible;
  document.body.classList.toggle("details-view", visible);
  desktop.hidden = !visible;
}

learnMoreButton.addEventListener("click", () => {
  if (isTransitioning) return;
  isTransitioning = true;
  angularVelocity = 0;
  autoRotateEnabled = false;

  // If the model hasn't loaded yet (slow connection), zoom toward the middle of the screen.
  if (!model) {
    zoomIntoMonitor();
    return;
  }
  const modelStart = model.quaternion.clone();
  startTween(
    RESET_DURATION,
    (t) => THREE.Quaternion.slerp(modelStart, initialModelQuaternion, model.quaternion, t),
    zoomIntoMonitor
  );
});

setLogOffHandler(() => {
  runFade(LOG_OFF_FADE, () => {
    closeAllApps();
    tweens.clear();
    if (model) model.quaternion.copy(initialModelQuaternion);

    // Come back out of the monitor: start zoomed in, then ease back to the room.
    setDetailsView(false);
    setRoomZoom(true, { animate: false });
    landing.getBoundingClientRect(); // apply the zoomed-in state before animating out
    setRoomZoom(false, { animate: true, easing: "cubic-bezier(0.15, 0.65, 0.35, 1)" });

    angularVelocity = 0;
    autoRotateEnabled = true;
    isTransitioning = false;
  });
});
