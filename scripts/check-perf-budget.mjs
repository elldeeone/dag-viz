#!/usr/bin/env node

import path from "node:path";
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { gzipSync } from "node:zlib";

const MAX_MAIN_JS_BYTES = Number(process.env.MAX_MAIN_JS_BYTES || 800 * 1024);
const MAX_MAIN_JS_GZIP_BYTES = Number(
  process.env.MAX_MAIN_JS_GZIP_BYTES || 230 * 1024
);
const MAX_COMPRESSED_REPLAY_BYTES = Number(
  process.env.MAX_COMPRESSED_REPLAY_BYTES || 500 * 1024
);

const root = process.cwd();
const distAssetsDir = path.join(root, "dist", "assets");
const compressedReplayPath = path.join(
  root,
  "public",
  "replay",
  "mainnet-60s-compressed.json"
);
const productionFullReplayPath = path.join(
  root,
  "public",
  "replay",
  "mainnet-60s.json"
);

const formatBytes = (bytes) => {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
};

const fail = (message) => {
  console.error(`[perf] FAIL: ${message}`);
  process.exitCode = 1;
};

const pass = (message) => {
  console.log(`[perf] OK: ${message}`);
};

if (!existsSync(distAssetsDir)) {
  console.error(
    `[perf] Missing ${path.relative(root, distAssetsDir)}. Run 'npm run build' first.`
  );
  process.exit(1);
}

const builtJsFiles = readdirSync(distAssetsDir)
  .filter((file) => file.endsWith(".js"))
  .map((file) => path.join(distAssetsDir, file));

if (builtJsFiles.length === 0) {
  console.error("[perf] No built JS assets found in dist/assets.");
  process.exit(1);
}

let totalMainJsBytes = 0;
let totalMainJsGzipBytes = 0;
for (const filePath of builtJsFiles) {
  const contents = readFileSync(filePath);
  totalMainJsBytes += contents.length;
  totalMainJsGzipBytes += gzipSync(contents, { level: 9 }).length;
}

if (totalMainJsBytes > MAX_MAIN_JS_BYTES) {
  fail(
    `JS bundle raw size ${formatBytes(totalMainJsBytes)} exceeds budget ${formatBytes(
      MAX_MAIN_JS_BYTES
    )}`
  );
} else {
  pass(
    `JS bundle raw size ${formatBytes(totalMainJsBytes)} within budget ${formatBytes(
      MAX_MAIN_JS_BYTES
    )}`
  );
}

if (totalMainJsGzipBytes > MAX_MAIN_JS_GZIP_BYTES) {
  fail(
    `JS bundle gzip size ${formatBytes(totalMainJsGzipBytes)} exceeds budget ${formatBytes(
      MAX_MAIN_JS_GZIP_BYTES
    )}`
  );
} else {
  pass(
    `JS bundle gzip size ${formatBytes(totalMainJsGzipBytes)} within budget ${formatBytes(
      MAX_MAIN_JS_GZIP_BYTES
    )}`
  );
}

if (!existsSync(compressedReplayPath)) {
  fail(
    `Missing production replay asset ${path.relative(root, compressedReplayPath)}`
  );
} else {
  const compressedReplayBytes = statSync(compressedReplayPath).size;
  if (compressedReplayBytes > MAX_COMPRESSED_REPLAY_BYTES) {
    fail(
      `Compressed replay size ${formatBytes(
        compressedReplayBytes
      )} exceeds budget ${formatBytes(MAX_COMPRESSED_REPLAY_BYTES)}`
    );
  } else {
    pass(
      `Compressed replay size ${formatBytes(
        compressedReplayBytes
      )} within budget ${formatBytes(MAX_COMPRESSED_REPLAY_BYTES)}`
    );
  }

  try {
    const replayData = JSON.parse(readFileSync(compressedReplayPath, "utf8"));
    if (replayData?.v !== 2) {
      fail(
        `${path.relative(
          root,
          compressedReplayPath
        )} is not compressed replay format (expected v=2)`
      );
    } else {
      pass("Compressed replay format marker v=2 detected");
    }
  } catch (error) {
    fail(
      `Failed to parse ${path.relative(root, compressedReplayPath)}: ${String(error)}`
    );
  }
}

if (existsSync(productionFullReplayPath)) {
  fail(
    `Full replay file should be debug-only. Move ${path.relative(
      root,
      productionFullReplayPath
    )} to debug/replay/.`
  );
} else {
  pass("No full replay file in production public/replay path");
}

if (process.exitCode) {
  process.exit(process.exitCode);
}

console.log("[perf] Performance budgets passed.");
