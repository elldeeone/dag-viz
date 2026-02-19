import * as PIXI from "pixi.js-legacy";
import { Ticker } from "@createjs/core";
import HeroTimeline from "./HeroTimeline";
import ReplayDataSource from "../data/ReplayDataSource";
import APIDataSource from "../data/APIDataSource";
import SnapshotReplayDataSource from "../data/SnapshotReplayDataSource";
import { heroTheme } from "./theme";
import type { BlocksAndEdgesAndHeightGroups, ReplayData } from "../data/types";

type DataSource = ReplayDataSource | APIDataSource | SnapshotReplayDataSource;

export default class HeroDag {
  private application: PIXI.Application | undefined;
  private timeline: HeroTimeline | undefined;
  private dataSource: DataSource | undefined;
  private tickId: number | undefined;
  private lastRenderedData: BlocksAndEdgesAndHeightGroups | null = null;

  private currentScale: number;
  private currentWidth: number = 0;
  private currentHeight: number = 0;
  private isVisible: boolean = true;
  private observer: IntersectionObserver | undefined;

  constructor(scale: number = 0.4) {
    this.currentScale = Math.round(Math.max(0.2, Math.min(scale, 1.2)) * 10) / 10;
    Ticker.timingMode = Ticker.RAF;
  }

  initialize(canvas: HTMLCanvasElement) {
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const parentElement = canvas.parentElement!;

    this.application = new PIXI.Application({
      backgroundColor: heroTheme.background,
      view: canvas,
      resizeTo: parentElement,
      antialias: true,
      resolution: dpr,
      autoDensity: true,
    });

    this.timeline = new HeroTimeline(this.application);
    this.timeline.setScaleGetter(() => this.currentScale);
    this.application.stage.addChild(this.timeline);

    // Resize check
    this.application.ticker.add(this.resizeIfRequired);

    this.application.start();

    // IntersectionObserver to pause when offscreen
    this.observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          this.isVisible = entry.isIntersecting;
          if (this.isVisible) {
            this.application?.start();
          } else {
            this.application?.stop();
          }
        }
      },
      { threshold: 0 }
    );
    this.observer.observe(canvas);

    this.resize();
  }

  loadAPI(apiUrl: string) {
    console.info(`[DAG Hero] Live API mode: ${apiUrl}`);
    const ds = new APIDataSource(apiUrl);
    this.dataSource = ds;
    ds.startPolling(14);
    this.run();
  }

  async loadReplay(url: string) {
    console.info(`[DAG Hero] Replay mode: ${url}`);
    const resp = await fetch(url);
    if (!resp.ok) {
      throw new Error(`Replay fetch failed (${resp.status} ${resp.statusText})`);
    }

    const replayData: ReplayData = await resp.json();
    const ds = new ReplayDataSource(replayData);
    this.dataSource = ds;

    ds.setOnNewBlock(() => {
      // Debounce - only update on tick
    });

    this.run();
  }

  async loadSnapshotReplay(url: string, playbackRate: number = 1) {
    console.info(
      `[DAG Hero] Snapshot replay mode: ${url} (speed=${playbackRate}x)`
    );
    const resp = await fetch(url);
    if (!resp.ok) {
      throw new Error(
        `Snapshot replay fetch failed (${resp.status} ${resp.statusText})`
      );
    }

    const replayData = await resp.json();
    this.dataSource = new SnapshotReplayDataSource(replayData, playbackRate);
    this.run();
  }

  private resize() {
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const renderer = this.application?.renderer;
    if (!renderer) return;

    const resizeTo = this.application?.resizeTo as HTMLDivElement;

    if (renderer.resolution !== dpr) {
      renderer.resolution = dpr;
      renderer.resize(resizeTo.clientWidth, resizeTo.clientHeight);
    }

    this.timeline?.recalculatePositions();
  }

  private resizeIfRequired = () => {
    const w = this.getDisplayWidth();
    const h = this.getDisplayHeight();
    if (this.currentWidth !== w || this.currentHeight !== h) {
      this.currentWidth = w;
      this.currentHeight = h;
      this.resize();
    }
  };

  private getDisplayHeight() {
    return this.application?.renderer.screen.height ?? 0;
  }

  private getDisplayWidth() {
    return this.application?.renderer.screen.width ?? 0;
  }

  private run() {
    window.clearTimeout(this.tickId);
    this.lastRenderedData = null;
    this.tick();
  }

  private tick = () => {
    if (!this.dataSource || !this.timeline) return;

    const maxBlockAmountOnHalfTheScreen =
      this.timeline.getMaxBlockAmountOnHalfTheScreen();
    const heightDifference =
      this.timeline.getVisibleSlotAmountAfterHalfTheScreen(120);
    const data = this.dataSource.getHead(
      maxBlockAmountOnHalfTheScreen + heightDifference
    );

    if (data && data !== this.lastRenderedData) {
      this.lastRenderedData = data;
      let maxHeight = 0;
      for (const block of data.blocks) {
        if (block.height > maxHeight) maxHeight = block.height;
      }

      const targetHeight = Math.max(0, maxHeight - heightDifference);
      this.timeline.setTargetHeight(targetHeight);
      this.timeline.setBlocksAndEdgesAndHeightGroups(data);
    }

    this.scheduleNextTick();
  };

  private scheduleNextTick() {
    const interval = this.dataSource?.getTickInterval() ?? 500;
    this.tickId = window.setTimeout(this.tick, interval);
  }

  stop() {
    window.clearTimeout(this.tickId);
    this.tickId = undefined;
    this.lastRenderedData = null;
    this.observer?.disconnect();
    this.dataSource?.destroy();
    this.dataSource = undefined;
    if (this.application) {
      this.application.stop();
      // Don't pass true to destroy() - we manage canvas removal in React
      this.application.destroy(false, { children: true });
    }
    this.application = undefined;
    this.timeline = undefined;
  }
}
