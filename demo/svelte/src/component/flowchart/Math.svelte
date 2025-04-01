<script lang="ts">

    import { FlowLineObject } from "./def";
    import Connector from "../lib/Connector.svelte";
    import Node from "../lib/Node.svelte";

    let numInput = $state(2);
    let inputValues = $state([0, 0]);
    let operation = $state("+");
    let node = $state(null);


    function calculate(index: number, value: number) {
        inputValues[index] = value;
        let result = Number(inputValues[0]);
        for (let i = 1; i < numInput; i++) {
            if (operation == "+") {
                result += Number(inputValues[i]);
            } else if (operation == "-") {
                result -= Number(inputValues[i]);
            } else if (operation == "*") {
                result *= Number(inputValues[i]);
            } else if (operation == "/") {
                result /= Number(inputValues[i]);
            }
        }
        let nodeObject = node.getNodeObject();
        nodeObject.setProp("output", result);
    }

</script>

<Node bind:this={node} className="flow-math">
    <div class="flow-math-container">
         {#each Array(numInput) as _, i}
         <div class="flow-math-input">
             <Connector name={`input-${i}`} maxConnectors={1} allowDragOut={false} /> <input type="number" onchange={(e) => calculate(i, (e.target as any).value)} />
         </div>
         {/each}
         <div class="flow-math-output">
            <select onchange={(e) => {operation = (e.target as any).value; calculate(0, inputValues[0])}} value={operation}>
                <option value="+">+</option>
                <option value="-">-</option>
                <option value="*">*</option>
                <option value="/">/</option>
            </select>
            <Connector name="output" maxConnectors={0} allowDragOut={true} lineClass={FlowLineObject} />
         </div>
    </div>
    <button onclick={() => {numInput++; inputValues.push(0); calculate(numInput - 1, 0)}}>+</button>
    <button onclick={() => {numInput--; inputValues.pop(); calculate(numInput - 1, 0)}}>-</button>
</Node>

<style lang="scss">
    :global(.flow-math) {

        width: 150px;
        user-select: none;
        padding: 10px;
        background-color: #fff;
        border: 1px solid #ccc;
        border-radius: 5px;
        box-sizing: border-box;

        &[data-selected="true"] {
            border:1px solid rgb(3, 166, 194);
        }

        .flow-math-input {
            width: 100%;
            height: 100%;
            background-color: #fff;
            display: flex;
            align-items: center;
            justify-content: left;
        }

        .hitbox {
           width: 50px;
           height: 50px;
           background-color: red;
        }

        .flow-math-input, .flow-math-output {
            gap: 10px;
        }

        .flow-math-container {
            display: flex;
            flex-direction: column;
            align-items: center;
            gap: 10px;
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

        input {
            user-select: none;
            padding: 10px;
            height: 30px;
            border: 1px solid #ccc;
            border-radius: 5px;
            width: 100px;
            background-color: #f3f3f3;

            &:focus {
                border: 1px solid #ccc;
            }
        }
    }
    
</style>
