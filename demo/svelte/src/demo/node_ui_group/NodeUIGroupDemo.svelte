<script lang="ts">
  import { Engine } from "@snap-engine/asset-base-svelte";
  import { Group } from "@snap-engine/snapline-svelte";
  import SimpleNode from "../node_ui_demo/SimpleNode.svelte";

  // The framework hands the member NodeComponent to these callbacks; a consumer
  // hangs any visual cue off them. Here we tag the member's element so the e2e
  // (and the eye) can see which nodes belong to the group.
  function onMemberEnter(node: any) {
    node.element?.setAttribute("data-member", "true");
  }
  function onMemberLeave(node: any) {
    node.element?.removeAttribute("data-member");
  }
</script>

<Engine id="node-ui-group-canvas">
  <div id="node-ui-group">
    <div id="sl-background"></div>
    <Group
      title="Group A"
      x={60}
      y={60}
      width={520}
      height={460}
      {onMemberEnter}
      {onMemberLeave}
    />
    <SimpleNode title="Node A" x={100} y={110} />
    <SimpleNode title="Node C" x={100} y={300} />
    <SimpleNode title="Node B" x={640} y={120} />
  </div>
</Engine>

<style>
  #node-ui-group {
    position: absolute;
    inset: 0;
    pointer-events: none;
  }
  :global(.node) {
    pointer-events: auto;
  }
  /* The group box renders first in DOM (behind the later-painted nodes). */
  :global(.snapline-group) {
    background: rgb(120 160 255 / 12%);
    border: 1px solid rgb(120 160 255 / 60%);
    border-radius: 8px;
  }
  :global(.snapline-group-header) {
    padding: 6px 10px;
    background: rgb(120 160 255 / 25%);
    border-radius: 8px 8px 0 0;
    font: 600 13px sans-serif;
  }
  :global(.snapline-group-resize) {
    background: rgb(120 160 255 / 60%);
    border-radius: 0 0 8px 0;
  }
  :global([data-member="true"]) {
    outline: 3px solid #d33;
    outline-offset: 2px;
  }
  #sl-background {
    position: absolute;
    inset: 0;
    pointer-events: auto;
  }
</style>
