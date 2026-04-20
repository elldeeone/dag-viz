import * as PIXI from "pixi.js";
import { Block, BlockColor } from "../data/types";
import { heroTheme } from "./theme";

const blockTextures = new Map<string, PIXI.RenderTexture>();
type RendererLike = PIXI.Renderer;
const rendererFallbackIds = new WeakMap<RendererLike, number>();
let nextRendererFallbackId = 1;

const getRendererContextKey = (renderer: RendererLike): string => {
  if ("CONTEXT_UID" in renderer) {
    return String(renderer.CONTEXT_UID);
  }

  let fallbackId = rendererFallbackIds.get(renderer);
  if (!fallbackId) {
    fallbackId = nextRendererFallbackId++;
    rendererFallbackIds.set(renderer, fallbackId);
  }

  return `renderer-fallback-${fallbackId}`;
};

const isTextureReusable = (texture: PIXI.RenderTexture | undefined): boolean =>
  !!texture &&
  !texture.destroyed &&
  !texture.source.destroyed &&
  texture.width > 0 &&
  texture.height > 0;

const getBlockTexture = (
  application: PIXI.Application,
  blockSize: number,
  blockColor: BlockColor
): PIXI.RenderTexture => {
  const resolution = application.renderer.resolution;
  const rendererKey = getRendererContextKey(application.renderer);
  const key = `${rendererKey}-${blockSize}-${blockColor}-${resolution}`;
  const existing = blockTextures.get(key);

  if (!isTextureReusable(existing)) {
    const layout = heroTheme.getBlockLayout(blockColor);
    const graphics = new PIXI.Graphics()
      .roundRect(
        0,
        0,
        blockSize,
        blockSize,
        heroTheme.scale(heroTheme.block.roundingRadius, blockSize)
      )
      .fill(0xffffff);

    if (layout.borderWidth > 0) {
      graphics.stroke({
        width: heroTheme.scale(layout.borderWidth, blockSize),
        color: layout.borderColor,
        alpha: 1,
        alignment: 0.5,
      });
    }

    blockTextures.set(
      key,
      application.renderer.textureGenerator.generateTexture({
        target: graphics,
        resolution,
        antialias: true,
        textureSourceOptions: {
          scaleMode: "linear",
        },
      })
    );
  }

  const texture = blockTextures.get(key);
  if (!texture) {
    throw new Error("Failed to create DAG block texture.");
  }

  return texture;
};

export const destroyBlockTexturesForRenderer = (renderer: RendererLike) => {
  const rendererKeyPrefix = `${getRendererContextKey(renderer)}-`;
  for (const [key, texture] of blockTextures.entries()) {
    if (!key.startsWith(rendererKeyPrefix)) continue;

    if (!texture.destroyed) {
      texture.destroy(true);
    }

    blockTextures.delete(key);
  }
};

function chunkSubstr(str: string, size: number): string[] {
  const chunks: string[] = [];
  for (let i = 0; i < str.length; i += size) {
    chunks.push(str.substring(i, i + size));
  }
  return chunks;
}

export default class HeroBlockSprite extends PIXI.Container {
  private readonly application: PIXI.Application;
  private readonly block: Block;
  private readonly spriteContainer: PIXI.Container;
  private readonly textContainer: PIXI.Container;

  private blockSize: number = 0;
  private isBlockSizeInitialized: boolean = false;
  private blockColor: BlockColor;
  private currentSprite: PIXI.Sprite;

  constructor(application: PIXI.Application, block: Block) {
    super();

    this.application = application;
    this.block = block;
    this.blockColor = block.color;

    this.spriteContainer = new PIXI.Container();
    this.addChild(this.spriteContainer);

    this.textContainer = new PIXI.Container();
    this.addChild(this.textContainer);

    this.currentSprite = this.buildSprite();
    this.spriteContainer.addChild(this.currentSprite);

    this.scale.set(heroTheme.block.scale, heroTheme.block.scale);
  }

  private buildSprite(): PIXI.Sprite {
    const sprite = new PIXI.Sprite();
    sprite.anchor.set(0.5, 0.5);
    const layout = heroTheme.getBlockLayout(this.blockColor);
    sprite.tint = layout.color;
    return sprite;
  }

  private buildText(blockSize: number): PIXI.Text | null {
    const cfg = heroTheme.block.text;
    const nominalFontSize = blockSize * cfg.sizeMultiplier * 2;
    const textLines =
      nominalFontSize <= cfg.minFontSize - 2
        ? Math.max(
            1,
            Math.min(
              Math.floor(nominalFontSize / cfg.minFontSize),
              cfg.maxTextLines
            )
          )
        : Math.max(
            1,
            Math.min(
              Math.ceil((nominalFontSize + 2) / cfg.maxFontSize),
              cfg.maxTextLines
            )
          );

    const fontSize =
      Math.floor(
        Math.min(nominalFontSize / textLines, cfg.maxFontSize) * 4.0
      ) / 4.0;

    if (fontSize < 6) return null;

    const style = new PIXI.TextStyle({
      fontFamily: cfg.fontFamily,
      fontSize,
      fontWeight: cfg.fontWeight,
      fill: heroTheme.getBlockLayout(this.blockColor).contrastText,
    });

    const lineLength = textLines * 2;
    const lastCharsLength = lineLength * textLines;
    const lastChars = this.block.blockHash
      .substring(this.block.blockHash.length - lastCharsLength)
      .toUpperCase();
    const displayHash = chunkSubstr(lastChars, lineLength).join("\n");

    const text = new PIXI.Text({ text: displayHash, style });
    text.anchor.set(0.5, 0.5);
    return text;
  }

  setSize(blockSize: number) {
    if (!this.currentSprite.texture || this.blockSize !== blockSize) {
      this.blockSize = blockSize;
      this.currentSprite.texture = getBlockTexture(
        this.application,
        blockSize,
        this.blockColor
      );

      this.textContainer.removeChildren();
      const text = this.buildText(blockSize);
      if (text) this.textContainer.addChild(text);
    }
    this.isBlockSizeInitialized = true;
  }

  wasBlockSizeSet(): boolean {
    return this.isBlockSizeInitialized;
  }

  setColor(color: BlockColor) {
    if (this.blockColor !== color) {
      this.blockColor = color;
      const layout = heroTheme.getBlockLayout(color);
      this.currentSprite.tint = layout.color;
      if (this.blockSize > 0) {
        this.currentSprite.texture = getBlockTexture(
          this.application,
          this.blockSize,
          color
        );
        this.textContainer.removeChildren();
        const text = this.buildText(this.blockSize);
        if (text) this.textContainer.addChild(text);
      }
    }
  }

  static getRealBlockSize(blockSize: number): number {
    return blockSize * heroTheme.block.scale;
  }

  static clampVectorToBounds(
    blockSize: number,
    vectorX: number,
    vectorY: number
  ): { blockBoundsVectorX: number; blockBoundsVectorY: number } {
    const realBlockSize = HeroBlockSprite.getRealBlockSize(blockSize);
    const halfBlockSize = realBlockSize / 2;

    if (vectorY === 0) {
      return {
        blockBoundsVectorX: vectorX >= 0 ? halfBlockSize : -halfBlockSize,
        blockBoundsVectorY: 0,
      };
    }

    const roundingRadius = heroTheme.scale(
      heroTheme.block.roundingRadius,
      blockSize
    );
    const halfBlockSizeMinusCorner = halfBlockSize - roundingRadius;
    const tangentOfAngle = Math.abs(vectorY) / Math.abs(vectorX);

    const yForHalfBlockSize = halfBlockSize * tangentOfAngle;
    if (yForHalfBlockSize <= halfBlockSizeMinusCorner) {
      return {
        blockBoundsVectorX: vectorX >= 0 ? halfBlockSize : -halfBlockSize,
        blockBoundsVectorY:
          vectorY >= 0 ? yForHalfBlockSize : -yForHalfBlockSize,
      };
    }

    const xForHalfBlockSize = halfBlockSize / tangentOfAngle;
    if (xForHalfBlockSize <= halfBlockSizeMinusCorner) {
      return {
        blockBoundsVectorX:
          vectorX >= 0 ? xForHalfBlockSize : -xForHalfBlockSize,
        blockBoundsVectorY: vectorY >= 0 ? halfBlockSize : -halfBlockSize,
      };
    }

    const a = tangentOfAngle ** 2 + 1;
    const b = -(2 * halfBlockSizeMinusCorner * (tangentOfAngle + 1));
    const c = 2 * halfBlockSizeMinusCorner ** 2 - roundingRadius ** 2;
    const x = (-b + Math.sqrt(b ** 2 - 4 * a * c)) / (2 * a);
    const y = x * tangentOfAngle;

    return {
      blockBoundsVectorX: vectorX >= 0 ? x : -x,
      blockBoundsVectorY: vectorY >= 0 ? y : -y,
    };
  }
}
