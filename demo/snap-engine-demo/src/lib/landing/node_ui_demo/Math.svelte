<script lang="ts">
  import { onMount, tick } from "svelte";

  import { NodeComponent } from "./../../../../../../src/asset/node_ui/node";
  import type { ConnectorComponent } from "./../../../../../../src/index";
  import Connector from "./../../../../../svelte/src/lib/node_ui/Connector.svelte";
  import Node from "./../../../../../svelte/src/lib/node_ui/Node.svelte";

  import Line from "./Line.svelte";
  import "./../../node_ui.scss";

  let {nodeObject}: { nodeObject?: NodeComponent | null } = $props();

  interface input {
    value: number;
    uuid: string;
    connector: Connector | null;
    input: HTMLInputElement | null;
    editable: boolean;
  }
  let uuid: number = 2;
  let inputValues = $state<Record<string, input>>({
    "0": { value: 0, uuid: "0", connector: null, input: null, editable: true },
    "1": { value: 0, uuid: "1", connector: null, input: null, editable: true },
  });
  let operation = $state("+");
  let node: any = $state(null);

  function assignCallback(uuid: string) {
    nodeObject?.addSetPropCallback((value: number) => {
      calculate(uuid, value);
    }, `input-${uuid}`);
  }

  onMount(() => {
    if (!nodeObject) {
      nodeObject = (node as any).getNodeObject();
    }
    assignCallback("0");
    setUpCallback("0");
    assignCallback("1");
    setUpCallback("1");
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

  function setUpCallback(id: string) {
    const connector = inputValues[id].connector!.object();
    const inputElement = inputValues[id].input!;
    connector.connectorCallback.onConnectIncoming = (_: ConnectorComponent) => {
      inputElement.value = "";
      inputValues[id].editable = false;
    };
    connector.connectorCallback.onDisconnectIncoming = (_: ConnectorComponent) => {
      inputElement.value = inputValues[id].value.toString();
      inputValues[id].editable = true;
    };

    if (inputElement) {
      inputElement.focus();
      inputElement.select();
    }
  }

  function addInput() {
    let id: string = (uuid++).toString();
    inputValues[id] = { value: 0, uuid: id, connector: null, input: null, editable: true };
    assignCallback(id);
    tick().then(() => {
      setUpCallback(id);
    });
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

<Node bind:this={node} className="node card" LineSvelteComponent={Line} nodeObject={nodeObject}>
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
        bind:this={input.connector}
      />
      <div class="input-container">
        <input
          type="number"
          bind:this={input.input}
          disabled={!input.editable}
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
