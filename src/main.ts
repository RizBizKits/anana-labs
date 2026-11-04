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
    <div class="meta">
      <p>Move the pointer — the eyes follow. Call <code>setPineappleMood("thinking")</code> from your chat UI.</p>
      <p class="status" id="status" aria-live="polite">Mood: idle</p>
    </div>
  </main>
`;

const host = document.querySelector<HTMLDivElement>("#bot")!;
const status = document.querySelector<HTMLParagraphElement>("#status")!;
const buttons = [...document.querySelectorAll<HTMLButtonElement>("[data-mood]")];

const avatar = mountPineappleAvatar(host, {
  mood: "idle",
  followPointer: true,
  label: "Pineapple",
});

function setMood(mood: Mood) {
  avatar.update({ mood });
  status.textContent = `Mood: ${mood}`;
  for (const btn of buttons) {
    btn.setAttribute("aria-pressed", String(btn.dataset.mood === mood));
  }
}

for (const btn of buttons) {
  btn.addEventListener("click", () => setMood(btn.dataset.mood as Mood));
}

declare global {
  interface Window {
    pineappleAvatar: PineappleAvatarHandle;
    setPineappleMood: (mood: Mood) => void;
  }
}
window.pineappleAvatar = avatar;
window.setPineappleMood = setMood;
