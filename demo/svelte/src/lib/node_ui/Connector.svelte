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

<div class="connector" bind:this={connector.element}></div>

<style>
</style>
