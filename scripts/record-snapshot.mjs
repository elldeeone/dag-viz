#!/usr/bin/env node

import path from "node:path";
import { mkdir, writeFile } from "node:fs/promises";

const DEFAULT_API_URL = "https://kgi.kaspad.net:3147";
const DEFAULT_DURATION_MS = 60_000;
const DEFAULT_POLL_INTERVAL_MS = 200;
const DEFAULT_HEIGHT_DIFFERENCE = 14;
const DEFAULT_OUT_PATH = "public/replay/mainnet-60s.json";

const COLOR_TO_CODE = {
  blue: 0,
  red: 1,
  gray: 2,
};

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const printHelp = () => {
  console.log(`Usage: node scripts/record-snapshot.mjs [options]

Options:
  --api-url <url>            API base URL (default: ${DEFAULT_API_URL})
  --duration-ms <ms>         Total recording duration (default: ${DEFAULT_DURATION_MS})
  --poll-interval-ms <ms>    Poll interval (default: ${DEFAULT_POLL_INTERVAL_MS})
  --height-difference <n>    heightDifference query value (default: ${DEFAULT_HEIGHT_DIFFERENCE})
  --out <path>               Output path for full snapshot JSON (default: ${DEFAULT_OUT_PATH})
  --compressed-out <path>    Optional output path for compressed v2 JSON
  --fixed-rate               Use fixed schedule polling (default is live-compatible cadence)
  --pretty                   Pretty-print JSON output
  --help                     Show this help

Examples:
  node scripts/record-snapshot.mjs \\
    --api-url https://kgi.kaspad.net:3147 \\
    --duration-ms 60000 \\
    --poll-interval-ms 200 \\
    --height-difference 14 \\
    --out public/replay/mainnet-60s.json \\
    --compressed-out public/replay/mainnet-60s-compressed.json
`);
};

const isFlag = (token) => token.startsWith("--");

const parseIntegerArg = (name, rawValue) => {
  const parsed = Number(rawValue);
  if (!Number.isInteger(parsed) || parsed <= 0) {
    throw new Error(`Invalid value for ${name}: ${rawValue}`);
  }
  return parsed;
};

const normalizeApiUrl = (rawUrl) => {
  const trimmedUrl = rawUrl.trim();
  const withScheme = /^[a-zA-Z][a-zA-Z\d+\-.]*:\/\//.test(trimmedUrl)
    ? trimmedUrl
    : `https://${trimmedUrl}`;

  const url = new URL(withScheme);
  if (!url.port && url.hostname === "kgi.kaspad.net") {
    url.port = "3147";
  }

  if (url.pathname === "/") {
    url.pathname = "";
  } else {
    url.pathname = url.pathname.replace(/\/+$/, "");
  }

  return url.toString().replace(/\/$/, "");
};

const parseArgs = (argv) => {
  const args = {
    apiUrl: DEFAULT_API_URL,
    durationMs: DEFAULT_DURATION_MS,
    pollIntervalMs: DEFAULT_POLL_INTERVAL_MS,
    heightDifference: DEFAULT_HEIGHT_DIFFERENCE,
    outPath: DEFAULT_OUT_PATH,
    compressedOutPath: null,
    fixedRate: false,
    pretty: false,
  };

  for (let i = 0; i < argv.length; i++) {
    const token = argv[i];

    if (token === "--help") {
      printHelp();
      process.exit(0);
    }

    if (token === "--pretty") {
      args.pretty = true;
      continue;
    }

    if (token === "--fixed-rate") {
      args.fixedRate = true;
      continue;
    }

    if (!isFlag(token)) {
      throw new Error(`Unknown argument: ${token}`);
    }

    const value = argv[i + 1];
    if (!value || isFlag(value)) {
      throw new Error(`Missing value for ${token}`);
    }
    i++;

    switch (token) {
      case "--api-url":
        args.apiUrl = value;
        break;
      case "--duration-ms":
        args.durationMs = parseIntegerArg(token, value);
        break;
      case "--poll-interval-ms":
        args.pollIntervalMs = parseIntegerArg(token, value);
        break;
      case "--height-difference":
        args.heightDifference = parseIntegerArg(token, value);
        break;
      case "--out":
        args.outPath = value;
        break;
      case "--compressed-out":
        args.compressedOutPath = value;
        break;
      default:
        throw new Error(`Unknown option: ${token}`);
    }
  }

  return args;
};

const fetchHead = async (apiUrl, heightDifference) => {
  const response = await fetch(
    `${apiUrl}/head?heightDifference=${encodeURIComponent(heightDifference)}`
  );
  if (!response.ok) {
    throw new Error(`HTTP ${response.status} ${response.statusText}`);
  }
  return response.json();
};

const edgeKey = (edge) =>
  `${edge.fromBlockId}|${edge.toBlockId}|${edge.fromHeight}|${edge.toHeight}|${edge.fromHeightGroupIndex}|${edge.toHeightGroupIndex}`;

const sortedNumberArray = (values) =>
  Array.from(values).sort((a, b) => a - b);

const buildCompressedReplay = (snapshot) => {
  const blockDefs = {};
  const edgeDefs = [];
  const edgeIndexByKey = new Map();

  for (const frame of snapshot.frames) {
    for (const block of frame.data.blocks) {
      if (!blockDefs[block.id]) {
        blockDefs[block.id] = [block.blockHash, block.height, block.heightGroupIndex];
      }
    }

    for (const edge of frame.data.edges) {
      const key = edgeKey(edge);
      if (!edgeIndexByKey.has(key)) {
        edgeIndexByKey.set(key, edgeDefs.length);
        edgeDefs.push([
          edge.fromBlockId,
          edge.toBlockId,
          edge.fromHeight,
          edge.toHeight,
          edge.fromHeightGroupIndex,
          edge.toHeightGroupIndex,
        ]);
      }
    }
  }

  const compressedFrames = [];
  let prevBlocks = new Set();
  let prevColors = new Map();
  let prevVspc = new Set();
  let prevEdgeIndexes = new Set();
  let prevHeightGroups = new Map();

  for (let frameIndex = 0; frameIndex < snapshot.frames.length; frameIndex++) {
    const sourceFrame = snapshot.frames[frameIndex];
    const frame = { t: sourceFrame.t };

    const currentBlocks = new Set();
    const currentColors = new Map();
    const currentVspc = new Set();
    const currentEdgeIndexes = new Set();
    const currentHeightGroups = new Map();

    for (const block of sourceFrame.data.blocks) {
      currentBlocks.add(block.id);
      currentColors.set(block.id, COLOR_TO_CODE[block.color] ?? 0);
      if (block.isInVirtualSelectedParentChain) {
        currentVspc.add(block.id);
      }
    }

    for (const edge of sourceFrame.data.edges) {
      const index = edgeIndexByKey.get(edgeKey(edge));
      if (index !== undefined) {
        currentEdgeIndexes.add(index);
      }
    }

    for (const hg of sourceFrame.data.heightGroups) {
      currentHeightGroups.set(hg.height, hg.size);
    }

    if (frameIndex === 0) {
      frame.b = sortedNumberArray(currentBlocks);

      const initialColors = {};
      for (const blockId of sortedNumberArray(currentBlocks)) {
        const colorCode = currentColors.get(blockId) ?? 0;
        if (colorCode !== 0) {
          initialColors[String(blockId)] = colorCode;
        }
      }
      if (Object.keys(initialColors).length > 0) {
        frame.c = initialColors;
      }

      frame.v = sortedNumberArray(currentVspc);
      frame.e = sortedNumberArray(currentEdgeIndexes);
      frame.hg = sortedNumberArray(currentHeightGroups.keys()).map((height) => [
        height,
        currentHeightGroups.get(height),
      ]);
    } else {
      const addedBlocks = sortedNumberArray(
        Array.from(currentBlocks).filter((id) => !prevBlocks.has(id))
      );
      if (addedBlocks.length > 0) frame.ab = addedBlocks;

      const removedBlocks = sortedNumberArray(
        Array.from(prevBlocks).filter((id) => !currentBlocks.has(id))
      );
      if (removedBlocks.length > 0) frame.rb = removedBlocks;

      const colorUpdates = {};
      for (const blockId of sortedNumberArray(currentBlocks)) {
        const previousColor = prevColors.get(blockId) ?? 0;
        const currentColor = currentColors.get(blockId) ?? 0;
        if (previousColor !== currentColor) {
          colorUpdates[String(blockId)] = currentColor;
        }
      }
      if (Object.keys(colorUpdates).length > 0) frame.ac = colorUpdates;

      const addedVspc = sortedNumberArray(
        Array.from(currentVspc).filter((id) => !prevVspc.has(id))
      );
      if (addedVspc.length > 0) frame.av = addedVspc;

      const removedVspc = sortedNumberArray(
        Array.from(prevVspc).filter((id) => !currentVspc.has(id))
      );
      if (removedVspc.length > 0) frame.rv = removedVspc;

      const addedEdges = sortedNumberArray(
        Array.from(currentEdgeIndexes).filter((index) => !prevEdgeIndexes.has(index))
      );
      if (addedEdges.length > 0) frame.ae = addedEdges;

      const removedEdges = sortedNumberArray(
        Array.from(prevEdgeIndexes).filter((index) => !currentEdgeIndexes.has(index))
      );
      if (removedEdges.length > 0) frame.re = removedEdges;

      const upsertedHeightGroups = [];
      for (const height of sortedNumberArray(currentHeightGroups.keys())) {
        const currentSize = currentHeightGroups.get(height);
        const previousSize = prevHeightGroups.get(height);
        if (previousSize !== currentSize) {
          upsertedHeightGroups.push([height, currentSize]);
        }
      }
      if (upsertedHeightGroups.length > 0) {
        frame.ahg = upsertedHeightGroups;
      }

      const removedHeightGroups = sortedNumberArray(
        Array.from(prevHeightGroups.keys()).filter(
          (height) => !currentHeightGroups.has(height)
        )
      );
      if (removedHeightGroups.length > 0) frame.rhg = removedHeightGroups;
    }

    compressedFrames.push(frame);
    prevBlocks = currentBlocks;
    prevColors = currentColors;
    prevVspc = currentVspc;
    prevEdgeIndexes = currentEdgeIndexes;
    prevHeightGroups = currentHeightGroups;
  }

  return {
    v: 2,
    durationMs: snapshot.durationMs,
    pollIntervalMs: snapshot.pollIntervalMs,
    frameCount: snapshot.frameCount,
    blocks: blockDefs,
    edges: edgeDefs,
    frames: compressedFrames,
  };
};

const writeJson = async (targetPath, payload, pretty) => {
  const outputPath = path.isAbsolute(targetPath)
    ? targetPath
    : path.resolve(process.cwd(), targetPath);
  await mkdir(path.dirname(outputPath), { recursive: true });
  await writeFile(
    outputPath,
    JSON.stringify(payload, null, pretty ? 2 : undefined),
    "utf8"
  );
  return outputPath;
};

const main = async () => {
  const args = parseArgs(process.argv.slice(2));
  const apiUrl = normalizeApiUrl(args.apiUrl);

  console.log(`[record] API URL          : ${apiUrl}`);
  console.log(`[record] durationMs       : ${args.durationMs}`);
  console.log(`[record] pollIntervalMs   : ${args.pollIntervalMs}`);
  console.log(`[record] heightDifference : ${args.heightDifference}`);
  console.log(
    `[record] mode             : ${
      args.fixedRate ? "fixed-rate" : "live-compatible"
    }`
  );

  const frames = [];
  const startTime = Date.now();
  let tick = 0;
  let nextPollAt = startTime;

  while (true) {
    const now = Date.now();
    if (now < nextPollAt) {
      await sleep(nextPollAt - now);
    }

    const elapsedBeforePoll = Date.now() - startTime;
    if (tick > 0 && elapsedBeforePoll > args.durationMs) {
      break;
    }

    try {
      const data = await fetchHead(apiUrl, args.heightDifference);
      const elapsed = Date.now() - startTime;
      frames.push({ t: elapsed, data });
      process.stdout.write(`\r[record] frames captured: ${frames.length} (t=${elapsed}ms)`);

      if (args.fixedRate) {
        nextPollAt = startTime + (tick + 1) * args.pollIntervalMs;
      } else {
        nextPollAt = Date.now() + args.pollIntervalMs;
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      process.stdout.write(`\n[warn] poll ${tick} failed: ${message}\n`);

      if (args.fixedRate) {
        nextPollAt = startTime + (tick + 1) * args.pollIntervalMs;
      } else {
        nextPollAt = Date.now() + args.pollIntervalMs;
      }
    }

    tick += 1;
  }

  process.stdout.write("\n");

  const snapshot = {
    recordedAt: new Date().toISOString(),
    durationMs: Date.now() - startTime,
    heightDifference: args.heightDifference,
    pollIntervalMs: args.pollIntervalMs,
    frameCount: frames.length,
    frames,
  };

  if (snapshot.frameCount === 0) {
    throw new Error("No frames captured. Verify API URL/connectivity and retry.");
  }

  if (snapshot.frameCount > 1) {
    const deltas = [];
    for (let i = 1; i < snapshot.frames.length; i++) {
      deltas.push(snapshot.frames[i].t - snapshot.frames[i - 1].t);
    }
    const averageDelta =
      deltas.reduce((sum, value) => sum + value, 0) / deltas.length;
    console.log(
      `[record] average frame delta: ${Math.round(averageDelta)}ms (${deltas.length} intervals)`
    );
  }

  const fullPath = await writeJson(args.outPath, snapshot, args.pretty);
  console.log(`[record] wrote snapshot: ${fullPath}`);

  if (args.compressedOutPath) {
    const compressed = buildCompressedReplay(snapshot);
    const compressedPath = await writeJson(
      args.compressedOutPath,
      compressed,
      args.pretty
    );
    console.log(`[record] wrote compressed snapshot: ${compressedPath}`);
  }
};

main().catch((error) => {
  const message = error instanceof Error ? error.message : String(error);
  console.error(`[record] failed: ${message}`);
  process.exitCode = 1;
});
