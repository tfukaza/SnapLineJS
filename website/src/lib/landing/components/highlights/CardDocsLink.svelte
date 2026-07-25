<script lang="ts">
  // Quiet "read more" link for a highlight card. Matches the Interlude link
  // treatment so the landing page reads as one family.
  let { href, label }: { href: string; label: string } = $props();
</script>

<a class="card-docs-link" {href}>
  {label}
  <span class="card-docs-link-icon material-symbols-rounded" aria-hidden="true">
    arrow_forward
  </span>
</a>

<style lang="scss">
  .card-docs-link {
    display: inline-flex;
    align-items: center;
    gap: var(--size-4);
    margin-top: var(--size-16);
    color: var(--color-primary);
    font-size: 0.95rem;
    text-decoration: none;

    &:hover .card-docs-link-icon {
      transform: translateX(2px);
    }
  }

  .card-docs-link-icon {
    font-size: 1.05rem;
    transition: transform 160ms ease;
  }

  @media (prefers-reduced-motion: reduce) {
    .card-docs-link-icon {
      transition: none;
    }
  }
</style>
