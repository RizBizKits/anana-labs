import "./style.css";
import {
  mountPineappleAvatar,
  type Mood,
  type PineappleAvatarHandle,
} from "./pineappleAvatar";

const MOODS: { id: Mood; label: string }[] = [
  { id: "idle", label: "Idle" },
  { id: "thinking", label: "Thinking" },
  { id: "happy", label: "Happy" },
];

const DEFAULT_EYE = 0.85;
const DEFAULT_MOUTH = 0.9;

const app = document.querySelector<HTMLDivElement>("#app")!;
app.innerHTML = `
  <main class="stage">
    <h1 class="brand">Pineapple</h1>
    <p class="lede">
      Your full-color pineapple art, with mood eyes for an AI companion —
      green leaves, grid vest, and sparkles preserved.
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
    <div class="sliders" role="group" aria-label="Face width">
      <label class="slider">
        <span>Eye width <output id="eye-out">${DEFAULT_EYE.toFixed(2)}</output></span>
        <input id="eye-thickness" type="range" min="0.25" max="2.5" step="0.05" value="${DEFAULT_EYE}" />
      </label>
      <label class="slider">
        <span>Mouth width <output id="mouth-out">${DEFAULT_MOUTH.toFixed(2)}</output></span>
        <input id="mouth-thickness" type="range" min="0.25" max="2.5" step="0.05" value="${DEFAULT_MOUTH}" />
      </label>
    </div>
    <div class="meta">
      <p>Move the pointer — the eyes follow. Call <code>setPineappleMood("thinking")</code> from your chat UI.</p>
      <p class="status" id="status" aria-live="polite">Mood: idle</p>
    </div>
  </main>
`;

const host = document.querySelector<HTMLDivElement>("#bot")!;
const status = document.querySelector<HTMLParagraphElement>("#status")!;
const buttons = [...document.querySelectorAll<HTMLButtonElement>("[data-mood]")];
const eyeInput = document.querySelector<HTMLInputElement>("#eye-thickness")!;
const mouthInput = document.querySelector<HTMLInputElement>("#mouth-thickness")!;
const eyeOut = document.querySelector<HTMLOutputElement>("#eye-out")!;
const mouthOut = document.querySelector<HTMLOutputElement>("#mouth-out")!;

const avatar = mountPineappleAvatar(host, {
  mood: "idle",
  followPointer: true,
  label: "Pineapple",
  eyeThickness: DEFAULT_EYE,
  mouthThickness: DEFAULT_MOUTH,
});

function setMood(mood: Mood) {
  avatar.update({ mood });
  status.textContent = `Mood: ${mood}`;
  for (const btn of buttons) {
    btn.setAttribute("aria-pressed", String(btn.dataset.mood === mood));
  }
}

function syncThickness() {
  const eyeThickness = Number(eyeInput.value);
  const mouthThickness = Number(mouthInput.value);
  eyeOut.value = eyeThickness.toFixed(2);
  mouthOut.value = mouthThickness.toFixed(2);
  avatar.update({ eyeThickness, mouthThickness });
}

for (const btn of buttons) {
  btn.addEventListener("click", () => setMood(btn.dataset.mood as Mood));
}
eyeInput.addEventListener("input", syncThickness);
mouthInput.addEventListener("input", syncThickness);

declare global {
  interface Window {
    pineappleAvatar: PineappleAvatarHandle;
    setPineappleMood: (mood: Mood) => void;
  }
}
window.pineappleAvatar = avatar;
window.setPineappleMood = setMood;
