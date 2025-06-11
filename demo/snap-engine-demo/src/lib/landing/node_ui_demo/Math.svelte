<script lang="ts">
  import { onMount } from "svelte";

  import { NodeComponent } from "./../../../../../../src/asset/node_ui/node";
  import Connector from "./../../../../../svelte/src/lib/node_ui/Connector.svelte";
  import Node from "./../../../../../svelte/src/lib/node_ui/Node.svelte";

  import Line from "./Line.svelte";
  import "./../../node_ui.scss";

  interface input {
    value: number;
    uuid: string;
  }
  let uuid: number = 2;
  let inputValues = $state<Record<string, input>>({
    "0": { value: 0, uuid: "0" },
    "1": { value: 0, uuid: "1" },
  });
  let operation = $state("+");
  let node: any = $state(null);
  let nodeObject: NodeComponent | null = null;

  function assignCallback(uuid: string) {
    nodeObject?.addSetPropCallback((value: number) => {
      calculate(uuid, value);
    }, `input-${uuid}`);
  }

  onMount(() => {
    nodeObject = (node as any).getNodeObject();
    assignCallback("0");
    assignCallback("1");
  });

  function calculate(uuid: string, value: number) {
    inputValues[uuid].value = value;
    let firstKey = Object.keys(inputValues)[0];
    let result = Number(inputValues[firstKey].value);
    for (const entry of Object.values(inputValues)) {
      const key = entry.uuid;
      if (key == firstKey) {
        continue;
      }
      if (!inputValues[key]) {
        continue;
      }
      if (operation == "+") {
        result += Number(inputValues[key].value);
      } else if (operation == "-") {
        result -= Number(inputValues[key].value);
      } else if (operation == "*") {
        result *= Number(inputValues[key].value);
      } else if (operation == "/") {
        result /= Number(inputValues[key].value);
      }
    }
    nodeObject?.setProp("output", result);
  }

  function addInput() {
    let id: string = (uuid++).toString();
    inputValues[id] = { value: 0, uuid: id };
    assignCallback(id);
  }

  function removeInput(uuid: string) {
    delete inputValues[uuid];
    const firstKey = Object.keys(inputValues)[0];
    calculate(firstKey, inputValues[firstKey].value);
  }

  function setOperation(op: string) {
    operation = op;
    const firstKey = Object.keys(inputValues)[0];
    calculate(firstKey, inputValues[firstKey].value);
  }
</script>

<Node bind:this={node} className="node card" LineSvelteComponent={Line}>
  <div class="row-container right-align op-container">
    <div>
      <button
        class="op"
        class:active={operation == "+"}
        onclick={() => {
          setOperation("+");
        }}><h1>+</h1></button
      >
      <button
        class="op"
        class:active={operation == "-"}
        onclick={() => {
          setOperation("-");
        }}><h1>-</h1></button
      >
      <button
        class="op"
        class:active={operation == "*"}
        onclick={() => {
          setOperation("*");
        }}><h1>*</h1></button
      >
      <button
        class="op"
        class:active={operation == "/"}
        onclick={() => {
          setOperation("/");
        }}><h1>/</h1></button
      >
    </div>
    <Connector name="output" maxConnectors={0} allowDragOut={true} />
  </div>

  {#each Object.values(inputValues) as input (input.uuid)}
    <div class="row-container">
      <Connector
        name={`input-${input.uuid}`}
        maxConnectors={1}
        allowDragOut={false}
      />
      <input
        type="number"
        oninput={(e) => calculate(input.uuid, (e.target as any).value)}
      />
      <button
        class="input-add-remove"
        onclick={() => {
          removeInput(input.uuid);
        }}>-</button
      >
    </div>
  {/each}
  <button
    class="input-add-remove add-input"
    style="right: 0;"
    onclick={addInput}>+</button
  >
</Node>

<style lang="scss">
</style>
