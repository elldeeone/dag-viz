import * as PIXI from "pixi.js";
import { Ease, Tween } from "@createjs/tweenjs";
import {
  Block,
  Edge,
  HeightGroup,
  BlocksAndEdgesAndHeightGroups,
} from "../data/types";
import HeroBlockSprite from "./BlockSprite";
import HeroEdgeSprite from "./EdgeSprite";
import { heroTheme } from "./theme";

const SPRITE_FADE_MS = 500;
const BLOCK_MOVE_MS = 500;
const EDGE_FOLLOW_BUFFER_MS = 64;

export default class HeroTimeline extends PIXI.Container {
  private readonly application: PIXI.Application;
  private readonly edgeContainer: PIXI.Container;
  private readonly blockContainer: PIXI.Container;

  private readonly blockKeysToBlockSprites: { [key: string]: HeroBlockSprite } =
    {};
  private readonly edgeKeysToEdgeSprites: { [key: string]: HeroEdgeSprite } =
    {};

  private currentData: BlocksAndEdgesAndHeightGroups | null = null;

  private blockKeysToBlocks: { [key: string]: Block } = {};
  private edgeKeysToEdges: { [key: string]: Edge } = {};
  private heightKeysToHeightGroups: { [key: string]: HeightGroup } = {};
  private targetHeight: number = -1;
  private edgeFollowUntilMs: number = 0;

  private scaleGetter: () => number;

  constructor(application: PIXI.Application) {
    super();

    this.application = application;

    this.scaleGetter = () => 1.0;

    this.edgeContainer = new PIXI.Container();
    this.addChild(this.edgeContainer);

    this.blockContainer = new PIXI.Container();
    this.addChild(this.blockContainer);

    this.application.ticker.add(this.syncEdgesWithBlocks);
  }

  setScaleGetter(getter: () => number) {
    this.scaleGetter = getter;
  }

  setBlocksAndEdgesAndHeightGroups(data: BlocksAndEdgesAndHeightGroups) {
    this.currentData = data;

    if (this.targetHeight < 0) {
      this.recalculateTargetHeight();
    }

    const { blocks, edges, heightGroups } = data;

    this.blockKeysToBlocks = {};
    for (const block of blocks) {
      this.blockKeysToBlocks[`${block.id}`] = block;
    }

    this.edgeKeysToEdges = {};
    for (const edge of edges) {
      this.edgeKeysToEdges[`${edge.fromBlockId}-${edge.toBlockId}`] = edge;
    }

    this.heightKeysToHeightGroups = {};
    for (const hg of heightGroups) {
      this.heightKeysToHeightGroups[`${hg.height};`] = hg;
    }

    // Remove stale block sprites
    for (const [key, sprite] of Object.entries(this.blockKeysToBlockSprites)) {
      if (!this.blockKeysToBlocks[key]) {
        delete this.blockKeysToBlockSprites[key];
        this.blockContainer.removeChild(sprite);
      }
    }

    // Remove stale edge sprites
    for (const [key, sprite] of Object.entries(this.edgeKeysToEdgeSprites)) {
      if (!this.edgeKeysToEdges[key]) {
        delete this.edgeKeysToEdgeSprites[key];
        this.edgeContainer.removeChild(sprite);
      }
    }

    // Update existing block sprites
    for (const block of blocks) {
      const key = `${block.id}`;
      const existing = this.blockKeysToBlockSprites[key];
      if (existing) {
        existing.setColor(block.color);
      }
    }

    // Add new block sprites
    for (const block of blocks) {
      const key = `${block.id}`;
      if (!this.blockKeysToBlockSprites[key]) {
        const sprite = new HeroBlockSprite(this.application, block);
        this.blockKeysToBlockSprites[key] = sprite;
        this.blockContainer.addChild(sprite);
        sprite.alpha = 0.0;
        Tween.get(sprite).to({ alpha: 1.0 }, SPRITE_FADE_MS);
      }
    }

    // Update existing edge sprites
    for (const edge of edges) {
      const edgeKey = `${edge.fromBlockId}-${edge.toBlockId}`;
      const existing = this.edgeKeysToEdgeSprites[edgeKey];
      if (existing) {
        this.assignEdgeState(existing, edge);
      }
    }

    // Add new edge sprites
    for (const edge of edges) {
      const edgeKey = `${edge.fromBlockId}-${edge.toBlockId}`;
      if (!this.edgeKeysToEdgeSprites[edgeKey]) {
        const sprite = new HeroEdgeSprite(
          this.application,
          edge.fromBlockId,
          edge.toBlockId
        );
        this.assignEdgeState(sprite, edge);
        this.edgeKeysToEdgeSprites[edgeKey] = sprite;
        this.edgeContainer.addChild(sprite);
        sprite.alpha = 0.0;
        Tween.get(sprite).to({ alpha: 1.0 }, SPRITE_FADE_MS);
      }
    }

    this.recalculateSpritePositions(true);
  }

  private assignEdgeState(sprite: HeroEdgeSprite, edge: Edge) {
    const fromBlock = this.blockKeysToBlocks[`${edge.fromBlockId}`];
    const toBlock = this.blockKeysToBlocks[`${edge.toBlockId}`];
    const isInVSPC =
      fromBlock?.isInVirtualSelectedParentChain &&
      toBlock?.isInVirtualSelectedParentChain;
    sprite.setIsInVirtualSelectedParentChain(!!isInVSPC);
  }

  private recalculateSpritePositions(animate: boolean) {
    const rendererHeight = this.getDisplayHeight();
    const blockSize = this.calculateBlockSize(rendererHeight);
    const marginX = this.calculateMarginX(blockSize);
    let startedBlockTween = false;

    for (const [key, block] of Object.entries(this.blockKeysToBlocks)) {
      const sprite = this.blockKeysToBlockSprites[key];
      if (!sprite) continue;

      const wasSet = sprite.wasBlockSizeSet();
      sprite.setSize(blockSize);

      const hg = this.heightKeysToHeightGroups[`${block.height};`];
      if (!hg) continue;

      sprite.x = this.calculateBlockSpriteX(block.height, blockSize, marginX);
      const targetY = this.calculateBlockSpriteY(
        block.heightGroupIndex,
        hg.size,
        rendererHeight,
        blockSize
      );

      if (sprite.y !== targetY) {
        if (!wasSet || !animate) {
          sprite.y = targetY;
        } else {
          startedBlockTween = true;
          Tween.get(sprite).to({ y: targetY }, BLOCK_MOVE_MS, Ease.quadOut);
        }
      }
    }

    this.recalculateEdgeSpritePositions(blockSize, marginX);

    if (startedBlockTween) {
      this.markEdgeFollowWindow(BLOCK_MOVE_MS);
    }
  }

  recalculatePositions() {
    this.moveTimeline();
    this.recalculateSpritePositions(false);
  }

  private moveTimeline() {
    const rendererWidth = this.getDisplayWidth();
    const rendererHeight = this.getDisplayHeight();
    const blockSize = this.calculateBlockSize(rendererHeight);
    const marginX = this.calculateMarginX(blockSize);

    const blockSpriteXForTarget = this.calculateBlockSpriteX(
      this.targetHeight,
      blockSize,
      marginX
    );

    this.y = rendererHeight / 2;

    if (this.targetHeight >= 0) {
      const targetX = rendererWidth / 2 - blockSpriteXForTarget;
      if (Math.abs(this.x - targetX) < rendererWidth) {
        Tween.get(this).to({ x: targetX }, BLOCK_MOVE_MS, Ease.quadOut);
      } else {
        this.x = targetX;
      }
    }
  }

  setTargetHeight(targetHeight: number) {
    this.targetHeight = targetHeight;
    this.moveTimeline();
  }

  private recalculateTargetHeight() {
    if (this.currentData) {
      let maxH = 0;
      for (const hg of this.currentData.heightGroups) {
        if (hg.height > maxH) maxH = hg.height;
      }
      this.targetHeight = maxH;
    }
  }

  getMaxBlockAmountOnHalfTheScreen(): number {
    const rendererWidth = this.getDisplayWidth();
    const rendererHeight = this.getDisplayHeight();
    const blockSize = this.calculateBlockSize(rendererHeight);
    const marginX = this.calculateMarginX(blockSize);
    const maxBlockAmountOnScreen = rendererWidth / (blockSize + marginX);
    return (
      Math.ceil(maxBlockAmountOnScreen / 2) +
      heroTheme.timeline.visibleHeightRangePadding
    );
  }

  getVisibleSlotAmountAfterHalfTheScreen(rightMargin: number): number {
    const rendererWidth = this.getDisplayWidth();
    const rendererHeight = this.getDisplayHeight();
    const blockSize = this.calculateBlockSize(rendererHeight);
    const marginX = this.calculateMarginX(blockSize);
    const heightWidth = blockSize + marginX;
    const widthBetween = Math.max(
      0,
      (rendererWidth - heightWidth) / 2 - rightMargin + marginX / 2
    );
    return Math.floor(widthBetween / heightWidth);
  }

  private calculateBlockSpriteY(
    heightGroupIndex: number,
    heightGroupSize: number,
    rendererHeight: number,
    blockSize: number
  ): number {
    if (heightGroupSize === 1) return 0;
    if (heightGroupIndex === 0 && heightGroupSize % 2 === 1) return 0;

    let offsetGroupIndex =
      heightGroupIndex * 2 + ((heightGroupSize - heightGroupIndex - 1) % 2);
    const signMultiplier = heightGroupSize % 2 === 0 ? 1 : -1;
    const centeredIndex =
      Math.ceil(offsetGroupIndex / 2) *
      (-1) ** (offsetGroupIndex + 1) *
      signMultiplier;

    const marginY = this.calculateMarginY(
      blockSize,
      heightGroupSize,
      rendererHeight
    );
    return (centeredIndex * (blockSize + marginY)) / 2;
  }

  private calculateBlockSpriteX(
    blockHeight: number,
    blockSize: number,
    margin: number
  ): number {
    return blockHeight * (blockSize + margin);
  }

  private calculateBlockSize(rendererHeight: number): number {
    return Math.floor(
      (rendererHeight * this.scaleGetter()) /
        heroTheme.timeline.maxBlocksPerHeight
    );
  }

  private calculateMarginX(blockSize: number): number {
    return blockSize * heroTheme.timeline.marginXMultiplier;
  }

  private calculateMarginY(
    blockSize: number,
    heightGroupSize: number,
    rendererHeight: number
  ): number {
    const minMarginY = blockSize * heroTheme.timeline.minMarginYMultiplier;
    const nominalRendererHeight = Math.min(
      rendererHeight,
      rendererHeight * this.scaleGetter()
    );
    let marginY = Math.max(
      minMarginY,
      nominalRendererHeight / heightGroupSize - blockSize
    );
    if ((blockSize + marginY) * heightGroupSize > rendererHeight) {
      marginY = Math.max(0, rendererHeight / heightGroupSize - blockSize);
    }
    return marginY;
  }

  private recalculateEdgeSpritePositions(
    blockSize: number = this.calculateBlockSize(this.getDisplayHeight()),
    marginX: number = this.calculateMarginX(blockSize)
  ) {
    for (const [, edge] of Object.entries(this.edgeKeysToEdges)) {
      const edgeSprite =
        this.edgeKeysToEdgeSprites[`${edge.fromBlockId}-${edge.toBlockId}`];
      if (!edgeSprite) continue;

      const fromSprite = this.blockKeysToBlockSprites[`${edge.fromBlockId}`];
      const toSprite = this.blockKeysToBlockSprites[`${edge.toBlockId}`];
      if (!fromSprite || !toSprite) continue;

      const vectorX = toSprite.x - fromSprite.x;
      const vectorY = toSprite.y - fromSprite.y;
      const { blockBoundsVectorX, blockBoundsVectorY } =
        HeroBlockSprite.clampVectorToBounds(blockSize, vectorX, vectorY);

      edgeSprite.setVector(
        vectorX,
        vectorY,
        blockSize,
        marginX,
        blockBoundsVectorX,
        blockBoundsVectorY
      );
      edgeSprite.setToY(toSprite.y);
      edgeSprite.x = fromSprite.x;
      edgeSprite.y = fromSprite.y;
    }
  }

  private markEdgeFollowWindow(durationMs: number) {
    this.edgeFollowUntilMs = Math.max(
      this.edgeFollowUntilMs,
      performance.now() + durationMs + EDGE_FOLLOW_BUFFER_MS
    );
  }

  private syncEdgesWithBlocks = () => {
    if (performance.now() > this.edgeFollowUntilMs) return;
    this.recalculateEdgeSpritePositions();
  };

  override destroy(options?: PIXI.DestroyOptions) {
    const appWithNullableTicker = this.application as PIXI.Application & {
      ticker?: PIXI.Ticker | null;
    };
    appWithNullableTicker.ticker?.remove?.(this.syncEdgesWithBlocks);
    super.destroy(options);
  }

  private getDisplayHeight() {
    return this.application.renderer.screen.height;
  }

  private getDisplayWidth() {
    return this.application.renderer.screen.width;
  }
}
