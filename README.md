# Pineapple Open Bot Avatar

Open Bot Avatar definition for the attached pineapple character.

Spec: [Open Bot Avatar docs](https://dominikscholz.github.io/open-bot-avatar/#/docs)

## Definition

See [`pineapple.json`](./pineapple.json). Paste that file into the [editor Import](https://dominikscholz.github.io/open-bot-avatar/) panel, or use it with the `open-bot-avatar` package.

Suggested render color (not part of the JSON): `#f5c518`.

## Compact JSON (for paste)

```json
{"version":1,"id":"pineapple","name":"Pineapple","body":{"path":"M30 40C30 34 38 30 50 30C62 30 70 34 70 40C76 52 74 74 70 82C66 88 58 90 50 90C42 90 34 88 30 82C26 74 24 52 30 40ZM40 34C38 18 42 9 50 8C58 9 62 18 60 34ZM58 36C64 24 72 12 78 12C82 14 80 22 76 28C70 36 62 38 56 38ZM42 38C38 38 30 36 24 28C20 22 18 14 22 12C28 12 36 24 42 36Z"},"eyes":{"x":50,"y":52,"spacing":15,"scale":1.1}}
```

## Validate locally

```bash
git clone https://github.com/DominikScholz/open-bot-avatar.git
cd open-bot-avatar && pnpm install
pnpm validate /path/to/pineapple.json --strict
```

## Notes

Open Bot Avatar is silhouette + eyes only. Pattern fill, leaf color, mouth, and sparkles from the source art are not in the schema — the engine supplies color, volume, gaze, and mood.
