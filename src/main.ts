import "./style.css";
import {
  mountPineappleAvatar,
  MOODS,
  type Mood,
  type PineappleAvatarHandle,
} from "./pineappleAvatar";

const DEFAULT_EYE = 0.85;
const DEFAULT_EYE_HEIGHT = 1;
const DEFAULT_MOUTH = 0.9;
const DEFAULT_WOBBLE = 0.7;

const app = document.querySelector<HTMLDivElement>("#app")!;
app.innerHTML = `
  <main class="stage">
    <h1 class="brand">Pineapple</h1>
    <p class="lede">
      Your full-color pineapple art with expressive moods, width controls, and a
      jelly wobble for an AI companion.
    </p>
    <div class="avatar-shell" aria-label="Pineapple avatar preview">
      <div id="bot"></div>
    </div>
    <div class="controls" role="group" aria-label="Mood">
      ${MOODS.map(
        (m, i) =>
          `<button type="button" data-mood="${m.id}" aria-pressed="${i === 0}">${m.label}</button>`,
      ).join("")}
    </div>
    <div class="sliders" role="group" aria-label="Avatar controls">
      <label class="slider">
        <span>Eye width <output id="eye-out">${DEFAULT_EYE.toFixed(2)}</output></span>
        <input id="eye-thickness" type="range" min="0.25" max="2.5" step="0.05" value="${DEFAULT_EYE}" />
      </label>
      <label class="slider">
        <span>Eye height <output id="eye-height-out">${DEFAULT_EYE_HEIGHT.toFixed(2)}</output></span>
        <input id="eye-height" type="range" min="0.25" max="2.5" step="0.05" value="${DEFAULT_EYE_HEIGHT}" />
      </label>
      <label class="slider">
        <span>Mouth width <output id="mouth-out">${DEFAULT_MOUTH.toFixed(2)}</output></span>
        <input id="mouth-thickness" type="range" min="0.25" max="2.5" step="0.05" value="${DEFAULT_MOUTH}" />
      </label>
      <label class="slider">
        <span>Blob wobble <output id="wobble-out">${DEFAULT_WOBBLE.toFixed(2)}</output></span>
        <input id="wobble" type="range" min="0" max="2" step="0.05" value="${DEFAULT_WOBBLE}" />
      </label>
    </div>
    <div class="meta">
      <p>Move the pointer — the eyes follow. Call <code>setPineappleMood("love")</code> from your chat UI.</p>
      <p class="status" id="status" aria-live="polite">Mood: idle</p>
      <p><a class="preview-link" href="/preview.html">Open mood preview</a></p>
    </div>
  </main>
`;

const host = document.querySelector<HTMLDivElement>("#bot")!;
const status = document.querySelector<HTMLParagraphElement>("#status")!;
const buttons = [...document.querySelectorAll<HTMLButtonElement>("[data-mood]")];
const eyeInput = document.querySelector<HTMLInputElement>("#eye-thickness")!;
const eyeHeightInput = document.querySelector<HTMLInputElement>("#eye-height")!;
const mouthInput = document.querySelector<HTMLInputElement>("#mouth-thickness")!;
const wobbleInput = document.querySelector<HTMLInputElement>("#wobble")!;
const eyeOut = document.querySelector<HTMLOutputElement>("#eye-out")!;
const eyeHeightOut = document.querySelector<HTMLOutputElement>("#eye-height-out")!;
const mouthOut = document.querySelector<HTMLOutputElement>("#mouth-out")!;
const wobbleOut = document.querySelector<HTMLOutputElement>("#wobble-out")!;

const avatar = mountPineappleAvatar(host, {
  mood: "idle",
  followPointer: true,
  label: "Pineapple",
  eyeThickness: DEFAULT_EYE,
  eyeHeight: DEFAULT_EYE_HEIGHT,
  mouthThickness: DEFAULT_MOUTH,
  wobble: DEFAULT_WOBBLE,
});

function setMood(mood: Mood) {
  avatar.update({ mood });
  status.textContent = `Mood: ${mood}`;
  for (const btn of buttons) {
    btn.setAttribute("aria-pressed", String(btn.dataset.mood === mood));
  }
}

function syncControls() {
  const eyeThickness = Number(eyeInput.value);
  const eyeHeight = Number(eyeHeightInput.value);
  const mouthThickness = Number(mouthInput.value);
  const wobble = Number(wobbleInput.value);
  eyeOut.value = eyeThickness.toFixed(2);
  eyeHeightOut.value = eyeHeight.toFixed(2);
  mouthOut.value = mouthThickness.toFixed(2);
  wobbleOut.value = wobble.toFixed(2);
  avatar.update({ eyeThickness, eyeHeight, mouthThickness, wobble });
}

for (const btn of buttons) {
  btn.addEventListener("click", () => setMood(btn.dataset.mood as Mood));
}
eyeInput.addEventListener("input", syncControls);
eyeHeightInput.addEventListener("input", syncControls);
mouthInput.addEventListener("input", syncControls);
wobbleInput.addEventListener("input", syncControls);

declare global {
  interface Window {
    pineappleAvatar: PineappleAvatarHandle;
    setPineappleMood: (mood: Mood) => void;
  }
}
window.pineappleAvatar = avatar;
window.setPineappleMood = setMood;
