<script lang="ts">
  import SeoHead from "$lib/components/SeoHead.svelte";
</script>

<SeoHead
  title="SnapLine | Node-based UI primitives"
  description="Build node editors, diagrams, and connection-based interfaces with unstyled primitives powered by SnapEngine Core."
  path="/snapline"
  imageAlt="SnapLine node graph preview"
/>

<section class="snapline-placeholder">
  <p class="eyebrow">SnapLine</p>
  <h1>Node-based UI primitives</h1>
  <p class="pitch">
    Draggable nodes, connector rules, live connection lines, rectangle
    selection, nested groups, and palette placement — unstyled and
    application-owned, powered by SnapEngine Core.
  </p>
  <p class="wip-note">This page is a work in progress — a full showcase is on the way. The documentation is ready today.</p>
  <div class="actions">
    <a class="button primary" href="/docs/snapline/introduction">Read the docs</a>
    <a class="button" href="/docs/snapline/introduction/01_setup">Install SnapLine</a>
  </div>
</section>

<style lang="scss">
  .snapline-placeholder {
    max-width: 40rem;
    margin: 0 auto;
    padding: 8rem 1.5rem 10rem;
    text-align: center;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 1rem;
  }

  .eyebrow {
    text-transform: uppercase;
    letter-spacing: 0.12em;
    font-size: 0.85rem;
    opacity: 0.7;
    margin: 0;
  }

  h1 {
    margin: 0;
  }

  .pitch {
    margin: 0;
    line-height: 1.6;
  }

  .wip-note {
    margin: 0.5rem 0 0;
    font-size: 0.9rem;
    opacity: 0.7;
  }

  .actions {
    display: flex;
    gap: 0.75rem;
    margin-top: 1rem;
    flex-wrap: wrap;
    justify-content: center;
  }
</style>
