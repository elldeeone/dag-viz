import { useEffect, useRef } from "react";
import HeroDag from "./dag/HeroDag";

const DEFAULT_API_URL = "https://kgi.kaspad.net:3147";
const DEFAULT_API_PORT = "3147";

const URL_SCHEME_REGEX = /^[a-zA-Z][a-zA-Z\d+\-.]*:\/\//;

const normalizeApiUrl = (rawUrl: string): string => {
  const trimmedUrl = rawUrl.trim();
  if (!trimmedUrl) return DEFAULT_API_URL;

  const withScheme = URL_SCHEME_REGEX.test(trimmedUrl)
    ? trimmedUrl
    : `https://${trimmedUrl}`;

  try {
    const url = new URL(withScheme);

    if (!url.port && url.hostname === "kgi.kaspad.net") {
      url.port = DEFAULT_API_PORT;
    }

    if (url.pathname === "/") {
      url.pathname = "";
    } else {
      url.pathname = url.pathname.replace(/\/+$/, "");
    }

    return url.toString().replace(/\/$/, "");
  } catch {
    return DEFAULT_API_URL;
  }
};

interface DagHeroProps {
  apiUrl?: string;
  snapshotReplayUrl?: string;
  snapshotPlaybackRate?: number;
  scale?: number;
  className?: string;
  style?: React.CSSProperties;
}

export default function DagHero({
  apiUrl = DEFAULT_API_URL,
  snapshotReplayUrl,
  snapshotPlaybackRate = 1,
  scale = 0.4,
  className,
  style,
}: DagHeroProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const dagRef = useRef<HeroDag | null>(null);
  const normalizedApiUrl = apiUrl ? normalizeApiUrl(apiUrl) : undefined;

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    // Create canvas dynamically so StrictMode re-mounts work cleanly
    const canvas = document.createElement("canvas");
    canvas.style.display = "block";
    canvas.style.width = "100%";
    canvas.style.height = "100%";
    canvas.style.position = "absolute";
    canvas.style.inset = "0";
    container.prepend(canvas);

    const dag = new HeroDag(scale);
    dagRef.current = dag;

    let isDisposed = false;

    const startDag = async () => {
      try {
        await dag.initialize(canvas);
      } catch (error) {
        if (!isDisposed) {
          console.error("[DAG Hero] Initialization failed", error);
        }
        return;
      }

      if (isDisposed) {
        dag.stop();
        return;
      }

      if (snapshotReplayUrl) {
        dag
          .loadSnapshotReplay(snapshotReplayUrl, snapshotPlaybackRate)
          .catch((error) => {
            if (!isDisposed) {
              console.error("[DAG Hero] Snapshot replay failed", error);
            }
          });
      } else if (normalizedApiUrl) {
        dag.loadAPI(normalizedApiUrl);
      }
    };

    void startDag();

    return () => {
      isDisposed = true;
      dag.stop();
      dagRef.current = null;
      if (canvas.parentNode) {
        canvas.parentNode.removeChild(canvas);
      }
    };
  }, [normalizedApiUrl, snapshotPlaybackRate, snapshotReplayUrl, scale]);

  return (
    <div
      ref={containerRef}
      className={className}
      style={{
        position: "relative",
        width: "100%",
        height: "100%",
        overflow: "hidden",
        background: "#2b2b2b",
        ...style,
      }}
    />
  );
}
