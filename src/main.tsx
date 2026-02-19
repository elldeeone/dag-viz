import React from "react";
import ReactDOM from "react-dom/client";
import DagHero from "./DagHero";

function App() {
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
      <DagHero
        style={{ position: "absolute", inset: 0 }}
        scale={0.4}
      />
    </div>
  );
}

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
