import { ElementObject, SnapLine } from "../../../../src/index";
import type { Component } from "svelte";
let engineDict: { [key: string]: SnapLine } = {};

export function getEngine(id: string) {
  if (!engineDict[id]) {
    engineDict[id] = new SnapLine();
  }
  return engineDict[id];
}

export interface ObjectData {
  svelteComponent: Component;
  object: ElementObject;
  prop?: { [key: string]: any };
}
