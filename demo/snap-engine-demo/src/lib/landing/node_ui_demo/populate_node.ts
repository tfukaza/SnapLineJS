import type { ObjectData } from "../../../../../svelte/src/lib/engine.svelte";

// import Event from "./Event.svelte";
import Math from "./Math.svelte";
import Print from "./Print.svelte";
import TextBox from "./TextBox.svelte";
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
  nodeList.push({
    svelteComponent: Print,
    prop: {},
  });
  nodeList.push({
    svelteComponent: TextBox,
    prop: {},
  });
  return nodeList;
}
export { addNode };
