<script lang="ts">
  import { onMount, tick } from "svelte";

  import { NodeMirror } from "@snap-engine/snapline";
  import { Connector, Node } from "@snap-engine/snapline-svelte";

  import Line from "./Line.svelte";
  import "./../../node_ui.scss";

  let {nodeObject}: { nodeObject?: NodeMirror | null } = $props();

  interface input {
    value: number;
    id: string;
    connector: Connector | null;
    input: HTMLInputElement | null;
    editable: boolean;
  }
  let nextInputId: number = 2;
  let inputValues = $state<Record<string, input>>({
    "0": { value: 0, id: "0", connector: null, input: null, editable: true },
    "1": { value: 0, id: "1", connector: null, input: null, editable: true },
  });
  let operation = $state("+");
  let node: any = $state(null);

  function assignCallback(id: string) {
    nodeObject?.addSetPropCallback((value: number) => {
      calculate(id, value);
    }, `input-${id}`);
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

  function calculate(id: string, value: number) {
    inputValues[id].value = value;
    let firstKey = Object.keys(inputValues)[0];
    let result = Number(inputValues[firstKey].value);
    for (const entry of Object.values(inputValues)) {
      const key = entry.id;
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
    connector.callbacks.onConnect = (event) => {
      if (event.role !== "target") return;
      inputElement.value = "";
      inputValues[id].editable = false;
    };
    connector.callbacks.onDisconnect = (event) => {
      if (event.role !== "target") return;
      inputElement.value = inputValues[id].value.toString();
      inputValues[id].editable = true;
    };

    if (inputElement) {
      inputElement.focus();
      inputElement.select();
    }
  }

  function addInput() {
    let id: string = (nextInputId++).toString();
    inputValues[id] = { value: 0, id, connector: null, input: null, editable: true };
    assignCallback(id);
    tick().then(() => {
      setUpCallback(id);
    });
  }

  function removeInput(id: string) {
    delete inputValues[id];
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
  {#each Object.values(inputValues) as input (input.id)}
    <div class="row-container">
      <Connector
        name={`input-${input.id}`}
        maxConnectors={1}
        allowDragOut={false}
        bind:this={input.connector}
      />
      <div class="input-container">
        <input
          type="number"
          bind:this={input.input}
          disabled={!input.editable}
          oninput={(e) => calculate(input.id, (e.target as any).value)}
        />
        <button
          onclick={() => {
            removeInput(input.id);
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
