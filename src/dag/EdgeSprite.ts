import "@pixi/graphics-extras";
import * as PIXI from "pixi.js-legacy";
import { heroTheme } from "./theme";

export default class HeroEdgeSprite extends PIXI.Container {
  private readonly fromBlockId: number;
  private readonly toBlockId: number;

  private vectorX: number = 0;
  private vectorY: number = 0;
  private blockSize: number = 0;
  private blockBoundsVectorX: number = 0;
  private blockBoundsVectorY: number = 0;
  private isVectorInitialized: boolean = false;
  private toY: number = 0;
  private isInVirtualSelectedParentChain: boolean = false;

  private graphics: PIXI.Graphics;

  constructor(_application: PIXI.Application, fromBlockId: number, toBlockId: number) {
    super();

    this.fromBlockId = fromBlockId;
    this.toBlockId = toBlockId;

    this.graphics = new PIXI.Graphics();
    this.addChild(this.graphics);
  }

  setVector(
    vectorX: number,
    vectorY: number,
    blockSize: number,
    _margin: number,
    blockBoundsVectorX: number,
    blockBoundsVectorY: number
  ) {
    if (
      this.vectorX !== vectorX ||
      this.vectorY !== vectorY ||
      this.blockSize !== blockSize ||
      this.blockBoundsVectorX !== blockBoundsVectorX ||
      this.blockBoundsVectorY !== blockBoundsVectorY
    ) {
      this.vectorX = vectorX;
      this.vectorY = vectorY;
      this.blockSize = blockSize;
      this.blockBoundsVectorX = blockBoundsVectorX;
      this.blockBoundsVectorY = blockBoundsVectorY;

      this.renderEdge();
    }
    this.isVectorInitialized = true;
  }

  wasVectorSet(): boolean {
    return this.isVectorInitialized;
  }

  private renderEdge() {
    const def = this.isInVirtualSelectedParentChain
      ? heroTheme.edge.virtualChain
      : heroTheme.edge.normal;

    const lineWidth = heroTheme.scale(def.lineWidth, this.blockSize);
    const arrowRadius = heroTheme.scale(def.arrowRadius, this.blockSize);
    const color = def.color;

    const toX = this.vectorX - this.blockBoundsVectorX;
    const toY = this.vectorY - this.blockBoundsVectorY;

    const angleRadians = Math.atan2(this.vectorY, this.vectorX) + Math.PI / 2;
    const toVectorMagnitude = Math.sqrt(toX ** 2 + toY ** 2);
    const totalArrowRadius = arrowRadius + lineWidth;

    const arrowOffsetX = (-toX * totalArrowRadius) / toVectorMagnitude;
    const arrowOffsetY = (-toY * totalArrowRadius) / toVectorMagnitude;
    const arrowX = toX + arrowOffsetX;
    const arrowY = toY + arrowOffsetY;

    this.graphics.clear();
    this.graphics.lineStyle(lineWidth, color);
    this.graphics.moveTo(0, 0);
    this.graphics.lineTo(toX + arrowOffsetX, toY + arrowOffsetY);

    this.graphics.beginFill(color);
    (this.graphics as any).drawStar(
      arrowX,
      arrowY,
      3,
      arrowRadius,
      0,
      angleRadians
    );
    this.graphics.endFill();
  }

  setToY(toY: number) {
    this.toY = toY;
  }

  getToY(): number {
    return this.toY;
  }

  setIsInVirtualSelectedParentChain(isIn: boolean) {
    if (this.isInVirtualSelectedParentChain !== isIn) {
      this.isInVirtualSelectedParentChain = isIn;
      if (this.isVectorInitialized) {
        this.renderEdge();
      }
    }
  }

  getFromBlockId(): number {
    return this.fromBlockId;
  }

  getToBlockId(): number {
    return this.toBlockId;
  }
}
