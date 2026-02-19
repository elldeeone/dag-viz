# DAG Hero

Minimal DAG visualizer extracted from Kaspa Graph Inspector.

## Run

```bash
npm install
npm run dev
```

## Modes

Live API mode is the default:

```text
http://localhost:5173/
```

Override API URL:

```text
http://localhost:5173/?api=https://kgi.kaspad.net:3147
http://localhost:5173/?api=kgi.kaspad.net
```

Snapshot replay mode:

```text
http://localhost:5173/?mode=snapshot&snapshot=/replay/mainnet-60s.json
http://localhost:5173/?mode=snapshot&snapshot=/replay/mainnet-60s-compressed.json
```

Legacy replay mode (ghostdag synthetic):

```text
http://localhost:5173/?mode=replay&replay=/replay/ghostdag-10bps-k18.json
```

Optional:

```text
&scale=0.4
&speed=1
```

`speed` applies to snapshot replay only (`1` is real-time, `0.5` is half speed, `2` is double speed).

## Record Live Snapshot

Record from `kgi.kaspad.net` for 60s (full + compressed):

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
  --out public/replay/mainnet-60s.json \
  --compressed-out public/replay/mainnet-60s-compressed.json
```

Notes:
- Recorder default mode is live-compatible cadence (`next poll starts after response + poll interval`).
- Add `--fixed-rate` only if you explicitly want fixed schedule capture.
