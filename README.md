# DAG Hero

Minimal DAG visualizer extracted from Kaspa Graph Inspector, optimized for production replay delivery.

## Run

```bash
npm install
npm run dev
```

## Modes

Live API mode is default:

```text
http://localhost:5173/
```

Override API URL:

```text
http://localhost:5173/?api=https://kgi.kaspad.net:3147
http://localhost:5173/?api=kgi.kaspad.net
```

Snapshot replay mode (compressed replay recommended):

```text
http://localhost:5173/?mode=snapshot&snapshot=/replay/mainnet-60s-compressed.json
```

Legacy synthetic replay mode:

```text
http://localhost:5173/?mode=replay&replay=/replay/ghostdag-10bps-k18.json
```

Optional query params:

```text
&scale=0.4
&speed=1
```

`speed` applies to snapshot replay only (`1` is real-time, `0.5` is half-speed, `2` is double-speed).

## Replay Artifacts

Production replay artifact:
- `public/replay/mainnet-60s-compressed.json` (`v:2` compressed format)

Debug replay artifact:
- `debug/replay/mainnet-60s.json` (full uncompressed snapshot, gitignored)

## Record Live Snapshot

Record mainnet for 60s:

```bash
npm run record:mainnet-60s
```

Custom recording:

```bash
npm run record:snapshot -- \
  --api-url https://kgi.kaspad.net:3147 \
  --duration-ms 60000 \
  --poll-interval-ms 200 \
  --height-difference 14 \
  --out debug/replay/mainnet-60s.json \
  --compressed-out public/replay/mainnet-60s-compressed.json
```

Notes:
- Recorder default cadence is live-compatible (`next poll starts after response + poll interval`).
- Add `--fixed-rate` only if you want fixed schedule capture.

## Performance Budgets

Run performance budget checks locally:

```bash
npm run perf:check
```

Checks include:
- Built JS bundle raw size budget
- Built JS bundle gzip size budget
- Compressed replay size budget
- Enforce compressed replay marker (`v=2`)
- Enforce no full replay in `public/replay/mainnet-60s.json`

CI runs this automatically via `.github/workflows/perf-budget.yml`.

## Deployment Caching

Cache header config included:
- `public/_headers` for Netlify/Cloudflare Pages style hosting
- `vercel.json` for Vercel headers

Recommended:
- Serve `dist/` behind Brotli + gzip compression
- Keep immutable cache for `/assets/*` and `/replay/*`
