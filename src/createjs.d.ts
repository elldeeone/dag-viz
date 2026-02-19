declare module "@createjs/core" {
  export class Ticker {
    static RAF: string;
    static timingMode: string;
  }
}

declare module "@createjs/tweenjs" {
  export class Tween {
    static get(target: any, props?: any): Tween;
    to(props: any, duration?: number, ease?: any): Tween;
    call(callback: () => void): Tween;
  }
  export class Ease {
    static quadOut: any;
    static linear: any;
  }
}
