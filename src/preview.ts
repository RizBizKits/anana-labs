import "./preview.css";
import { mountPineappleAvatar, MOODS } from "./pineappleAvatar";

const app = document.querySelector<HTMLDivElement>("#app")!;
app.innerHTML = `
  <main class="preview" aria-label="Pineapple moods">
    ${MOODS.map(
      (m) => `
      <div class="preview__cell" data-mood="${m.id}">
        <div class="preview__bot" id="bot-${m.id}"></div>
      </div>
    `,
    ).join("")}
  </main>
`;

for (const m of MOODS) {
  const host = document.querySelector<HTMLDivElement>(`#bot-${m.id}`)!;
  mountPineappleAvatar(host, {
    mood: m.id,
    followPointer: false,
    label: `Pineapple — ${m.label}`,
    eyeThickness: 0.85,
    eyeHeight: 1,
    mouthThickness: 0.9,
    wobble: 0.55,
  });
}
