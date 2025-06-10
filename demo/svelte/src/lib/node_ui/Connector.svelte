<script lang="ts">
  import {
    NodeComponent,
    ConnectorComponent,
    SnapLine,
  } from "../../../../../src/index";
  import { getContext, onDestroy } from "svelte";

  let {
    name,
    maxConnectors = 1,
    allowDragOut = true,
  }: {
    name: string;
    maxConnectors?: number;
    allowDragOut?: boolean;
  } = $props();

  let engine: SnapLine = getContext("engine");
  let nodeObject: NodeComponent = getContext("nodeObject");
  let connector = new ConnectorComponent(engine.global, nodeObject, {
    name: name,
    maxConnectors: maxConnectors,
    allowDragOut: allowDragOut,
  });

  nodeObject.addConnectorObject(connector);

  onDestroy(() => {
    connector.destroy();
  });
</script>

<div class="sl-connector" bind:this={connector.element}></div>

<style>
  .sl-connector {
    width: 10px;
    height: 10px;
    fill: #fff;
    box-shadow: 3px 3px 4px 0px rgba(40, 24, 28, 0.31) inset;
    border-radius: 50%;
    margin: 12px;
  }
</style>
