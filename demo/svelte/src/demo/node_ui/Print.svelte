<script lang="ts">

    import Connector from "../../lib2/node_ui/Connector.svelte";
    import Node from "../../lib2/node_ui/Node.svelte";
    import DemoLine from "./DemoLine.svelte";
    import { NodeComponent } from "../../../../../src/asset/node_ui/node";
    import { onMount } from "svelte";
    let node: any = $state(null);
    let nodeObject: NodeComponent | null = null;
    let text: string = $state("Hello World");
    let fontSize: number = $state(20);
    onMount(() => {
        nodeObject = (node as any).getNodeObject();
        nodeObject?.addSetPropCallback((value: string) => {
            text = value;
        }, "text");
        nodeObject?.addSetPropCallback((value: number) => {
            fontSize = value;
        }, "font-size");
    });


</script>

<Node bind:this={node} className="node-print" LineSvelteComponent={DemoLine}>

    <div class="row">
        <Connector name="text" maxConnectors={1} allowDragOut={false} /> 
    </div>
    <div class="row">
        <Connector name="font-size" maxConnectors={1} allowDragOut={false} /> 
    </div>
    <div class="row">
        <h1 style="font-size: {fontSize}px;">{text}</h1>
    </div>
       
</Node>

<style lang="scss">
    :global(.node-print) {
        user-select: none;
        background-color: #fff;
        box-sizing: border-box;

        border-radius: 12px;
        border: 1px solid #E3DDD5;
        background: #FFF;
        box-shadow: 0px 29px 46.5px -9px rgba(82, 60, 66, 0.23);

        &[data-selected="true"] {
            border:1px solid rgb(3, 166, 194);
        }
    }

    h1 {
        font-size:20px;
        font-weight: bold;
        color: #000;
        font-family: 'Tomorrow', sans-serif;
    }

    #op-container {
        display: flex;
        flex-direction: row;

        > div {
            width: calc(100% - 40px);
            display: flex;
            gap: 10px;
            flex-direction: row;
            justify-content: space-between;
            padding: 10px 0px;
            margin-left: 20px;
            box-sizing: border-box;
        }

        button {
            width: 32px;
            height: 32px;
            border-radius: 8px;
            background: #F5F5F5;   
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
        
        input {
            font-family: 'IBM Plex Mono', monospace;
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

    .input-add-remove {
      
        width: 32px;
        height: 32px;
        border-radius: 8px;
        background: #f5f5f500;   
        border: none;
        color: #000;
        font-size: 20px;
        font-weight: bold;
        font-family: 'Tomorrow', sans-serif;

        text-shadow:2px 6px 6.5px 0px rgba(68, 43, 44, 0.28);

        &:hover {
            background: #f5f5f5;
        }
    }

    .flow-math-container {
        display: flex;
        flex-direction: column;
        align-items: center;
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
