<script module lang="ts">
  export type ArticleOutlineVariant = "rail" | "inline";
</script>

<script lang="ts">
  import type { ArticleHeading } from "$lib/markdown/articleHeadings";

  type Props = {
    headings?: readonly ArticleHeading[];
    variant?: ArticleOutlineVariant;
    label?: string;
  };

  let {
    headings = [],
    variant = "rail",
    label = "On this page",
  }: Props = $props();

  let activeId = $state<string | null>(null);
  let inlineOpen = $state(false);
  let inlineSummary = $state<HTMLElement>();

  function handleOutlineLinkClick() {
    if (variant !== "inline") return;

    inlineOpen = false;
    window.setTimeout(() => inlineSummary?.focus({ preventScroll: true }), 0);
  }

  $effect(() => {
    const headingIds = headings.map((heading) => heading.id);
    activeId = headingIds[0] ?? null;

    if (headingIds.length === 0) return;

    const article = document.querySelector(".doc-article");
    if (!(article instanceof HTMLElement)) return;

    const elements = headingIds
      .map((id) => document.getElementById(id))
      .filter(
        (element): element is HTMLElement =>
          element instanceof HTMLElement && article.contains(element),
      );

    if (elements.length === 0) return;

    let animationFrame = 0;

    const updateActiveHeading = () => {
      animationFrame = 0;
      const distanceFromBottom =
        document.documentElement.scrollHeight -
        (window.scrollY + window.innerHeight);
      if (distanceFromBottom <= 16) {
        activeId = elements.at(-1)?.id ?? null;
        return;
      }

      const activationLine = Math.min(128, window.innerHeight * 0.25);
      let nextActiveId = elements[0].id;

      for (const element of elements) {
        if (element.getBoundingClientRect().top > activationLine) break;
        nextActiveId = element.id;
      }

      activeId = nextActiveId;
    };

    const scheduleUpdate = () => {
      if (animationFrame !== 0) return;
      animationFrame = window.requestAnimationFrame(updateActiveHeading);
    };

    updateActiveHeading();
    window.addEventListener("scroll", scheduleUpdate, { passive: true });
    window.addEventListener("resize", scheduleUpdate);
    window.addEventListener("hashchange", scheduleUpdate);

    return () => {
      window.removeEventListener("scroll", scheduleUpdate);
      window.removeEventListener("resize", scheduleUpdate);
      window.removeEventListener("hashchange", scheduleUpdate);
      if (animationFrame !== 0) {
        window.cancelAnimationFrame(animationFrame);
      }
    };
  });
</script>

{#snippet outlineLinks()}
  <ol>
    {#each headings as heading (heading.id)}
      <li
        class:subheading={heading.depth === 3}
        data-outline-depth={heading.depth}
      >
        <a
          href={`#${heading.id}`}
          aria-current={activeId === heading.id ? "location" : undefined}
          onclick={handleOutlineLinkClick}
        >
          {heading.title}
        </a>
      </li>
    {/each}
  </ol>
{/snippet}

{#if headings.length > 0}
  {#if variant === "rail"}
    <aside
      class="article-outline rail"
      aria-label={label}
      data-article-outline={variant}
    >
      <p class="outline-title">{label}</p>
      <nav aria-label={label}>
        {@render outlineLinks()}
      </nav>
    </aside>
  {:else}
    <details
      class="article-outline inline"
      data-article-outline={variant}
      bind:open={inlineOpen}
    >
      <summary bind:this={inlineSummary}>{label}</summary>
      <nav aria-label={label}>
        {@render outlineLinks()}
      </nav>
    </details>
  {/if}
{/if}

<style lang="scss">
  .article-outline {
    box-sizing: border-box;
    min-width: 0;
    color: var(--color-text);

    ol {
      margin: 0;
      padding: 0;
      list-style: none;
    }

    li + li {
      margin-top: var(--size-2);
    }

    li.subheading a {
      padding-left: var(--size-16);
      font-size: 0.82rem;
    }

    a {
      display: block;
      padding: var(--size-8) 0;
      color: var(--color-text-subtle);
      font-size: 0.87rem;
      font-weight: 400;
      line-height: 1.35;
      text-decoration: none;
      text-wrap: balance;
      transition: color 0.15s ease;

      &:hover,
      &:focus-visible,
      &[aria-current="location"] {
        color: var(--color-action);
      }

      &[aria-current="location"] {
        font-weight: 600;
      }
    }
  }

  .outline-title,
  summary {
    color: var(--color-background-dark);
    font-family: "Bitcount Grid Single", monospace;
    font-size: 0.9rem;
    font-weight: 300;
    line-height: 1.2;
  }

  .rail {
    position: sticky;
    top: var(--size-32);
    display: none;
    max-height: calc(100vh - var(--size-64));
    overflow-y: auto;
    padding: var(--size-8) 0 var(--size-24) var(--size-20);
    border-left: 1px solid
      color-mix(in srgb, var(--color-background-dark) 18%, transparent);
    scrollbar-width: thin;

    .outline-title {
      margin: 0 0 var(--size-12);
    }
  }

  .inline {
    position: relative;
    z-index: 1;
    display: block;
    width: min(100%, var(--doc-reading-width, 700px));
    margin: var(--size-24) auto 0;
    border: 1px solid
      color-mix(in srgb, var(--color-background-dark) 18%, transparent);
    border-radius: var(--ui-radius);
    background: var(--color-background);

    summary {
      padding: var(--size-12) var(--size-16);
      cursor: pointer;
      user-select: none;
    }

    nav {
      padding: 0 var(--size-16) var(--size-16);
    }
  }

  @media (min-width: 1200px) {
    .rail {
      display: block;
    }

    .inline {
      display: none;
    }
  }
</style>
