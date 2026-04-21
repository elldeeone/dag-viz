# dag-viz

A lightweight extraction of the original [Kaspa Graph Inspector](https://github.com/kaspa-live/kaspa-graph-inspector) renderer, built to preserve the exact look and feel of the OG DAG visualization while making it portable enough to embed on any site.

`dag-viz` can render live data from a KGI-compatible API or play back compressed recordings of real DAG activity. That means you can ship a faithful Kaspa DAG visual without running the full Graph Inspector stack.

This project contains code extracted and modified from KGI and is distributed under the ISC license. See [LICENSE](./LICENSE) for attribution and licensing details.

## Why This Exists

The original Kaspa Graph Inspector DAG visual had a look and feel that was hard to reproduce well from scratch.

This repo exists to preserve that original visual as faithfully as possible, while stripping away the heavier parts of Graph Inspector so it can be embedded anywhere.

## What This Is

- The original KGI DAG renderer, extracted and simplified
- A lightweight frontend built with React, PixiJS 8, and Vite 8
- A renderer that can use live API data or compressed replay artifacts
- A way to ship real DAG motion in a portable format

## What This Isn't

- Not the full Kaspa Graph Inspector stack
- Not a processing node, database, or API backend
- Not a redesign or reinterpretation of the KGI visual style

## Requirements

- Node.js `20.19.0+` or `22.12.0+`
- Node 21 is not supported

## Quick Start

```bash
nvm use
npm install
npm run dev
```

Open:

```text
http://localhost:5173/
```

## Viewing Modes

Open the app at:

```text
http://localhost:5173/
```

By default, `dag-viz` runs in live mode and points to a KGI-compatible API.

### Use a Live API

Default live mode:

```text
http://localhost:5173/
```

Point live mode at a different API:

```text
http://localhost:5173/?api=https://kgi.kaspad.net:3147
http://localhost:5173/?api=kgi.kaspad.net
```

### Use a Recorded Snapshot

Snapshot mode plays back a compressed recording of real DAG activity.

This repo includes a sample replay at:

```text
/replay/mainnet-60s-compressed.json
```

Open it like this:

```text
http://localhost:5173/?mode=snapshot&snapshot=/replay/mainnet-60s-compressed.json
```

Example with playback settings:

```text
http://localhost:5173/?mode=snapshot&snapshot=/replay/mainnet-60s-compressed.json&scale=0.4&speed=1
```

`scale` works in both live and snapshot mode.

`speed` applies to snapshot mode only. `1` is real-time, `0.5` is half-speed, and `2` is double-speed.

## Refresh the Bundled Replay

Refresh the sample replay included in this repo:

```bash
npm run record:mainnet-60s
```

This overwrites:

- `public/replay/mainnet-60s-compressed.json`

## Custom Recording

Record a replay with your own settings:

```bash
npm run record:snapshot -- \
  --api-url https://kgi.kaspad.net:3147 \
  --duration-ms 60000 \
  --poll-interval-ms 200 \
  --height-difference 14 \
  --out public/replay/mainnet-60s-compressed.json
```

Optional debug output:

```bash
npm run record:snapshot -- \
  --api-url https://kgi.kaspad.net:3147 \
  --duration-ms 60000 \
  --poll-interval-ms 200 \
  --height-difference 14 \
  --out public/replay/mainnet-60s-compressed.json \
  --raw-out debug/replay/mainnet-60s.json
```

The recorder defaults to a live-compatible cadence, where the next poll starts after the previous response plus the poll interval. Add `--fixed-rate` only if you want fixed schedule capture.
