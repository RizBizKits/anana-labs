import "./style.css";
import { mountAvatar, type MountedAvatar } from "open-bot-avatar/dom";
import type { AvatarDefinition, AvatarMotion } from "open-bot-avatar";
import pineappleJson from "./pineapple.json" with { type: "json" };

const pineapple = pineappleJson as AvatarDefinition;

const MOODS: { id: AvatarMotion; label: string }[] = [
  { id: "idle", label: "Idle" },
  { id: "thinking", label: "Thinking" },
  { id: "happy", label: "Happy" },
];

const COLOR = "#f5c518";

const app = document.querySelector<HTMLDivElement>("#app")!;
app.innerHTML = `
  <main class="stage">
    <h1 class="brand">Pineapple</h1>
    <p class="lede">
      Open Bot Avatar built from your pineapple art — 3D volume, pointer gaze,
      and mood states for an AI companion on the web.
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
    <div class="meta">
      <p>Move the pointer — it looks at you. Wire <code>avatar.update({ mood })</code> from your chat UI.</p>
      <p class="status" id="status" aria-live="polite">Mood: idle</p>
    </div>
  </main>
`;

const host = document.querySelector<HTMLDivElement>("#bot")!;
const status = document.querySelector<HTMLParagraphElement>("#status")!;
const buttons = [...document.querySelectorAll<HTMLButtonElement>("[data-mood]")];

const avatar: MountedAvatar = mountAvatar(host, {
  definition: pineapple,
  color: COLOR,
  mood: "idle",
  followPointer: true,
  depth: 7,
  label: "Pineapple",
});

function setMood(mood: AvatarMotion) {
  avatar.update({ mood });
  status.textContent = `Mood: ${mood}`;
  for (const btn of buttons) {
    btn.setAttribute("aria-pressed", String(btn.dataset.mood === mood));
  }
}

for (const btn of buttons) {
  btn.addEventListener("click", () => setMood(btn.dataset.mood as AvatarMotion));
}

// Handy for embedding / console experiments while developing a host site.
declare global {
  interface Window {
    pineappleAvatar: MountedAvatar;
    setPineappleMood: (mood: AvatarMotion) => void;
  }
}
window.pineappleAvatar = avatar;
window.setPineappleMood = setMood;
