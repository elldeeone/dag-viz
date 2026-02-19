import { BlocksAndEdgesAndHeightGroups } from "./types";

type DataListener = (data: BlocksAndEdgesAndHeightGroups) => void;

export default class APIDataSource {
  private readonly apiUrl: string;
  private readonly dataListener?: DataListener;
  private readonly pollInterval: number = 200;
  private pollTimeoutId: number | undefined;
  private latestData: BlocksAndEdgesAndHeightGroups | null = null;
  private lastHeightDifference: number = 14;
  private isDestroyed: boolean = false;

  constructor(apiUrl: string, dataListener?: DataListener) {
    this.apiUrl = apiUrl;
    this.dataListener = dataListener;
  }

  startPolling(heightDifference: number) {
    if (this.isDestroyed) return;
    this.lastHeightDifference = heightDifference;
    this.poll();
  }

  private poll = async () => {
    if (this.isDestroyed) return;

    try {
      const response = await fetch(
        `${this.apiUrl}/head?heightDifference=${this.lastHeightDifference}`
      );
      if (response.ok) {
        const data = (await response.json()) as BlocksAndEdgesAndHeightGroups;
        if (this.isDestroyed) return;
        this.latestData = data;
        this.dataListener?.(data);
      }
    } catch {
      // Silently retry on next poll
    }

    if (!this.isDestroyed) {
      this.pollTimeoutId = window.setTimeout(this.poll, this.pollInterval);
    }
  };

  getHead(heightDifference: number): BlocksAndEdgesAndHeightGroups | null {
    // Update the height difference for the next poll
    this.lastHeightDifference = heightDifference;
    return this.latestData;
  }

  getTickInterval(): number {
    return this.pollInterval;
  }

  destroy() {
    this.isDestroyed = true;
    if (this.pollTimeoutId !== undefined) {
      window.clearTimeout(this.pollTimeoutId);
    }
    this.pollTimeoutId = undefined;
  }
}
