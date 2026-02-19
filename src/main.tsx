import React, { Suspense } from "react";
import ReactDOM from "react-dom/client";

const DagHero = React.lazy(() => import("./DagHero"));

const DEFAULT_SCALE = 0.4;
const DEFAULT_API_URL = "https://kgi.kaspad.net:3147";
const DEFAULT_SNAPSHOT_REPLAY_URL = "/replay/mainnet-60s-compressed.json";
const DEFAULT_REPLAY_URL = "/replay/ghostdag-10bps-k18.json";

type AppMode = "api" | "snapshot" | "replay";

type AppConfig = {
  mode: AppMode;
  apiUrl?: string;
  snapshotReplayUrl?: string;
  snapshotPlaybackRate: number;
  replayUrl?: string;
  scale: number;
};

const parseScale = (raw: string | null): number => {
  if (!raw) return DEFAULT_SCALE;
  const parsed = Number(raw);
  return Number.isFinite(parsed) ? parsed : DEFAULT_SCALE;
};

const parsePlaybackRate = (raw: string | null): number => {
  if (!raw) return 1;
  const parsed = Number(raw);
  if (!Number.isFinite(parsed) || parsed <= 0) return 1;
  return parsed;
};

const resolveAppConfig = (): AppConfig => {
  const params = new URLSearchParams(window.location.search);
  const modeParam = params.get("mode");
  const apiParam = params.get("api");
  const snapshotParam = params.get("snapshot");
  const replayParam = params.get("replay");
  const scale = parseScale(params.get("scale"));
  const snapshotPlaybackRate = parsePlaybackRate(params.get("speed"));

  if (snapshotParam || modeParam === "snapshot") {
    return {
      mode: "snapshot",
      snapshotReplayUrl: snapshotParam || DEFAULT_SNAPSHOT_REPLAY_URL,
      snapshotPlaybackRate,
      scale,
    };
  }

  if (replayParam || modeParam === "replay") {
    return {
      mode: "replay",
      replayUrl: replayParam || DEFAULT_REPLAY_URL,
      snapshotPlaybackRate,
      scale,
    };
  }

  return {
    mode: "api",
    apiUrl: apiParam || DEFAULT_API_URL,
    snapshotPlaybackRate,
    scale,
  };
};

const appConfig = resolveAppConfig();

function App() {
  const dagProps =
    appConfig.mode === "snapshot"
      ? {
          snapshotReplayUrl: appConfig.snapshotReplayUrl,
          snapshotPlaybackRate: appConfig.snapshotPlaybackRate,
        }
      : appConfig.mode === "replay"
      ? { replayUrl: appConfig.replayUrl }
      : { apiUrl: appConfig.apiUrl };

  return (
    <div
      style={{
        width: "100vw",
        height: "100vh",
        position: "relative",
        background: "#2b2b2b",
        color: "#fff",
      }}
    >
      <Suspense
        fallback={
          <div
            style={{
              position: "absolute",
              inset: 0,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              color: "#b5b5b5",
              fontFamily: "system-ui, -apple-system, Segoe UI, Roboto, sans-serif",
              fontSize: 14,
            }}
          >
            Loading DAG visualizer...
          </div>
        }
      >
        <DagHero
          style={{ position: "absolute", inset: 0 }}
          scale={appConfig.scale}
          {...dagProps}
        />
      </Suspense>
    </div>
  );
}

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
