import "./style.css";
import {
  mountPineappleAvatar,
  MOODS,
  type Mood,
  type PineappleAvatarHandle,
} from "./pineappleAvatar";
import {
  loadSettings,
  previewHref,
  saveSettings,
  type AvatarSettings,
} from "./avatarSettings";

const initial = loadSettings();

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
        <span>Eye width <output id="eye-out">${initial.eyeThickness.toFixed(2)}</output></span>
        <input id="eye-thickness" type="range" min="0.25" max="2.5" step="0.05" value="${initial.eyeThickness}" />
      </label>
      <label class="slider">
        <span>Eye height <output id="eye-height-out">${initial.eyeHeight.toFixed(2)}</output></span>
        <input id="eye-height" type="range" min="0.25" max="2.5" step="0.05" value="${initial.eyeHeight}" />
      </label>
      <label class="slider">
        <span>Mouth width <output id="mouth-out">${initial.mouthThickness.toFixed(2)}</output></span>
        <input id="mouth-thickness" type="range" min="0.25" max="2.5" step="0.05" value="${initial.mouthThickness}" />
      </label>
      <label class="slider">
        <span>Blob wobble <output id="wobble-out">${initial.wobble.toFixed(2)}</output></span>
        <input id="wobble" type="range" min="0" max="2" step="0.05" value="${initial.wobble}" />
      </label>
    </div>
    <div class="meta">
      <p>Move the pointer — the eyes follow. Call <code>setPineappleMood("love")</code> from your chat UI.</p>
      <p class="status" id="status" aria-live="polite">Mood: idle</p>
      <p><a class="preview-link" id="preview-link" href="${previewHref(initial)}">Open mood preview</a></p>
    </div>
  </main>
`;

const host = document.querySelector<HTMLDivElement>("#bot")!;
const status = document.querySelector<HTMLParagraphElement>("#status")!;
const previewLink = document.querySelector<HTMLAnchorElement>("#preview-link")!;
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
  ...initial,
});

function readSettings(): AvatarSettings {
  return {
    eyeThickness: Number(eyeInput.value),
    eyeHeight: Number(eyeHeightInput.value),
    mouthThickness: Number(mouthInput.value),
    wobble: Number(wobbleInput.value),
  };
}

function setMood(mood: Mood) {
  avatar.update({ mood });
  status.textContent = `Mood: ${mood}`;
  for (const btn of buttons) {
    btn.setAttribute("aria-pressed", String(btn.dataset.mood === mood));
  }
}

function syncControls() {
  const settings = readSettings();
  eyeOut.value = settings.eyeThickness.toFixed(2);
  eyeHeightOut.value = settings.eyeHeight.toFixed(2);
  mouthOut.value = settings.mouthThickness.toFixed(2);
  wobbleOut.value = settings.wobble.toFixed(2);
  avatar.update(settings);
  saveSettings(settings);
  previewLink.href = previewHref(settings);
}

for (const btn of buttons) {
  btn.addEventListener("click", () => setMood(btn.dataset.mood as Mood));
}
eyeInput.addEventListener("input", syncControls);
eyeHeightInput.addEventListener("input", syncControls);
mouthInput.addEventListener("input", syncControls);
wobbleInput.addEventListener("input", syncControls);

saveSettings(initial);
previewLink.href = previewHref(initial);

declare global {
  interface Window {
    pineappleAvatar: PineappleAvatarHandle;
    setPineappleMood: (mood: Mood) => void;
  }
}
window.pineappleAvatar = avatar;
window.setPineappleMood = setMood;
