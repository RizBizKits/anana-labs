import "./preview.css";
import { mountPineappleAvatar, MOODS } from "./pineappleAvatar";
import { loadSettings, saveSettings } from "./avatarSettings";

const settings = loadSettings();
saveSettings(settings);

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
    followPointer: true,
    label: `Pineapple — ${m.label}`,
    ...settings,
  });
}
