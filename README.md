# 🍄 Mushroom Kids

One fluffy mushroom for a stream overlay. Viewers feed it, cuddle it and high-five it through the tip menu, and every tip fills its warmth gauge.

**Preview:** https://vinceixiv.github.io/Mushroom-kid/
It has two tabs, with explanations in Vietnamese: all the states side by side, and a live example.

## What's inside

| Path | What it is |
|---|---|
| `overlay.html` | The overlay: an OBS Browser Source, 480 × 360, transparent background. |
| `extension/` | A Chrome extension. It spots "Feed the kids" and "Cuddle the kids" tips in the chat and tells OBS. |
| `index.html` | The preview page (GitHub Pages). Every preview is the real overlay, without OBS. |
| `presentation/` | Demo GIFs, plus the scripts that record them. |

## How it works

The extension reads the chat in the browser tab. When a matching tip shows up, it sends a custom event through OBS's built-in WebSocket server. The overlay listens for that event.

Nothing else needs to be installed, and nothing leaves the computer.

## Moods

The warmth gauge only goes up with Feed and Cuddle tips, by the number of tokens tipped. It is full at 200 tokens by default (set in the extension popup). It never goes down by itself.

| Warmth | Mood |
|---|---|
| below 10% | Cold: they pout and shiver |
| 10–45% | Neutral |
| 45–60% | Comfy |
| 60–70% | Cosy |
| 70–90% | Happy |
| 90–100% | Blissful |

## Test keys

Open `overlay.html?test=1&obs=0` in a browser:

| Key | Action |
|---|---|
| **F** | Feed the kids |
| **C** | Cuddle the kids |
| **1**–**9** | Set the warmth to 10–90% |
| **0** | Empty the gauge |
| **+** | Add 200 tokens |
