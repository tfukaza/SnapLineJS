import { NodeComponent } from "../../lib/snapline.mjs";
import State from "./State.svelte";

function addNode() {
  let nodeList: NodeComponent[] = [];
  let node: NodeComponent | null = null;
  let prop: any = null;

  for (let i = 0; i < 8; i++) {
    let randomX = (Math.random() - 0.5) * 500;
    let randomY = (Math.random() - 0.5) * 500;
    node = new NodeComponent(randomX, randomY);
    prop = node._prop;
    prop.nodeSvelteComponent = State;
    nodeList.push(node);
  }

  return nodeList;
}

export default addNode;
