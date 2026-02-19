import type { BlockColor } from "../data/types";

export interface BlockLayout {
  color: number;
  highlight: number;
  contrastText: number;
  borderColor: number;
  borderWidth: number;
}

export interface EdgeLayout {
  color: number;
  lineWidth: number;
  arrowRadius: number;
}

export const heroTheme = {
  background: 0x2b2b2b,

  block: {
    roundingRadius: 10,
    referenceBlockSize: 88,
    scale: 1.0,

    blue: {
      color: 0x5581aa,
      highlight: 0x85a2c1,
      contrastText: 0xffffff,
      borderColor: 0x2b2b2b,
      borderWidth: 0,
    } as BlockLayout,
    red: {
      color: 0xb34d50,
      highlight: 0xa06765,
      contrastText: 0xffffff,
      borderColor: 0x2b2b2b,
      borderWidth: 0,
    } as BlockLayout,
    gray: {
      color: 0xdcdcdc,
      highlight: 0x949494,
      contrastText: 0x666666,
      borderColor: 0x2b2b2b,
      borderWidth: 0,
    } as BlockLayout,

    text: {
      fontFamily: 'Red Hat Mono, "Lucida Console", "Courier"',
      fontWeight: "bold" as const,
      sizeMultiplier: 0.26,
      minFontSize: 14,
      maxFontSize: 18,
      maxTextLines: 3,
    },
  },

  edge: {
    normal: {
      color: 0x787878,
      lineWidth: 2,
      arrowRadius: 5,
    } as EdgeLayout,
    virtualChain: {
      color: 0x48759d,
      lineWidth: 8,
      arrowRadius: 10,
    } as EdgeLayout,
  },

  timeline: {
    maxBlocksPerHeight: 12,
    marginXMultiplier: 2.0,
    minMarginYMultiplier: 1.0,
    visibleHeightRangePadding: 2,
  },

  scale(measure: number, blockSize: number): number {
    return (measure * blockSize) / this.block.referenceBlockSize;
  },

  getBlockLayout(color: BlockColor): BlockLayout {
    return this.block[color];
  },
};

export type HeroTheme = typeof heroTheme;
