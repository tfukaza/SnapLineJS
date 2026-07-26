<script lang="ts">
  import { Engine } from "@snap-engine/asset-base-svelte";
  import { Group } from "@snap-engine/snapline-svelte";
  import { GroupNodeComponent } from "@snap-engine/snapline";
  import SimpleNode from "../node_ui_demo/SimpleNode.svelte";

  function markMembership(
    attribute: string,
    event: {
      added: Array<{ element?: HTMLElement | null }>;
      removed: Array<{ element?: HTMLElement | null }>;
    },
  ) {
    for (const node of event.added) node.element?.setAttribute(attribute, "true");
    for (const node of event.removed) node.element?.removeAttribute(attribute);
  }
</script>

<Engine id="node-ui-nested-group-canvas">
  <div id="node-ui-nested-group">
    <div id="sl-background"></div>
    <Group
      title="Outer Group"
      x={60}
      y={60}
      width={520}
      height={400}
      onMembershipChange={(event) => markMembership("data-outer-member", event)}
    />
    <!-- Nested groups require full-bounds containment. -->
    <Group
      title="Inner Group"
      x={240}
      y={160}
      width={300}
      height={220}
      onMembershipChange={(event) => markMembership("data-inner-member", event)}
    />
    <SimpleNode title="Direct Node" x={100} y={120} />
    <SimpleNode title="Nested Node" x={400} y={250} />
    <SimpleNode title="Outside Node" x={850} y={120} />
    <Group
      title="Opt-out Group"
      x={760}
      y={500}
      width={450}
      height={300}
      canContain={({ node, centerContained }) =>
        !(node instanceof GroupNodeComponent) && centerContained}
      onMembershipChange={(event) => markMembership("data-optout-member", event)}
    />
    <Group title="Rejected Group" x={780} y={560} width={180} height={180} />
    <SimpleNode title="Opt-in Node" x={1000} y={620} />
  </div>
</Engine>

<style>
  #node-ui-nested-group {
    position: absolute;
    inset: 0;
    pointer-events: none;
  }
  :global(.node) {
    pointer-events: auto;
  }
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
  #sl-background {
    position: absolute;
    inset: 0;
    pointer-events: auto;
  }
</style>
