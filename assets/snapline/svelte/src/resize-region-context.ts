import type { NodeMirror } from "@snap-engine/snapline";

export const resizeRegionOwnerContext = Symbol("snapline-resize-region-owner");
export type ResizeRegionOwner = NodeMirror;
