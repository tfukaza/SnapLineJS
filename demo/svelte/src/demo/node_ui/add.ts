import type { ObjectData } from "../../lib2/engine.svelte";

// import Event from "./Event.svelte";
import Math from "./Math.svelte";

function addNode() {
  let nodeList: ObjectData[] = [];

  nodeList.push({
    svelteComponent: Math,
    prop: {},
  });
  nodeList.push({
    svelteComponent: Math,
    prop: {},
  });
  nodeList.push({
    svelteComponent: Math,
    prop: {},
  });
  return nodeList;
}
export { addNode };
