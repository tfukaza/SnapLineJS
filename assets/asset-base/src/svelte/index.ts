export { default as Engine } from "./Engine.svelte";
export { default as Background } from "./Background.svelte";
export { default as Camera } from "./Camera.svelte";
export { destroyEngine, getEngine } from "./engineState.svelte.js";

import type { ElementObject } from "@snap-engine/core";
import type { Component } from "svelte";

export interface ObjectData {
  svelteComponent: Component;
  object: ElementObject;
  prop?: Record<string, unknown>;
}
