import * as THREE from "https://cdn.skypack.dev/three@0.129.0/build/three.module.js";
import { OrbitControls } from "https://cdn.skypack.dev/three@0.129.0/examples/jsm/controls/OrbitControls.js";
import { GLTFLoader } from "https://cdn.skypack.dev/three@0.129.0/examples/jsm/loaders/GLTFLoader.js";
import { openApp, closeAllApps, setLogOffHandler } from "./desktop.js";

// ---------------------------------------------------------------------------
// Config
// ---------------------------------------------------------------------------
const MODEL_PATH = "models/pc/scene.gltf";
const FRAMING_FACTOR = 0.7;         // initial camera distance as a fraction of model size (smaller = closer)
const MODEL_DROP = 0.08;            // how far below center the model sits, as a fraction of its size

const AUTO_ROTATE_SPEED = 0.3;      // rad/s while idle
const INERTIA_DECAY = 3.0;          // exponential decay rate of spin velocity (per second)
const MIN_ANGULAR_SPEED = 0.01;     // below this, inertia stops and auto-rotate resumes
const VELOCITY_SAMPLES = 6;         // pointer samples averaged to compute release velocity
const POINTER_SENSITIVITY = 0.008;  // pixels -> radians

const RESET_DURATION = 600;         // ms to tween camera/model back to the starting view
const ZOOM_DISTANCE = 0.5;          // units to move toward the model after the reset
const ZOOM_DURATION = 800;          // ms
const FADE = { delay: 500, duration: 700, hold: 100 };
const LOG_OFF_FADE = { delay: 0, duration: 500, hold: 100 };

// ---------------------------------------------------------------------------
// DOM
// ---------------------------------------------------------------------------
const container = document.getElementById("container3D");
const learnMoreButton = document.getElementById("learn-more");
const desktop = document.getElementById("desktop");
const fadeOverlay = document.getElementById("fade-overlay");

// ---------------------------------------------------------------------------
// Scene setup
// ---------------------------------------------------------------------------
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.001, 10000);
camera.position.z = 5; // placeholder until the model loads and we frame it

const renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.shadowMap.enabled = true;
renderer.setSize(window.innerWidth, window.innerHeight);
container.appendChild(renderer.domElement);

const topLight = new THREE.DirectionalLight(0xffffff, 1);
topLight.position.set(500, 500, 500); // repositioned to fit the model once it loads
topLight.castShadow = true;
topLight.shadow.mapSize.set(1024, 1024);
topLight.shadow.radius = 6; // soften the shadow edge
scene.add(topLight);
scene.add(new THREE.AmbientLight(0x333333, 5));

// Orbit around the model; panning disabled so the target always stays at the origin.
const controls = new OrbitControls(camera, renderer.domElement);
controls.minDistance = 0.1;
controls.maxDistance = 1000;
controls.enablePan = false;
controls.mouseButtons.RIGHT = THREE.MOUSE.ROTATE;

let model = null;
let initialCameraPosition = null;
let initialModelQuaternion = null;

new GLTFLoader().load(
  MODEL_PATH,
  (gltf) => {
    // Wrap the model in a pivot at its visual center so it spins in place
    // rather than around the file's origin.
    const box = new THREE.Box3().setFromObject(gltf.scene);
    const dimensions = box.getSize(new THREE.Vector3());
    const size = dimensions.length();
    gltf.scene.position.sub(box.getCenter(new THREE.Vector3()));
    gltf.scene.traverse((child) => {
      if (child.isMesh) child.castShadow = true;
    });
    model = new THREE.Group();
    model.add(gltf.scene);
    model.position.y = -size * MODEL_DROP; // sit a little low so it clears the intro text

    addShadowFloor(model.position.y - dimensions.y / 2, size);

    // Frame the camera in front of the model (+Z).
    // Pull back on narrow (portrait) screens so the whole model still fits horizontally.
    const portraitScale = Math.max(1, 1 / camera.aspect);
    const distance = Math.max(size * FRAMING_FACTOR * portraitScale, controls.minDistance);
    camera.position.set(0, 0, distance);
    camera.near = Math.max(0.001, distance / 1000);
    camera.far = Math.max(50, distance * 50);
    camera.updateProjectionMatrix();
    controls.update();

    initialCameraPosition = camera.position.clone();
    initialModelQuaternion = model.quaternion.clone();

    scene.add(model);
  },
  undefined,
  (error) => console.error("Failed to load model:", error)
);

// An invisible floor that only shows the model's shadow, so it looks grounded
// instead of floating. Also fits the light's shadow camera around the model.
function addShadowFloor(floorY, size) {
  const floor = new THREE.Mesh(
    new THREE.PlaneGeometry(size * 4, size * 4),
    new THREE.ShadowMaterial({ opacity: 0.45 })
  );
  floor.rotation.x = -Math.PI / 2;
  floor.position.y = floorY;
  floor.receiveShadow = true;
  scene.add(floor);

  topLight.position.setScalar(size); // same direction as before, just scaled to the model
  const shadowCamera = topLight.shadow.camera;
  shadowCamera.left = shadowCamera.bottom = -size;
  shadowCamera.right = shadowCamera.top = size;
  shadowCamera.near = 0.1;
  shadowCamera.far = size * 4;
  shadowCamera.updateProjectionMatrix();
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
// Spin: dragging records horizontal velocity; on release the model keeps
// spinning with inertia, then settles into a slow auto-rotate.
// ---------------------------------------------------------------------------
let isDragging = false;
let autoRotateEnabled = true;
let angularVelocity = 0;  // rad/s
let spinDirection = 1;    // auto-rotate continues in the direction of the last throw
let lastPointerX = 0;
let lastPointerTime = 0;
const velocitySamples = [];

const canvas = renderer.domElement;

canvas.addEventListener("pointerdown", (e) => {
  if (e.button !== 0) return;
  isDragging = true;
  lastPointerX = e.clientX;
  lastPointerTime = performance.now();
  velocitySamples.length = 0;
  canvas.setPointerCapture(e.pointerId);
});

canvas.addEventListener("pointermove", (e) => {
  if (!isDragging) return;
  const now = performance.now();
  const dt = (now - lastPointerTime) / 1000;
  if (dt <= 0) return;

  velocitySamples.push(((e.clientX - lastPointerX) * POINTER_SENSITIVITY) / dt);
  if (velocitySamples.length > VELOCITY_SAMPLES) velocitySamples.shift();
  angularVelocity = velocitySamples.reduce((sum, v) => sum + v, 0) / velocitySamples.length;

  lastPointerX = e.clientX;
  lastPointerTime = now;
});

function endDrag(e) {
  if (!isDragging) return;
  isDragging = false;
  if (canvas.hasPointerCapture(e.pointerId)) canvas.releasePointerCapture(e.pointerId);
  if (angularVelocity !== 0) spinDirection = Math.sign(angularVelocity);
}
canvas.addEventListener("pointerup", endDrag);
canvas.addEventListener("pointercancel", endDrag);

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
  controls.update();
  renderer.render(scene, camera);
}
requestAnimationFrame(animate);

window.addEventListener("resize", () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});

// ---------------------------------------------------------------------------
// "Learn more" transition: reset the view, zoom in, fade to white, then show
// the desktop. "Log Off" in the start menu fades back to the starting state.
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

function zoomTowardTarget(distance, duration) {
  const start = camera.position.clone();
  const toTarget = controls.target.clone().sub(start);
  const step = Math.min(distance, Math.max(0, toTarget.length() - 0.05)); // never pass through the target
  const end = start.clone().add(toTarget.normalize().multiplyScalar(step));
  startTween(duration, (t) => camera.position.lerpVectors(start, end, t));
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
  controls.enabled = false;

  // If the model hasn't loaded yet (slow connection), skip the zoom and just fade.
  if (model) {
    const cameraStart = camera.position.clone();
    const modelStart = model.quaternion.clone();
    startTween(
      RESET_DURATION,
      (t) => {
        camera.position.lerpVectors(cameraStart, initialCameraPosition, t);
        THREE.Quaternion.slerp(modelStart, initialModelQuaternion, model.quaternion, t);
      },
      () => zoomTowardTarget(ZOOM_DISTANCE, ZOOM_DURATION)
    );
  }

  runFade(FADE, () => {
    setDetailsView(true);
    openApp("about");
    openApp("tips"); // opened last so it starts on top
  });
});

setLogOffHandler(() => {
  runFade(LOG_OFF_FADE, () => {
    closeAllApps();
    tweens.clear();
    if (model) {
      camera.position.copy(initialCameraPosition);
      model.quaternion.copy(initialModelQuaternion);
    }

    angularVelocity = 0;
    autoRotateEnabled = true;
    controls.enabled = true;
    isTransitioning = false;

    setDetailsView(false);
  });
});
