import { NodeComponent, SnapLine } from "../../lib/snapline.mjs";
import Event from "./Event.svelte";

interface ObjectData {
  class: typeof NodeComponent;
  component: typeof Event;
  positionX: number;
  positionY: number;
  prop: any;
  added: boolean;
}

function addNode() {
  let nodeList: ObjectData[] = [];

  // Add 8 nodes in a grid pattern
  for (let i = 0; i < 16; i++) {
    nodeList.push({
      class: NodeComponent,
      component: Event,
      positionX: (i % 2) * 300,
      positionY: Math.floor(i / 2) * 100,
      prop: null,
      added: false,
    });
  }

  return nodeList;
}

export { ObjectData, addNode };
