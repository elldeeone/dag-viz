import {
  Block,
  Edge,
  HeightGroup,
  BlocksAndEdgesAndHeightGroups,
  ReplayData,
  ReplayDataBlock,
} from "./types";

export default class ReplayDataSource {
  private readonly resetAfterInterval: number = 3000;
  private readonly replayData: ReplayData;

  private currentReplayBlockIndex: number = 0;
  private blockIdsToHeights: { [id: number]: number } = {};
  private dataAtHeight: {
    [height: number]: { height: number; blocks: Block[]; edges: Edge[] };
  } = {};

  private timeoutId: number | undefined;
  private onNewBlock: (() => void) | null = null;

  constructor(replayData: ReplayData) {
    this.replayData = replayData;
    this.addNextBlockAndReschedule();
  }

  setOnNewBlock(cb: () => void) {
    this.onNewBlock = cb;
  }

  private addNextBlockAndReschedule = () => {
    this.addNextBlock();

    if (this.currentReplayBlockIndex < this.replayData.blocks.length) {
      this.timeoutId = window.setTimeout(
        this.addNextBlockAndReschedule,
        this.replayData.blockInterval
      );
    } else {
      this.timeoutId = window.setTimeout(() => {
        this.reset();
        this.addNextBlockAndReschedule();
      }, this.resetAfterInterval);
    }
  };

  private addNextBlock = () => {
    const nextReplayBlock: ReplayDataBlock =
      this.replayData.blocks[this.currentReplayBlockIndex];

    let maxParentHeight = -1;
    for (const parentId of nextReplayBlock.parentIds) {
      const parentHeight = this.blockIdsToHeights[parentId];
      if (parentHeight > maxParentHeight) {
        maxParentHeight = parentHeight;
      }
    }
    const height = maxParentHeight + 1;

    let dataAtHeight = this.dataAtHeight[height];
    if (!dataAtHeight) {
      dataAtHeight = { height, blocks: [], edges: [] };
    }

    const blockId = nextReplayBlock.id;
    const blockHash = `${blockId}`.repeat(8);
    const heightGroupIndex = dataAtHeight.blocks.length;

    this.dataAtHeight[height] = dataAtHeight;
    this.blockIdsToHeights[blockId] = height;

    dataAtHeight.blocks.push({
      id: blockId,
      blockHash,
      timestamp: this.currentReplayBlockIndex * this.replayData.blockInterval,
      parentIds: nextReplayBlock.parentIds,
      height,
      daaScore: height,
      heightGroupIndex,
      selectedParentId: nextReplayBlock.selectedParentId,
      color: nextReplayBlock.color,
      isInVirtualSelectedParentChain:
        nextReplayBlock.isInVirtualSelectedParentChain,
      mergeSetRedIds: nextReplayBlock.mergeSetRedIds,
      mergeSetBlueIds: nextReplayBlock.mergeSetBlueIds,
    });

    for (const parentId of nextReplayBlock.parentIds) {
      const parentHeight = this.blockIdsToHeights[parentId];
      const parentDataAtHeight = this.dataAtHeight[parentHeight];
      const parentHeightGroupIndex = parentDataAtHeight.blocks.findIndex(
        (block) => block.id === parentId
      );

      const nextEdge: Edge = {
        fromBlockId: blockId,
        toBlockId: parentId,
        fromHeight: height,
        toHeight: parentHeight,
        fromHeightGroupIndex: heightGroupIndex,
        toHeightGroupIndex: parentHeightGroupIndex,
      };

      for (let i = height; i >= parentHeight; i--) {
        const dh = this.dataAtHeight[i];
        if (dh) dh.edges.push(nextEdge);
      }
    }

    this.currentReplayBlockIndex++;
    this.onNewBlock?.();
  };

  private reset = () => {
    this.currentReplayBlockIndex = 0;
    this.blockIdsToHeights = {};
    this.dataAtHeight = {};
  };

  getTickInterval(): number {
    return this.replayData.blockInterval;
  }

  getHead(heightDifference: number): BlocksAndEdgesAndHeightGroups | null {
    const dataLength = Object.keys(this.dataAtHeight).length;
    return this.getBlocksBetweenHeights(
      dataLength - heightDifference,
      dataLength
    );
  }

  getBlocksBetweenHeights(
    startHeight: number,
    endHeight: number
  ): BlocksAndEdgesAndHeightGroups | null {
    if (startHeight < 0) startHeight = 0;
    const maxHeight = Object.keys(this.dataAtHeight).length;
    if (endHeight > maxHeight) endHeight = maxHeight;

    const blocks: Block[] = [];
    const edges: Edge[] = [];
    const heightGroups: HeightGroup[] = [];

    const seenEdges: { [key: string]: boolean } = {};
    const seenHeights: { [h: number]: boolean } = {};

    for (let height = startHeight; height <= endHeight; height++) {
      const dh = this.dataAtHeight[height];
      if (!dh) continue;

      blocks.push(...dh.blocks);

      for (const edge of dh.edges) {
        const edgeKey = `${edge.fromBlockId}-${edge.toBlockId}`;
        if (!seenEdges[edgeKey]) {
          seenEdges[edgeKey] = true;
          edges.push(edge);
        }
        if (!seenHeights[edge.fromHeight]) {
          seenHeights[edge.fromHeight] = true;
          const fromDh = this.dataAtHeight[edge.fromHeight];
          if (fromDh)
            heightGroups.push({
              height: edge.fromHeight,
              size: fromDh.blocks.length,
            });
        }
        if (!seenHeights[edge.toHeight]) {
          seenHeights[edge.toHeight] = true;
          const toDh = this.dataAtHeight[edge.toHeight];
          if (toDh)
            heightGroups.push({
              height: edge.toHeight,
              size: toDh.blocks.length,
            });
        }
      }

      if (!seenHeights[height]) {
        seenHeights[height] = true;
        heightGroups.push({ height, size: dh.blocks.length });
      }
    }

    return { blocks, edges, heightGroups };
  }

  destroy() {
    if (this.timeoutId !== undefined) {
      window.clearTimeout(this.timeoutId);
    }
  }
}
