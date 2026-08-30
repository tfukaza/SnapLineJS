<script lang="ts">
  import { page } from "$app/state";
  import "../../../css/snapdesign.scss";
  import DebugLayoutToolbar from "$lib/components/DebugLayoutToolbar.svelte";
  import FrameworkSelect from "$lib/components/FrameworkSelect.svelte";
  import {
    findProjectForPath,
    projectNavigationEntries,
    projectSwitcherEntries,
    topNavigationItemIsCurrent,
  } from "$lib/projectNavigation";
  import {
    docNavigationNodeContains,
    filterDocNavigation,
    flattenDocNavigation,
    type DocNavigation,
    type DocNavigationNode,
  } from "$lib/docsCatalog";
  import "$lib/fonts.css";
  import { debugLayoutFooterControl } from "$lib/stores/debugLayoutFooter";
  import {
    selectedFramework,
    setSelectedFramework,
    type Framework,
  } from "$lib/stores/frameworkState.svelte";

  let { children } = $props();

  const repositoryUrl = "https://github.com/tfukaza/SnapEngineJS";
  const assetProjects = projectNavigationEntries.filter(
    (project) => project.group === "asset",
  );
  type MenuName = "projects";

  let activeMenu = $state<MenuName | null>(null);
  let mobileNavOpen = $state(false);
  let collapsedMobileDocGroups = $state<string[]>([]);
  let navRoot = $state<HTMLElement | null>(null);
  let mobileNavTrigger = $state<HTMLButtonElement | null>(null);
  let projectsMenuTrigger = $state<HTMLButtonElement | null>(null);
  const currentPath = $derived(page.url.pathname);
  const currentProject = $derived(findProjectForPath(currentPath));
  const projectSwitchLabel = $derived(currentProject.title);
  const currentProjectHomeHref = $derived(currentProject.marketingHref ?? "/");
  const mobileDocsNavigation = $derived(
    page.data.mobileDocsNavigation ?? null,
  );
  const currentDocSlug = $derived(page.params.slug ?? "");
  const visibleMobileDocSections = $derived(
    mobileDocsNavigation
      ? filterDocNavigation(mobileDocsNavigation, $selectedFramework).sections
      : [],
  );

  function toggleMenu(menu: MenuName) {
    activeMenu = activeMenu === menu ? null : menu;
    mobileNavOpen = false;
  }

  function toggleMobileNav() {
    mobileNavOpen = !mobileNavOpen;
    activeMenu = null;
  }

  function closeNavigation() {
    activeMenu = null;
    mobileNavOpen = false;
  }

  function mobileDocGroupChildrenId(slug: string): string {
    return `mobile-doc-group-${slug.replaceAll("/", "-")}`;
  }

  function toggleMobileDocGroup(slug: string) {
    collapsedMobileDocGroups = !collapsedMobileDocGroups.includes(slug)
      ? [...collapsedMobileDocGroups, slug]
      : collapsedMobileDocGroups.filter((entry) => entry !== slug);
  }

  function handleMobileFrameworkChange(framework: Framework) {
    if (!mobileDocsNavigation) return;

    const allEntries = flattenDocNavigation(mobileDocsNavigation);
    const currentEntry = allEntries.find((entry) => entry.slug === currentDocSlug);
    const equivalentEntry = currentEntry?.frameworkKey
      ? allEntries.find(
          (entry) =>
            entry.project === mobileDocsNavigation.project &&
            entry.section === currentEntry.section &&
            entry.framework === framework &&
            entry.frameworkKey === currentEntry.frameworkKey,
        )
      : null;

    setSelectedFramework(framework, !equivalentEntry);
    closeNavigation();

    if (equivalentEntry) {
      window.location.href = `/docs/${equivalentEntry.slug}?framework=${framework}`;
    }
  }

  function handleWindowPointerDown(event: PointerEvent) {
    if (navRoot && event.target instanceof Node && navRoot.contains(event.target)) return;
    closeNavigation();
  }

  function handleWindowKeyDown(event: KeyboardEvent) {
    if (event.key !== "Escape") return;

    const focusTarget = activeMenu === "projects"
      ? projectsMenuTrigger
      : mobileNavOpen
        ? mobileNavTrigger
        : null;

    closeNavigation();
    focusTarget?.focus();
  }
</script>

{#snippet mobileDocTree(nodes: DocNavigationNode[], depth: number, listId: string | undefined, listHidden: boolean)}
  <ul id={listId} hidden={listHidden}>
    {#each nodes as node (node.entry.slug)}
      <li>
        {#if node.entry.kind === "group"}
          <button
            type="button"
            class="mobile-doc-group"
            style={`--mobile-doc-indent: calc(${depth} * var(--size-16))`}
            class:ancestor={docNavigationNodeContains(node, currentDocSlug)}
            aria-expanded={!collapsedMobileDocGroups.includes(node.entry.slug)}
            aria-controls={mobileDocGroupChildrenId(node.entry.slug)}
            onclick={() => toggleMobileDocGroup(node.entry.slug)}
          >
            <span>{node.entry.title}</span>
            <svg
              class="mobile-doc-chevron"
              width="12"
              height="12"
              viewBox="0 0 12 12"
              fill="none"
              aria-hidden="true"
            >
              <path d="m3 4.5 3 3 3-3" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" />
            </svg>
          </button>
        {:else}
          <a
            href={`/docs/${node.entry.slug}`}
            style={`--mobile-doc-indent: calc(${depth} * var(--size-16))`}
            class:active={node.entry.slug === currentDocSlug}
            class:ancestor={node.entry.slug !== currentDocSlug &&
              docNavigationNodeContains(node, currentDocSlug)}
            aria-current={node.entry.slug === currentDocSlug ? "page" : undefined}
            onclick={closeNavigation}
          >
            {node.entry.title}
          </a>
        {/if}
        {#if node.children.length > 0}
          {@render mobileDocTree(
            node.children,
            depth + 1,
            node.entry.kind === "group"
              ? mobileDocGroupChildrenId(node.entry.slug)
              : undefined,
            node.entry.kind === "group" &&
              collapsedMobileDocGroups.includes(node.entry.slug)
          )}
        {/if}
      </li>
    {/each}
  </ul>
{/snippet}

<svelte:window onpointerdown={handleWindowPointerDown} onkeydown={handleWindowKeyDown} />

<a class="skip-link button primary small" href="#main-content">Skip to content</a>

<header class="site-header">
  <nav class="nav-bar" aria-label="Primary navigation" bind:this={navRoot}>
    <div class="nav-identity">
      <div class="nav-menu project-menu" class:is-open={activeMenu === "projects"}>
        <a
          class="wordmark"
          href={currentProjectHomeHref}
          aria-current={currentPath === currentProjectHomeHref ? "page" : undefined}
          onclick={closeNavigation}
        >
          {projectSwitchLabel}
        </a>
        <button
          bind:this={projectsMenuTrigger}
          type="button"
          class="project-menu-trigger"
          aria-label={`Switch project. Current project: ${projectSwitchLabel}`}
          aria-haspopup="true"
          aria-expanded={activeMenu === "projects"}
          aria-controls="project-nav-menu"
          onclick={() => toggleMenu("projects")}
        >
          <svg
            class="nav-chevron"
            width="12"
            height="12"
            viewBox="0 0 12 12"
            fill="none"
            aria-hidden="true"
          >
            <path d="m3 4.5 3 3 3-3" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" />
          </svg>
        </button>
        <div id="project-nav-menu" class="nav-dropdown project-nav-dropdown">
          {#each projectSwitcherEntries as entry}
            <a
              class="project-nav-link"
              href={entry.marketingHref}
              aria-current={currentProject.slug === entry.slug ? "true" : undefined}
              onclick={closeNavigation}
            >
              <span>{entry.title}</span>
              {#if currentProject.slug === entry.slug}
                <span class="project-nav-check" aria-hidden="true">✓</span>
              {/if}
            </a>
          {/each}
        </div>
      </div>
    </div>

    <button
      bind:this={mobileNavTrigger}
      type="button"
      class="mobile-nav-trigger"
      aria-label="Toggle navigation"
      aria-expanded={mobileNavOpen}
      aria-controls="primary-nav-links"
      onclick={toggleMobileNav}
    >
      <span class="mobile-nav-icon" aria-hidden="true">{mobileNavOpen ? "×" : "≡"}</span>
    </button>

    <div id="primary-nav-links" class="nav-right" class:is-open={mobileNavOpen}>
      {#each currentProject.topNavigation as item}
        {@const isCurrent = topNavigationItemIsCurrent(item, currentPath)}
        <a
          href={item.href}
          class="nav-link"
          class:current={isCurrent}
          aria-current={isCurrent ? "page" : undefined}
          onclick={closeNavigation}
        >
          {item.label}
        </a>
      {/each}
      <a
        href={repositoryUrl}
        class="nav-link github-link"
        aria-label="SnapEngine on GitHub"
        target="_blank"
        rel="noopener noreferrer"
        onclick={closeNavigation}
      >
        <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
          <path d="M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-4.035-1.41-.135-.345-.72-1.41-1.23-1.695-.42-.225-1.02-.78-.015-.795.945-.015 1.62.87 1.845 1.23 1.08 1.815 2.805 1.305 3.495.99.105-.78.42-1.305.765-1.605-2.67-.3-5.46-1.335-5.46-5.925 0-1.305.465-2.385 1.23-3.225-.12-.3-.54-1.53.12-3.18 0 0 1.005-.315 3.3 1.23.96-.27 1.98-.405 3-.405s2.04.135 3 .405c2.295-1.56 3.3-1.23 3.3-1.23.66 1.65.24 2.88.12 3.18.765.84 1.23 1.905 1.23 3.225 0 4.605-2.805 5.625-5.475 5.925.435.375.81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.3 0 .315.225.69.825.57A12.02 12.02 0 0024 12c0-6.63-5.37-12-12-12z"/>
        </svg>
      </a>

      {#if mobileDocsNavigation}
        <div
          class="mobile-doc-navigation"
          role="group"
          aria-label={`${mobileDocsNavigation.projectTitle} documentation`}
        >
          <p class="mobile-doc-project-title">{mobileDocsNavigation.projectTitle} docs</p>
          {#if mobileDocsNavigation.frameworks.length > 1}
            <FrameworkSelect
              id="mobile-header-doc-framework"
              value={$selectedFramework}
              onFrameworkChange={handleMobileFrameworkChange}
            />
          {/if}
          {#each visibleMobileDocSections as section}
            <div class="mobile-doc-section">
              {#if section.name}
                <p class="mobile-doc-section-title">{section.title}</p>
              {/if}
              {@render mobileDocTree(section.nodes, 0, undefined, false)}
            </div>
          {/each}
        </div>
      {/if}
    </div>
  </nav>
</header>

<main id="main-content" class="page-content" tabindex="-1">
  {@render children()}
</main>

<footer>
  <div class="app-footer">
    <div class="footer-content">
      <div class="footer-brand">
        <span class="brand-name">SnapEngine</span>
        <span class="copyright">© {new Date().getFullYear()}</span>
      </div>
      <div class="footer-sections">
        <nav class="footer-column" aria-labelledby="footer-engine">
          <h2 id="footer-engine">Engine</h2>
          <a href="/">SnapEngine Core</a>
          <a href="/docs/snapengine/introduction">Core documentation</a>
        </nav>
        <nav class="footer-column" aria-labelledby="footer-assets">
          <h2 id="footer-assets">Assets</h2>
          {#each assetProjects as entry}
            {#if entry.status === "available" && entry.marketingHref}
              <a href={entry.marketingHref}>{entry.title}</a>
            {:else}
              <span class="footer-link-disabled">{entry.title} · Coming soon</span>
            {/if}
          {/each}
        </nav>
        <nav class="footer-column" aria-labelledby="footer-project">
          <h2 id="footer-project">Project</h2>
          <a href="/about">About</a>
          <a href="/docs">All documentation</a>
          <a href={repositoryUrl} target="_blank" rel="noopener noreferrer">GitHub</a>
        </nav>
        {#if $debugLayoutFooterControl}
          <div class="footer-column footer-debug-column">
            <h2>Debug</h2>
            <DebugLayoutToolbar
              debugLayout={$debugLayoutFooterControl.debugLayout}
              onToggle={$debugLayoutFooterControl.onToggle}
            />
          </div>
        {/if}
      </div>
    </div>
  </div>
</footer>

<style lang="scss">
  .skip-link {
    position: fixed;
    z-index: 1000;
    top: var(--size-8);
    left: var(--size-8);
    transform: translateY(calc(-100% - var(--size-16)));

    &:focus {
      transform: translateY(0);
    }
  }

  .page-content:focus {
    outline: none;
  }

  .site-header {
    width: 100%;
    border-bottom: 1px solid #d7d7d7;
    background: #f6f6f6;
  }

  .nav-bar {
    --page-gutter: clamp(var(--size-16), 5vw, var(--size-64));

    position: relative;
    z-index: 30;
    display: flex;
    justify-content: space-between;
    align-items: center;
    gap: var(--size-32);
    width: min(1400px, calc(100% - (var(--page-gutter) * 2)));
    margin: 0 auto;
    padding: var(--size-16) 0;
    box-sizing: border-box;
    background: transparent;
  }

  .nav-identity {
    display: flex;
    align-items: center;
    gap: var(--size-16);
    min-width: 0;
  }

  .nav-right {
    display: flex;
    align-items: center;
    gap: var(--size-24);
  }

  .nav-link,
  .mobile-nav-trigger {
    color: #5e4d44;
    font-family: var(--font-body);
    font-size: 0.9rem;
    font-weight: 500;
    line-height: 1.3;
  }

  .nav-link {
    text-decoration: none;
    transition: color 160ms ease;

    &:hover {
      color: var(--color-action);
    }

    &.current {
      color: var(--color-action);
      font-weight: 650;
    }
  }

  .nav-menu {
    --project-wordmark-color: #080808;
    --project-wordmark-font-family: "Geist", sans-serif;
    --project-wordmark-font-size: 1.25rem;
    --project-wordmark-font-weight: 500;
    --project-wordmark-letter-spacing: -0.04em;
    --project-wordmark-line-height: 1;

    position: relative;
    display: flex;
    align-items: center;
    gap: var(--size-2);
    padding-block: var(--size-8);
    margin-block: calc(var(--size-8) * -1);

    &.is-open {
      .project-menu-trigger {
        color: var(--color-action);
      }

      .nav-chevron {
        transform: rotate(180deg);
      }

      .nav-dropdown {
        opacity: 1;
        visibility: visible;
        transform: translateY(0);
        pointer-events: auto;
      }
    }
  }

  .project-menu-trigger,
  .mobile-nav-trigger {
    display: inline-flex;
    align-items: center;
    gap: var(--size-4);
    min-height: 36px;
    margin: 0;
    padding: 0;
    border: 0;
    background: transparent;
    box-shadow: none;
    cursor: pointer;
  }

  .project-menu-trigger {
    justify-content: center;
    width: 24px;
    color: var(--project-wordmark-color);
    transition: color 160ms ease;

    &:hover,
    &:focus-visible {
      color: var(--color-action);
    }
  }

  .wordmark,
  .project-nav-link {
    color: var(--project-wordmark-color);
    font-family: var(--project-wordmark-font-family);
    font-size: var(--project-wordmark-font-size);
    font-weight: var(--project-wordmark-font-weight);
    letter-spacing: var(--project-wordmark-letter-spacing);
    line-height: var(--project-wordmark-line-height);
  }

  .wordmark {
    display: inline-flex;
    align-items: center;
    min-height: 36px;
    text-decoration: none;
    transition: color 160ms ease;

    &:hover,
    &:focus-visible {
      color: var(--color-action);
    }
  }

  .nav-chevron {
    font-size: 1rem;
    line-height: 1;
    transition: transform 160ms ease;
  }

  .nav-dropdown {
    position: absolute;
    z-index: 40;
    top: calc(100% + var(--size-4));
    left: 0;
    display: flex;
    flex-direction: column;
    opacity: 0;
    visibility: hidden;
    transform: translateY(calc(var(--size-4) * -1));
    pointer-events: none;
    transition:
      opacity 150ms ease,
      visibility 150ms ease,
      transform 150ms ease;
  }

  .project-nav-dropdown {
    min-width: 14rem;
    padding-block: var(--size-8);
    box-sizing: border-box;
    border: 1px solid rgb(0 0 0 / 24%);
    border-radius: var(--ui-radius);
    background: #fff;
    box-shadow: 0 3px 10px rgb(36 38 39 / 5%);
  }

  .project-nav-link {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: var(--size-16);
    margin: var(--size-4);
    padding: var(--size-4) var(--size-12);
    border-radius: var(--ui-radius);
    text-decoration: none;
    transition: background-color 150ms ease;
  }

  a.project-nav-link:hover,
  a.project-nav-link:focus-visible {
    color: var(--project-wordmark-color);
    background: #ececeb;
    outline: none;
  }

  .project-nav-check {
    flex: 0 0 auto;
    font: inherit;
  }

  .github-link {
    display: flex;
    align-items: center;

    svg {
      transition: transform 160ms ease;
    }

    &:hover svg {
      transform: scale(1.08);
    }
  }

  .mobile-nav-trigger {
    display: none;
    gap: var(--size-8);
  }

  .mobile-nav-icon {
    font-family: var(--font-code);
    font-size: 1.25rem;
    line-height: 1;
  }

  .mobile-doc-navigation {
    display: none;
  }

  @media (max-width: 768px) {
    .nav-bar {
      gap: var(--size-16);
    }

    .mobile-nav-trigger {
      display: inline-flex;
      justify-content: center;
      width: 44px;
      min-height: 44px;
      padding: var(--size-8);
    }

    .nav-right {
      position: absolute;
      top: calc(100% + var(--size-4));
      right: 0;
      left: 0;
      display: none;
      align-items: stretch;
      flex-direction: column;
      gap: var(--size-4);
      padding: var(--size-12);
      border: 1px solid rgba(58, 42, 34, 0.08);
      border-radius: var(--size-12);
      background: rgba(255, 255, 255, 0.98);
      box-shadow: 0 16px 40px rgba(31, 30, 41, 0.14);
      max-height: calc(100svh - 5.5rem);
      overflow-y: auto;

      &.is-open {
        display: flex;
      }
    }

    .nav-link {
      width: 100%;
      min-height: 44px;
      justify-content: space-between;
      padding: var(--size-8) var(--size-12);
      box-sizing: border-box;
      border-radius: var(--size-8);
    }

    .github-link {
      justify-content: flex-start;
    }

    .wordmark {
      max-width: 9.5rem;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }

    .project-menu-trigger {
      width: 44px;
      min-height: 44px;
    }

    .mobile-doc-navigation {
      display: block;
      margin-top: var(--size-8);
      padding: var(--size-20) var(--size-12) var(--size-8);
      border-top: 1px solid rgba(58, 42, 34, 0.1);
    }

    .mobile-doc-project-title {
      margin: 0 0 var(--size-20);
      color: var(--color-background-dark);
      font-family: var(--font-display);
      font-size: 1.05rem;
      font-weight: 600;
      line-height: 1.2;
    }

    .mobile-doc-section {
      margin-bottom: var(--size-20);

      &:last-child {
        margin-bottom: 0;
      }

      ul {
        margin: 0;
        padding: 0;
        list-style: none;
      }

      li {
        margin: 0;
      }

      a,
      .mobile-doc-group {
        display: block;
        padding: var(--size-8) var(--size-12);
        padding-left: calc(var(--size-12) + var(--mobile-doc-indent, 0px));
        border-radius: var(--size-8);
        color: var(--color-text);
        font-size: 0.9rem;
        font-weight: 400;
        line-height: 1.3;
        text-decoration: none;

        &:hover,
        &:focus-visible {
          color: var(--color-action);
        }

        &.ancestor {
          color: var(--color-action);
          font-weight: 500;
        }
      }

      a.active {
        color: var(--color-action);
        font-weight: 600;
      }

      .mobile-doc-group {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: var(--size-8);
        width: 100%;
        border: 0;
        background: transparent;
        font-family: inherit;
        text-align: left;
        cursor: pointer;
      }

      .mobile-doc-chevron {
        flex: 0 0 auto;
        transition: transform 0.15s ease;
      }

      .mobile-doc-group[aria-expanded="false"] .mobile-doc-chevron {
        transform: rotate(-90deg);
      }
    }

    .mobile-doc-section-title {
      margin: 0 0 var(--size-8);
      padding: 0 var(--size-12);
      color: var(--color-background-dark);
      font-family: var(--font-label);
      font-size: 0.86rem;
      font-weight: 400;
      line-height: 1.2;
    }

  }

  footer {
    width: 100%;
    border-top: 1px solid rgba(0, 0, 0, 0.06);
  }

  .app-footer {
    --page-gutter: clamp(var(--size-16), 5vw, var(--size-64));

    width: min(1200px, calc(100% - (var(--page-gutter) * 2)));
    margin: var(--size-96) auto var(--size-64);
    box-sizing: border-box;
  }

  .footer-content {
    display: flex;
    flex-direction: column;
    align-items: flex-start;
    gap: var(--size-32);
  }

  .footer-brand {
    display: flex;
    align-items: center;
    gap: var(--size-8);
    color: var(--color-text-subtle);
    font-family: var(--font-body);
    font-size: 0.875rem;
    line-height: 1.4;

    .brand-name {
      color: #3a2a22;
      font-family: var(--font-display);
      font-weight: 600;
    }
  }

  .footer-sections {
    display: flex;
    align-items: flex-start;
    flex-wrap: wrap;
    gap: var(--size-48) var(--size-80);
  }

  .footer-column {
    display: flex;
    flex-direction: column;
    align-items: flex-start;
    gap: var(--size-12);

    h2 {
      margin: 0 0 var(--size-4);
      color: var(--color-text);
      font-family: var(--font-label);
      font-size: 0.875rem;
      font-weight: 600;
      letter-spacing: 0.04em;
      line-height: 1.4;
      text-transform: uppercase;
    }

    a,
    .footer-link-disabled {
      margin: 0;
      color: var(--color-text-subtle);
      font-size: 0.9rem;
      font-weight: 400;
      line-height: 1.4;
      text-decoration: none;
    }

    a:hover {
      color: var(--color-action);
    }

    .footer-link-disabled {
      cursor: default;
    }
  }

  @media (max-width: 720px) {
    .footer-sections {
      width: 100%;
      display: grid;
      grid-template-columns: repeat(2, minmax(0, 1fr));
      gap: var(--size-32);
    }
  }

  @media (max-width: 420px) {
    .footer-sections {
      grid-template-columns: 1fr;
    }
  }
</style>
