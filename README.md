# Pineapple Avatar

Full-color AI companion avatar from your pineapple artwork. AI states (`idle`, `thinking` / `working`, `success`, `error`) drive feedback while a model runs. Hoodie uses redrawn sprite loops; pineapple keeps face overlays + gaze.

> Open Bot Avatar’s JSON format is **one flat color + silhouette only**, so it cannot keep your multi-color SVG details. This project uses your art directly instead.

## Run locally

```bash
npm install
npm run dev
```

Open the URL Vite prints (default [http://127.0.0.1:45291](http://127.0.0.1:45291)).

Presentation strip of all four moods (no text or controls):
[http://127.0.0.1:45291/preview.html](http://127.0.0.1:45291/preview.html)

Local 2D character animator (AI states + walk / attack → spritesheet + JSON atlas):
[http://127.0.0.1:45291/animator.html](http://127.0.0.1:45291/animator.html)

In Cursor Cloud Agents: use the **Ports** plug icon to forward `45291`, then open the forwarded localhost URL.

## Use on a website

```ts
import { mountPineappleAvatar } from "./pineappleAvatar";

const avatar = mountPineappleAvatar(document.querySelector("#bot")!, {
  character: "hoodie",
  mood: "idle",
  followPointer: true,
});

avatar.update({ mood: "thinking" }); // or "working" — model busy
avatar.update({ mood: "success" });  // good reply
avatar.update({ mood: "error" });    // failed / blocked
avatar.update({ mood: "idle" });
```

## Files

| Path | Role |
| --- | --- |
| `src/assets/pineapple-base.png` | Your art with original eyes/mouth cleared for overlays |
| `src/pineappleAvatar.ts` | Mount API, moods, pointer gaze |
| `source.png` | Original artwork |

## Note on Open Bot Avatar JSON

`pineapple.json` is kept only as a single-color silhouette experiment. Prefer `mountPineappleAvatar` for the site.
