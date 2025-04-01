import { SnapLine } from "../../../../../src/index";
import type { Component } from "svelte";
let snaplineDict = new Map<string, SnapLine>();

export function getSnapline(id: string) {
  if (!snaplineDict[id]) {
    snaplineDict[id] = new SnapLine();
  }
  return snaplineDict[id];
}

export interface ObjectData {
  svelteComponent: Component;
  prop: any;
}
