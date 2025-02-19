import { NodeComponent } from "../../lib/snapline.mjs";
import Event from "./Event.svelte";

function addNode() {
  let nodeList: NodeComponent[] = [];
  let node: NodeComponent | null = null;
  let prop: any = null;

  node = new NodeComponent(-100, -100);
  prop = node._prop;
  prop.nodeSvelteComponent = Event;
  nodeList.push(node);

  node = new NodeComponent(-100, -100);
  prop = node._prop;
  prop.nodeSvelteComponent = Event;
  nodeList.push(node);

  return nodeList;
}

export default addNode;
