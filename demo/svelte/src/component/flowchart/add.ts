import type { ObjectData } from "../lib/snapline.svelte";
import Event from "./Event.svelte";
import Math from "./Math.svelte";

function addNode() {
  let nodeList: ObjectData[] = [];

  for (let i = 0; i < 1; i++) {
    nodeList.push({
      svelteComponent: Event,
      prop: {
        worldX: 100 + i * 100,
        worldY: 100 + i * 100,
      },
    });
  }
  nodeList.push({
    svelteComponent: Math,
    prop: {},
  });
  return nodeList;
}

export { addNode };
