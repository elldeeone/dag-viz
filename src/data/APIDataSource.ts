import { BlocksAndEdgesAndHeightGroups } from "./types";

export default class APIDataSource {
  private readonly apiUrl: string;
  private readonly pollInterval: number = 200;
  private pollTimeoutId: number | undefined;
  private latestData: BlocksAndEdgesAndHeightGroups | null = null;
  private lastHeightDifference: number = 14;

  constructor(apiUrl: string) {
    this.apiUrl = apiUrl;
  }

  startPolling(heightDifference: number) {
    this.lastHeightDifference = heightDifference;
    this.poll();
  }

  private poll = async () => {
    try {
      const response = await fetch(
        `${this.apiUrl}/head?heightDifference=${this.lastHeightDifference}`
      );
      if (response.ok) {
        this.latestData = await response.json();
      }
    } catch {
      // Silently retry on next poll
    }
    this.pollTimeoutId = window.setTimeout(this.poll, this.pollInterval);
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
    if (this.pollTimeoutId !== undefined) {
      window.clearTimeout(this.pollTimeoutId);
    }
  }
}
