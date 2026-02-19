import type {
  Block,
  BlockColor,
  BlocksAndEdgesAndHeightGroups,
  Edge,
  HeightGroup,
} from "./types";

type SnapshotReplayFrame = { t: number; data: BlocksAndEdgesAndHeightGroups };

export type SnapshotReplayData = {
  recordedAt?: string;
  durationMs: number;
  heightDifference?: number;
  pollIntervalMs: number;
  frameCount: number;
  frames: SnapshotReplayFrame[];
};

type CompressedColor = 0 | 1 | 2;
type CompressedBlockDef = [string, number, number];
type CompressedEdgeDef = [number, number, number, number, number, number];

type CompressedSnapshotReplayFrame = {
  t: number;
  b?: number[];
  c?: Record<string, CompressedColor>;
  v?: number[];
  e?: number[];
  hg?: [number, number][];

  ab?: number[];
  rb?: number[];
  ac?: Record<string, CompressedColor>;
  av?: number[];
  rv?: number[];
  ae?: number[];
  re?: number[];
  ahg?: [number, number][];
  rhg?: number[];
};

type CompressedSnapshotReplayData = {
  v: 2;
  durationMs: number;
  pollIntervalMs: number;
  frameCount: number;
  blocks: Record<string, CompressedBlockDef>;
  edges: CompressedEdgeDef[];
  frames: CompressedSnapshotReplayFrame[];
};

const colorByCode: Record<CompressedColor, BlockColor> = {
  0: "blue",
  1: "red",
  2: "gray",
};

const isBlocksAndEdgesAndHeightGroups = (
  value: unknown
): value is BlocksAndEdgesAndHeightGroups => {
  const candidate = value as BlocksAndEdgesAndHeightGroups | undefined;
  return (
    !!candidate &&
    Array.isArray(candidate.blocks) &&
    Array.isArray(candidate.edges) &&
    Array.isArray(candidate.heightGroups)
  );
};

const isSnapshotReplayData = (value: unknown): value is SnapshotReplayData => {
  if (!value || typeof value !== "object") return false;
  const replay = value as SnapshotReplayData;
  if (!Array.isArray(replay.frames)) return false;
  if (replay.frames.length === 0) return false;

  const firstFrame = replay.frames[0] as SnapshotReplayFrame | undefined;
  return (
    !!firstFrame &&
    typeof firstFrame.t === "number" &&
    isBlocksAndEdgesAndHeightGroups(firstFrame.data)
  );
};

const isCompressedSnapshotReplayData = (
  value: unknown
): value is CompressedSnapshotReplayData => {
  if (!value || typeof value !== "object") return false;
  const replay = value as CompressedSnapshotReplayData;
  return (
    replay.v === 2 &&
    typeof replay.durationMs === "number" &&
    typeof replay.pollIntervalMs === "number" &&
    Array.isArray(replay.frames) &&
    replay.frames.length > 0 &&
    replay.blocks !== undefined &&
    replay.blocks !== null &&
    typeof replay.blocks === "object" &&
    Array.isArray(replay.edges)
  );
};

const sortedNumbers = (values: Iterable<number>): number[] =>
  Array.from(values).sort((a, b) => a - b);

const buildBlock = (
  id: number,
  blockDefs: Record<string, CompressedBlockDef>,
  colorById: Map<number, BlockColor>,
  vspc: Set<number>
): Block | null => {
  const definition = blockDefs[String(id)];
  if (!definition) return null;

  const [blockHash, height, heightGroupIndex] = definition;

  return {
    id,
    blockHash,
    timestamp: 0,
    parentIds: [],
    height,
    daaScore: height,
    heightGroupIndex,
    selectedParentId: null,
    color: colorById.get(id) || "blue",
    isInVirtualSelectedParentChain: vspc.has(id),
    mergeSetRedIds: [],
    mergeSetBlueIds: [],
  };
};

const buildEdge = (definition: CompressedEdgeDef | undefined): Edge | null => {
  if (!definition) return null;
  const [
    fromBlockId,
    toBlockId,
    fromHeight,
    toHeight,
    fromHeightGroupIndex,
    toHeightGroupIndex,
  ] = definition;

  return {
    fromBlockId,
    toBlockId,
    fromHeight,
    toHeight,
    fromHeightGroupIndex,
    toHeightGroupIndex,
  };
};

const decodeCompressedReplay = (
  replay: CompressedSnapshotReplayData
): SnapshotReplayData => {
  const blockIds = new Set<number>();
  const colorById = new Map<number, BlockColor>();
  const vspc = new Set<number>();
  const edgeIds = new Set<number>();
  const heightGroups = new Map<number, number>();

  const frames: SnapshotReplayFrame[] = replay.frames.map((frame) => {
    const addedBlocks = frame.b || frame.ab || [];
    const removedBlocks = frame.rb || [];
    for (const id of addedBlocks) {
      blockIds.add(id);
    }
    for (const id of removedBlocks) {
      blockIds.delete(id);
      colorById.delete(id);
      vspc.delete(id);
    }

    const colorUpdates = frame.c || frame.ac || {};
    for (const [idString, colorCode] of Object.entries(colorUpdates)) {
      colorById.set(Number(idString), colorByCode[colorCode] || "blue");
    }

    const addedVspc = frame.v || frame.av || [];
    const removedVspc = frame.rv || [];
    for (const id of addedVspc) {
      vspc.add(id);
    }
    for (const id of removedVspc) {
      vspc.delete(id);
    }

    const addedEdges = frame.e || frame.ae || [];
    const removedEdges = frame.re || [];
    for (const edgeId of addedEdges) {
      edgeIds.add(edgeId);
    }
    for (const edgeId of removedEdges) {
      edgeIds.delete(edgeId);
    }

    const upsertedHeightGroups = frame.hg || frame.ahg || [];
    for (const [height, size] of upsertedHeightGroups) {
      heightGroups.set(height, size);
    }
    for (const height of frame.rhg || []) {
      heightGroups.delete(height);
    }

    const blocks: Block[] = [];
    for (const id of sortedNumbers(blockIds)) {
      const block = buildBlock(id, replay.blocks, colorById, vspc);
      if (block) blocks.push(block);
    }

    const edges: Edge[] = [];
    for (const edgeId of sortedNumbers(edgeIds)) {
      const edge = buildEdge(replay.edges[edgeId]);
      if (edge) edges.push(edge);
    }

    const orderedHeightGroups: HeightGroup[] = sortedNumbers(
      heightGroups.keys()
    ).map((height) => ({
      height,
      size: heightGroups.get(height)!,
    }));

    return {
      t: frame.t,
      data: {
        blocks,
        edges,
        heightGroups: orderedHeightGroups,
      },
    };
  });

  return {
    durationMs: replay.durationMs,
    pollIntervalMs: replay.pollIntervalMs,
    frameCount: frames.length,
    frames,
  };
};

const normalizeReplay = (
  replay: SnapshotReplayData | CompressedSnapshotReplayData
): SnapshotReplayData => {
  if (isSnapshotReplayData(replay)) return replay;
  if (isCompressedSnapshotReplayData(replay)) return decodeCompressedReplay(replay);
  throw new Error("Unsupported snapshot replay format.");
};

export default class SnapshotReplayDataSource {
  private readonly replay: SnapshotReplayData;
  private readonly playbackRate: number;
  private readonly meanFrameDeltaMs: number;
  private readonly loopGapMs: number;
  private currentIndex: number = 0;
  private timeoutId: number | undefined;

  constructor(
    replay: SnapshotReplayData | CompressedSnapshotReplayData,
    playbackRate: number = 1
  ) {
    this.replay = normalizeReplay(replay);
    this.playbackRate =
      Number.isFinite(playbackRate) && playbackRate > 0 ? playbackRate : 1;
    this.meanFrameDeltaMs = this.calculateMeanFrameDeltaMs();
    this.loopGapMs = this.calculateLoopGapMs();
    this.scheduleNext();
  }

  private scheduleNext = () => {
    const frameCount = this.replay.frames.length;
    if (frameCount <= 1) return;

    const nextIndex = (this.currentIndex + 1) % frameCount;
    const isLoopBoundary = nextIndex === 0;
    const delayMs = isLoopBoundary
      ? this.loopGapMs
      : this.calculateInterFrameDelayMs(this.currentIndex, nextIndex);

    this.timeoutId = window.setTimeout(() => {
      this.currentIndex = nextIndex;
      this.scheduleNext();
    }, Math.max(16, delayMs / this.playbackRate));
  };

  private calculateInterFrameDelayMs(
    currentIndex: number,
    nextIndex: number
  ): number {
    const currentFrame = this.replay.frames[currentIndex];
    const nextFrame = this.replay.frames[nextIndex];
    if (!currentFrame || !nextFrame) return this.meanFrameDeltaMs;

    const delta = nextFrame.t - currentFrame.t;
    if (!Number.isFinite(delta) || delta <= 0) return this.meanFrameDeltaMs;
    return delta;
  }

  private calculateMeanFrameDeltaMs(): number {
    const frames = this.replay.frames;
    if (frames.length <= 1) return this.replay.pollIntervalMs;

    let sum = 0;
    let count = 0;
    for (let i = 1; i < frames.length; i++) {
      const delta = frames[i].t - frames[i - 1].t;
      if (Number.isFinite(delta) && delta > 0) {
        sum += delta;
        count++;
      }
    }

    if (count === 0) return this.replay.pollIntervalMs;
    return sum / count;
  }

  private calculateLoopGapMs(): number {
    const frames = this.replay.frames;
    if (frames.length === 0) return this.replay.pollIntervalMs;

    const firstT = frames[0].t;
    const lastT = frames[frames.length - 1].t;
    const recordedDuration = this.replay.durationMs;
    const candidate = recordedDuration - lastT + firstT;
    if (Number.isFinite(candidate) && candidate > 0) {
      return Math.max(this.replay.pollIntervalMs, candidate);
    }
    return this.meanFrameDeltaMs;
  }

  getHead(_heightDifference: number): BlocksAndEdgesAndHeightGroups | null {
    const frame = this.replay.frames[this.currentIndex];
    return frame?.data ?? null;
  }

  getTickInterval(): number {
    return Math.max(16, this.meanFrameDeltaMs / this.playbackRate);
  }

  destroy() {
    if (this.timeoutId !== undefined) {
      window.clearTimeout(this.timeoutId);
    }
    this.timeoutId = undefined;
  }
}
