//Import the THREE.js library
import * as THREE from "https://cdn.skypack.dev/three@0.129.0/build/three.module.js";
// To allow for the camera to move around the scene
import { OrbitControls } from "https://cdn.skypack.dev/three@0.129.0/examples/jsm/controls/OrbitControls.js";
// To allow for importing the .gltf file
import { GLTFLoader } from "https://cdn.skypack.dev/three@0.129.0/examples/jsm/loaders/GLTFLoader.js";

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.001, 10000);

let object;
let controls;

//Set which object to render
let objToRender = 'pc';

//Instantiate a loader for the .gltf file
const loader = new GLTFLoader();

//Instantiate a new renderer and set its size
const renderer = new THREE.WebGLRenderer({ alpha: true });
renderer.setSize(window.innerWidth, window.innerHeight);

//Add the renderer to the DOM
document.getElementById("container3D").appendChild(renderer.domElement);

// create a full-screen white overlay used for the fade in/out
const fadeOverlay = document.createElement('div');
fadeOverlay.className = 'fade-overlay';
document.body.appendChild(fadeOverlay);

// move runFade to module scope so click handler can call it
function runFade({ delay = 900, fadeDuration = 900, hold = 150, onComplete = null } = {}) {
    if (!fadeOverlay) return;
    fadeOverlay.style.transition = `opacity ${fadeDuration}ms ease`;
    fadeOverlay.classList.remove('visible');
    setTimeout(() => {
      fadeOverlay.classList.add('visible');
      setTimeout(() => {
        fadeOverlay.classList.remove('visible');
        // call onComplete after fade-out
        if (onComplete) onComplete();
      }, fadeDuration + hold);
    }, delay);
}

//Default camera distance (will be overridden after model loads)
camera.position.z = 5;

//Add lights to the scene
const topLight = new THREE.DirectionalLight(0xffffff, 1);
topLight.position.set(500, 500, 500);
topLight.castShadow = true;
scene.add(topLight);

const ambientLight = new THREE.AmbientLight(0x333333, 5);
scene.add(ambientLight);

// Enable OrbitControls for interactive view
controls = new OrbitControls(camera, renderer.domElement);
controls.minDistance = 0.1;
controls.maxDistance = 1000;
// disable panning (right-click won't pan); make right-click rotate instead
controls.enablePan = false;
controls.mouseButtons.RIGHT = THREE.MOUSE.ROTATE;
controls.update();

//Load the file
loader.load(
  `./models/${objToRender}/scene.gltf`,
  function (gltf) {
    object = gltf.scene;
    scene.add(object);

    // center and frame the model
    const box = new THREE.Box3().setFromObject(object);
    const size = box.getSize(new THREE.Vector3()).length();
    const center = box.getCenter(new THREE.Vector3());
    object.position.sub(center); // move model to origin

    // make the initial camera closer: reduce the framing factor (<1 = closer)
    const framingFactor = 0.7; // tune this (smaller → closer)
    const minDistance = 0.1;   // allow the camera to get very close
    const distance = Math.max(size * framingFactor, minDistance);

    camera.position.set(0, 0, distance);
    camera.near = Math.max(0.001, distance / 1000);
    camera.far = Math.max(50, distance * 50);
    camera.updateProjectionMatrix();

    if (controls) { controls.target.set(0, 0, 0); controls.update(); }

    // --- NEW: rotate object so its "front" faces the camera, and place camera centered on that front ---
    // we assume the model's local front is either +Z or -Z; pick the one that needs the smaller rotation.
    const worldCenter = new THREE.Vector3(0, 0, 0); // object is centered at origin after object.position.sub(center)
    const camPos = camera.position.clone();
    const desiredDir = camPos.clone().sub(worldCenter).normalize(); // direction from object to camera

    const localFrontPlus = new THREE.Vector3(0, 0, 1).applyQuaternion(object.quaternion).normalize();
    const localFrontMinus = new THREE.Vector3(0, 0, -1).applyQuaternion(object.quaternion).normalize();

    // choose which local axis (+Z or -Z) is closer to desiredDir
    const dotPlus = localFrontPlus.dot(desiredDir);
    const dotMinus = localFrontMinus.dot(desiredDir);
    const chosenFront = dotPlus >= dotMinus ? localFrontPlus : localFrontMinus;
    const chosenLocalAxis = dotPlus >= dotMinus ? new THREE.Vector3(0, 0, 1) : new THREE.Vector3(0, 0, -1);

    // compute rotation quaternion that rotates chosenFront -> desiredDir (in world space)
    const q = new THREE.Quaternion().setFromUnitVectors(chosenFront, desiredDir);
    // apply that rotation in world space (premultiply)
    object.quaternion.premultiply(q);

    // now reposition the camera so it sits on the chosen front axis at the same distance from object center
    const newFrontWorld = chosenLocalAxis.clone().applyQuaternion(object.quaternion).normalize();
    camera.position.copy(worldCenter.clone().add(newFrontWorld.multiplyScalar(distance)));

    // ensure camera and controls look at object center
    camera.lookAt(worldCenter);
    if (controls) {
      controls.target.copy(worldCenter);
      controls.update();
    }
    // --- END NEW ---

    // store initial camera + object orientation so the click can reset them
    window.__initialCameraState = {
      position: camera.position.clone(),
      quaternion: camera.quaternion.clone(),
      target: controls ? controls.target.clone() : new THREE.Vector3(0, 0, 0)
    };
    window.__initialObjectQuaternion = object.quaternion.clone();

    console.log('Model loaded and aligned:', gltf);

    // After the camera has been moved to its initial position, wait then fade to white and back.
    // Timings: delay before starting, fadeDuration for each fade, and hold during white.
    function runFade({ delay = 900, fadeDuration = 700, hold = 150 } = {}) {
      if (!fadeOverlay) return;
      fadeOverlay.style.transition = `opacity ${fadeDuration}ms ease`;

      // ensure overlay starts hidden
      fadeOverlay.classList.remove('visible');

      setTimeout(() => {
        // fade to white
        fadeOverlay.classList.add('visible');

        // after fade in + hold, fade back out
        setTimeout(() => {
          fadeOverlay.classList.remove('visible');

          // keep overlay in DOM for reuse (don't remove)
          // if you want to fully remove, recreate it before next fade instead
        }, fadeDuration + hold);

      }, delay);
    }

  },
  function (xhr) {
    console.log((xhr.loaded / xhr.total * 100) + '% loaded');
  },
  function (error) {
    console.error(error);
  }
);

// auto-rotate + inertia setup (improved smoothing & preserved direction)
let isUserInteracting = false;
let autoRotateTimeout = null;
const autoRotateDelay = 0;      // ms after interaction before idle baseline applies
const autoRotateSpeed = 0.3;       // radians per second (baseline when idle)
let angularVelocity = 0;           // current angular velocity in radians/sec (inertia)
const inertiaDecay = 3.0;          // exponential decay rate (per second)
const minAngularSpeed = 0.01;      // below this we switch to baseline
const velWindow = 6;               // number of recent samples to average
const velSamples = [];
let lastReleasedSign = 1;          // direction to use for baseline after inertia ends
let lastFrameTime = performance.now();
let autoRotateEnabled = true;  // add this flag to control auto-rotation

// --- new: camera tween state for smooth reset ---
let cameraTweenActive = false;
let cameraTweenStart = 0;
const cameraTweenDuration = 600; // ms, adjust for speed
let cameraStartPos = new THREE.Vector3();
let cameraEndPos = new THREE.Vector3();
let cameraStartQuat = new THREE.Quaternion();
let cameraEndQuat = new THREE.Quaternion();
let cameraStartTarget = new THREE.Vector3();
let cameraEndTarget = new THREE.Vector3();

// --- new: object tween state for smooth rotation reset ---
let objectTweenActive = false;
let objectTweenStart = 0;
const objectTweenDuration = cameraTweenDuration; // keep same duration as camera
let objectStartQuat = new THREE.Quaternion();
let objectEndQuat = new THREE.Quaternion();

let isZooming = false;
let wheelTimeout = null;
const WHEEL_IGNORE_MS = 150;

const dom = renderer.domElement;

// pointer-based sampling (left-button only)
let isDragging = false;
let lastMouseX = 0;
let lastSampleTime = null;
const pointerSensitivity = 0.008; // pixels -> radians factor (tweak to taste)

// pointer down (only start sampling on left button)
dom.addEventListener('pointerdown', (e) => {
  if (e.button !== 0) return; // only left button for rotation sampling
  isUserInteracting = true;
  isDragging = true;
  if (autoRotateTimeout) clearTimeout(autoRotateTimeout);
  lastMouseX = e.clientX;
  lastSampleTime = performance.now();
  velSamples.length = 0;
  dom.setPointerCapture?.(e.pointerId);
});

// pointer move sampling while dragging
dom.addEventListener('pointermove', (e) => {
  if (!isDragging) return;
  const now = performance.now();
  const dt = (now - lastSampleTime) / 1000;
  if (dt <= 0) return;
  const dx = e.clientX - lastMouseX;
  // convert pixel delta to radians/sec — no NEGATE so inertia goes opposite the mouse (follows the PC movement)
  const v = (dx * pointerSensitivity) / dt;
  velSamples.push(v);
  if (velSamples.length > velWindow) velSamples.shift();
  // update running average immediately so we have up-to-date velocity
  const sum = velSamples.reduce((s, x) => s + x, 0);
  angularVelocity = sum / velSamples.length;
  lastMouseX = e.clientX;
  lastSampleTime = now;
});

// pointer up (finalize inertia). Works regardless of pointer captured.
// FIX: corrected typo -> addEventListener
dom.addEventListener('pointerup', (e) => {
  if (e.button !== 0) {
    dom.releasePointerCapture?.(e.pointerId);
    return;
  }
  isDragging = false;
  dom.releasePointerCapture?.(e.pointerId);

  // preserve direction and apply inertia immediately
  if (Math.abs(angularVelocity) > 0) lastReleasedSign = Math.sign(angularVelocity);

  // end interaction immediately so inertia applies next frame
  isUserInteracting = false;
});

// wheel: zoom only, do NOT change or sample angular momentum
dom.addEventListener('wheel', (e) => {
  isZooming = true;
  if (wheelTimeout) clearTimeout(wheelTimeout);
  wheelTimeout = setTimeout(() => { isZooming = false; }, WHEEL_IGNORE_MS);

  // reset sampling baseline so zoom won't create spurious deltas
  lastSampleTime = performance.now();
  lastMouseX = lastMouseX; // no-op; keep momentum untouched

  if (autoRotateTimeout) clearTimeout(autoRotateTimeout);
  autoRotateTimeout = setTimeout(() => { isUserInteracting = false; }, autoRotateDelay);
});

// --- add: zoom tween state & startZoom function (place near camera tween state) ---
let zoomTweenActive = false;
let zoomTweenStart = 0;
let zoomTweenDuration = 800; // ms default
let zoomStartPos = new THREE.Vector3();
let zoomEndPos = new THREE.Vector3();

const DEFAULT_ZOOM_DISTANCE = 0.6; // units to move closer by default
const DEFAULT_ZOOM_DURATION = 800; // ms default
const DEFAULT_ZOOM_DELAY = 0; // ms default

function startZoom(distance = DEFAULT_ZOOM_DISTANCE, duration = DEFAULT_ZOOM_DURATION, delay = DEFAULT_ZOOM_DELAY) {
  if (!camera) return;
  const target = controls ? controls.target.clone() : new THREE.Vector3(0, 0, 0);
  const dir = target.clone().sub(camera.position);
  const dist = dir.length();
  if (dist <= 0.001) return;
  dir.normalize();

  // clamp so we don't pass through the target
  const clamped = Math.min(distance, Math.max(0, dist - 0.05));

  zoomStartPos.copy(camera.position);
  zoomEndPos.copy(camera.position).add(dir.multiplyScalar(clamped));

  zoomTweenDuration = Math.max(1, duration);
  zoomTweenStart = performance.now() + Math.max(0, delay);
  zoomTweenActive = true;
}
window.startZoom = startZoom; // optional global access

//Render the scene
function animate() {
  requestAnimationFrame(animate);

  const now = performance.now();
  const dt = Math.min((now - lastFrameTime) / 1000, 0.05); // clamp dt
  lastFrameTime = now;

  // camera tweening (smoothly interpolate position/quaternion/controls.target)
  if (cameraTweenActive) {
    const t = Math.min((now - cameraTweenStart) / cameraTweenDuration, 1);
    const ease = 1 - Math.pow(1 - t, 3); // easeOutCubic

    camera.position.lerpVectors(cameraStartPos, cameraEndPos, ease);
    THREE.Quaternion.slerp(cameraStartQuat, cameraEndQuat, camera.quaternion, ease);
    controls.target.lerpVectors(cameraStartTarget, cameraEndTarget, ease);

    if (t >= 1) {
      cameraTweenActive = false;
      camera.position.copy(cameraEndPos);
      camera.quaternion.copy(cameraEndQuat);
      controls.target.copy(cameraEndTarget);
      camera.updateProjectionMatrix();
    }
  }

  // object tweening (smoothly slerp object orientation)
  if (object && objectTweenActive) {
    const tObj = Math.min((now - objectTweenStart) / objectTweenDuration, 1);
    const easeObj = 1 - Math.pow(1 - tObj, 3);
    THREE.Quaternion.slerp(objectStartQuat, objectEndQuat, object.quaternion, easeObj);

    if (tObj >= 1) {
      objectTweenActive = false;
      object.quaternion.copy(objectEndQuat);
    }
  }

  // **zoom tweening – this was missing**
  if (zoomTweenActive) {
    const tZoom = Math.min((now - zoomTweenStart) / zoomTweenDuration, 1);
    const easeZoom = 1 - Math.pow(1 - tZoom, 3); // easeOutCubic
    camera.position.lerpVectors(zoomStartPos, zoomEndPos, easeZoom);

    if (tZoom >= 1) {
      zoomTweenActive = false;
      camera.position.copy(zoomEndPos);
    }
  }

  if (object) {
    if (!isUserInteracting && !objectTweenActive && !cameraTweenActive) {  // remove !rotationStopped
      if (Math.abs(angularVelocity) > minAngularSpeed) {
        // apply inertia (angularVelocity is in radians/sec)
        object.rotation.y += angularVelocity * dt;
        // exponential decay
        angularVelocity *= Math.exp(-inertiaDecay * dt);
        if (Math.abs(angularVelocity) < minAngularSpeed) {
          angularVelocity = 0;
        }
      } else if (autoRotateEnabled) {  // add this check for auto-rotation
        object.rotation.y += lastReleasedSign * autoRotateSpeed * dt;
      }
    }
  }

  controls.update();
  renderer.render(scene, camera);
}

//Handle window resize
window.addEventListener("resize", function () {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});

//Start the 3D rendering
animate();

// add click handler to reset camera + object orientation to initial state
// FIX: correct selector for the Learn More button
const learnMoreEl = document.querySelector('.b1') || document.querySelector('#learn-more');
if (learnMoreEl) {
  learnMoreEl.style.cursor = 'pointer';
  learnMoreEl.addEventListener('click', (e) => {
    e.preventDefault();
    const s = window.__initialCameraState;
    if (!s) return;

    // stop conflicting inertia/interaction
    angularVelocity = 0;
    isUserInteracting = false;
    autoRotateEnabled = false;  // add this to stop auto-rotation after click

    // setup camera tween
    cameraStartPos.copy(camera.position);
    cameraEndPos.copy(s.position);
    cameraStartQuat.copy(camera.quaternion);
    cameraEndQuat.copy(s.quaternion);
    cameraStartTarget.copy(controls.target);
    cameraEndTarget.copy(s.target || new THREE.Vector3(0, 0, 0));
    cameraTweenStart = performance.now();
    cameraTweenActive = true;

    // setup object tween if we have stored initial object quaternion
    if (object && window.__initialObjectQuaternion) {
      objectStartQuat.copy(object.quaternion);
      objectEndQuat.copy(window.__initialObjectQuaternion);
      objectTweenStart = performance.now();
      objectTweenActive = true;

      // call the module-scoped runFade with onComplete to clear after fade
      runFade({ 
        delay: 500, 
        fadeDuration: 700, 
        hold: 100,
        onComplete: () => {
          // hide the 3D model and text/content (instead of remove for reversibility)
          if (object) scene.remove(object);
          const header = document.querySelector('header');
          if (header) header.style.display = 'none';
          const main = document.querySelector('main');
          if (main) main.style.display = 'none';
            
          // create and show the back button
          const backButton = document.createElement('button');
          backButton.className = 'back-button';
          backButton.textContent = 'Back';
          backButton.addEventListener('click', () => {
            // restore original state
            if (object) scene.add(object);
            if (header) header.style.display = '';
            if (main) main.style.display = '';
            
            // reset camera and object to initial state
            const s = window.__initialCameraState;
            if (s) {
              camera.position.copy(s.position);
              camera.quaternion.copy(s.quaternion);
              controls.target.copy(s.target);
              controls.update();
            }
            if (object && window.__initialObjectQuaternion) {
              object.quaternion.copy(window.__initialObjectQuaternion);
            }
            
            // re-enable rotation
            autoRotateEnabled = true;
            angularVelocity = 0;
            isUserInteracting = false;
            
            // hide the back button
            backButton.classList.remove('visible');
            setTimeout(() => backButton.remove(), 300); // remove after fade
          });
          document.body.appendChild(backButton);
          // show with a slight delay
          setTimeout(() => backButton.classList.add('visible'), 100);
        }
      });
      
      // delay zoom until camera tween completes
      setTimeout(() => {
        startZoom(0.5, 800, 0); // zoom in after camera finishes
      }, cameraTweenDuration);
    }
  });
}