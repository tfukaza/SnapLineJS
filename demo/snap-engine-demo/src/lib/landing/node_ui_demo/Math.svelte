<script lang="ts">
  import { onMount } from "svelte";

  import { NodeComponent } from "./../../../../../../src/asset/node_ui/node";
  import Connector from "./../../../../../svelte/src/lib/node_ui/Connector.svelte";
  import Node from "./../../../../../svelte/src/lib/node_ui/Node.svelte";

  import Line from "./Line.svelte";

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

<Node bind:this={node} className="flow-math" LineSvelteComponent={Line}>
  <div class="flow-math-container" id="op-container">
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
  <div class="flow-math-container">
    {#each Object.values(inputValues) as input (input.uuid)}
      <div class="flow-math-input">
        <Connector
          name={`input-${input.uuid}`}
          maxConnectors={1}
          allowDragOut={false}
        />
        <div class="flow-math-input-value">
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
      </div>
    {/each}
    <button
      class="input-add-remove add-input"
      style="right: 0;"
      onclick={addInput}>+</button
    >
  </div>
</Node>

<style lang="scss">
  :global(.flow-math) {
    user-select: none;
    padding: 10px 0px;
    background-color: #fff;
    box-sizing: border-box;

    border-radius: 12px;
    border: 1px solid #e3ddd5;
    background: #fff;
    box-shadow: 0px 15px 20px -9px rgba(82, 60, 66, 0.23);
    transition: box-shadow 0.1s ease-in;

    &[data-selected="true"] {
      border: 1px solid rgb(3, 166, 194);
      box-shadow: 0px 29px 46.5px -9px rgba(82, 60, 66, 0.23);
    }
  }

  h1 {
    font-size: 20px;
    font-weight: bold;
    color: #000;
    font-family: "Tomorrow", sans-serif;
  }

  #op-container {
    display: flex;
    flex-direction: row;
    align-items: center;
    padding: 10px 0px;

    > div {
      width: calc(100% - 40px);
      display: flex;
      gap: 10px;
      flex-direction: row;
      justify-content: space-between;
      padding: 10px 0px;
      margin-left: 32px;
      box-sizing: border-box;
    }

    button {
      width: 32px;
      height: 32px;
      border-radius: 8px;
      background: #f5f5f5;
      border: none;
      transition: all 0.2s ease-in-out;
      cursor: pointer;

      &:hover {
        background: #ebebeb;
        transform: translate(0, 1px);
      }

      &.active {
        background: #919191;
        transform: translate(0, -2px);
        box-shadow: 2px 6px 6.5px 0px rgba(68, 43, 44, 0.28);
        h1 {
          color: #fff;
        }
      }
    }
  }

  .flow-math-input {
    width: 100%;
    height: 100%;
    background-color: #fff;
    display: flex;
    align-items: center;
    justify-content: left;

    > div {
      margin-right: 32px;
      display: flex;
      gap: 10px;
    }

    input {
      font-family: "IBM Plex Mono", monospace;
      user-select: none;
      padding: 10px;
      height: 30px;
      border: 0px solid #ccc;
      border-radius: 5px;
      width: 100px;
      background-color: #f3f3f3;
      flex-grow: 1;

      &:focus {
        border: 1px solid #ccc;
      }
    }

    button {
      width: 32px;
      height: 32px;
    }
  }

  .input-add-remove {
    width: 32px;
    height: 32px;
    border-radius: 8px;
    background: #f5f5f500;
    border: none;
    color: #000;
    font-size: 20px;
    font-weight: bold;
    font-family: "Tomorrow", sans-serif;

    text-shadow: 2px 6px 6.5px 0px rgba(68, 43, 44, 0.28);

    &:hover {
      background: #f5f5f5;
    }
  }

  .add-input {
    width: 100px;
    margin-left: 32px;
  }

  .flow-math-container {
    display: flex;
    flex-direction: column;
    align-items: flex-start;
    justify-content: right;
    width: 100%;
  }

  .flow-math-output {
    width: 100%;
    height: 100%;
    background-color: #fff;
    display: flex;
    align-items: right;
    justify-content: right;
  }

  :global(.sl-connector) {
    position: relative;
  }
</style>
