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
  <div class="row-container op-container">
    <div>
      <button
        class="op small"
        class:active={operation == "+"}
        onclick={() => {
          setOperation("+");
        }}><p>+</p></button
      >
      <button
        class="op small"
        class:active={operation == "-"}
        onclick={() => {
          setOperation("-");
        }}><p>-</p></button
      >
      <button
        class="op small"
        class:active={operation == "*"}
        onclick={() => {
          setOperation("*");
        }}><p>*</p></button
      >
      <button
        class="op small"
        class:active={operation == "/"}
        onclick={() => {
          setOperation("/");
        }}><p>/</p></button
      >
    </div>
    <Connector name="output" maxConnectors={0} allowDragOut={true} />
  </div>
  <hr>
  {#each Object.values(inputValues) as input (input.uuid)}
    <div class="row-container">
      <Connector
        name={`input-${input.uuid}`}
        maxConnectors={1}
        allowDragOut={false}
      />
      <div class="input-container">
        <input
          type="number"
          oninput={(e) => calculate(input.uuid, (e.target as any).value)}
        />
        <button
          onclick={() => {
            removeInput(input.uuid);
          }}>-</button
        >
      </div>
    </div>
  {/each}

  <div class="row-container">
    <div/>
    <div class="input-container">
      <button
        class="input-add-remove"
        style="right: 0;"
        onclick={addInput}>+</button
      >
      <button style="display:none">stub</button>
    </div>
  </div>

</Node>

<style lang="scss">
  
  .op-container {  
    height: auto!important;
    > div {
      grid-column: 2 / 3;
      width: 100%;
      display: grid;
      grid-template-columns: repeat(4, 1fr);
      gap: var(--size-8);
    
      
    }
    h1 {
      font-size: 1rem;
    }
    button {
      height: var(--size-24);
      padding: var(--size-2);
    }
  }

  .row-container {
    width: 200px;
    height: var(--size-24);
    > * {
      height: inherit;
    }
  }

  hr {
    margin: var(--size-4) 0;
    border: 1px solid var(--color-background-tint);
  }

  .input-container {
    display: grid;
    grid-template-columns: 1fr var(--size-32);
    width: 100%;
    gap: var(--size-8);

    input {
      width: 100%;
    }

    button {
      box-sizing: border-box;
      padding: 0;
      text-align: center;
    }
  }

  .input-add-remove {
    width: 100%;
    cursor: pointer;
  }




</style>
