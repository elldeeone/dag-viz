import { useEffect, useRef } from "react";
import HeroDag from "./dag/HeroDag";

interface DagHeroProps {
  apiUrl?: string;
  replayUrl?: string;
  scale?: number;
  className?: string;
  style?: React.CSSProperties;
}

export default function DagHero({
  apiUrl = "https://kgi.kaspad.net:3147",
  replayUrl,
  scale = 0.4,
  className,
  style,
}: DagHeroProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const dagRef = useRef<HeroDag | null>(null);

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

    dag.initialize(canvas);

    if (replayUrl) {
      dag.loadReplay(replayUrl);
    } else if (apiUrl) {
      dag.loadAPI(apiUrl);
    }

    return () => {
      dag.stop();
      dagRef.current = null;
      if (canvas.parentNode) {
        canvas.parentNode.removeChild(canvas);
      }
    };
  }, [apiUrl, replayUrl, scale]);

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
