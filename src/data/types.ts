export type BlockColor = "blue" | "red" | "gray";

export type Block = {
  id: number;
  blockHash: string;
  timestamp: number;
  parentIds: number[];
  height: number;
  daaScore: number;
  heightGroupIndex: number;
  selectedParentId: number | null;
  color: BlockColor;
  isInVirtualSelectedParentChain: boolean;
  mergeSetRedIds: number[];
  mergeSetBlueIds: number[];
};

export type Edge = {
  fromBlockId: number;
  toBlockId: number;
  fromHeight: number;
  toHeight: number;
  fromHeightGroupIndex: number;
  toHeightGroupIndex: number;
};

export type HeightGroup = {
  height: number;
  size: number;
};

export type BlocksAndEdgesAndHeightGroups = {
  blocks: Block[];
  edges: Edge[];
  heightGroups: HeightGroup[];
};

export type ReplayData = {
  blocks: ReplayDataBlock[];
  blockInterval: number;
};

export type ReplayDataBlock = {
  id: number;
  parentIds: number[];
  selectedParentId: number | null;
  color: BlockColor;
  isInVirtualSelectedParentChain: boolean;
  mergeSetRedIds: number[];
  mergeSetBlueIds: number[];
};
