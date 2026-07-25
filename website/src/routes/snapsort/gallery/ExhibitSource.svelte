<script lang="ts">
  // "View source" link for one gallery exhibit. The href is computed at build
  // time in +page.server.ts so the line anchor cannot drift out of date.
  let { href, label }: { href: string; label: string } = $props();
</script>

<a class="exhibit-source" {href} target="_blank" rel="noopener noreferrer">
  View source
  <span class="visually-hidden">for {label}</span>
  <span class="exhibit-source-icon material-symbols-rounded" aria-hidden="true">
    open_in_new
  </span>
</a>

<style lang="scss">
  .exhibit-source {
    display: inline-flex;
    align-items: center;
    gap: var(--size-4);
    margin-top: var(--size-12);
    color: var(--color-primary);
    font-size: 0.85rem;
    text-decoration: none;

    &:hover .exhibit-source-icon {
      transform: translate(1px, -1px);
    }
  }

  .exhibit-source-icon {
    font-size: 1rem;
    transition: transform 160ms ease;
  }

  .visually-hidden {
    position: absolute;
    width: 1px;
    height: 1px;
    padding: 0;
    margin: -1px;
    overflow: hidden;
    clip: rect(0, 0, 0, 0);
    white-space: nowrap;
    border: 0;
  }

  @media (prefers-reduced-motion: reduce) {
    .exhibit-source-icon {
      transition: none;
    }
  }
</style>
