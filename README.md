# Pineapple Avatar

Interactive [Open Bot Avatar](https://dominikscholz.github.io/open-bot-avatar/) for the pineapple character — silhouette traced from the source art, rendered with implied 3D volume, pointer gaze, and moods (`idle`, `thinking`, `happy`).

## Run locally

```bash
npm install
npm run dev
```

Open [http://127.0.0.1:43127](http://127.0.0.1:43127).

## Use on a website

```ts
import { mountAvatar } from "open-bot-avatar/dom";
import pineapple from "./pineapple.json";

const avatar = mountAvatar(document.querySelector("#bot")!, {
  definition: pineapple,
  color: "#f5c518",
  mood: "idle",
  followPointer: true,
});

avatar.update({ mood: "thinking" }); // while the model works
avatar.update({ mood: "happy" });    // on a good reply
avatar.update({ mood: "idle" });
```

Definition: [`src/pineapple.json`](./src/pineapple.json) (also mirrored at repo root). Color is runtime-only; suggested yellow `#f5c518`.

## Source

`source.png` is the original flat art. Open Bot Avatar is geometry-only (one SVG silhouette + eye placement), so leaf green, diamond pattern, smile, and sparkles are not in the JSON — the engine supplies volume, color, blink, gaze, and mood eye shapes.
