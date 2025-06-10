<script lang="ts">
  import "../app.scss";
  let { children } = $props();
</script>

<svelte:head>
  <title>SnapEngineJS</title>
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
</svelte:head>

<nav class="page-width page-column">
  <h1>SnapEngineJS</h1>
</nav>
{@render children()}

<style lang="scss">
  nav {
    height: var(--size-80);
    display: flex;
    align-items: center;
    justify-content: flex-start;

    h1 {
      font-size: 24px;
    }
  }
</style>
