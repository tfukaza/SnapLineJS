
<script lang="ts">
	import "./doc.scss";
	import { page } from "$app/stores";
	import { onMount } from "svelte";
	import ArticleOutline from "$lib/components/docs/ArticleOutline.svelte";
	import FrameworkSelect from "$lib/components/FrameworkSelect.svelte";
	import SeoHead from "$lib/components/SeoHead.svelte";
	import {
		docNavigationNodeContains,
		entries,
		findDocProject,
		getDocNavigation,
		getProjectEntries,
		type DocNavigationNode
	} from "$lib/docsCatalog";
	import {
		initializeFrameworkPreference,
		isFramework,
		selectedFramework,
		setSelectedFramework,
		type Framework
	} from "$lib/stores/frameworkState.svelte";
	let { data } = $props();

	const allEntries = entries();
	let collapsedDocGroups = $state<string[]>([]);

	const currentSlug = $derived($page.params.slug || "");
	const isDocsHome = $derived(currentSlug.length === 0);
	const currentProject = $derived(currentSlug.split("/")[0] ?? "");
	const currentProjectConfig = $derived(findDocProject(currentProject));
	const currentProjectTitle = $derived(currentProjectConfig?.title ?? "SnapEngine");
	const showFrameworkSelect = $derived((currentProjectConfig?.frameworks.length ?? 0) > 1);
	const docDescription = $derived(
		currentProjectConfig?.description ?? "SnapEngine documentation."
	);
	const docTitle = $derived(
		isDocsHome
			? (data.metadata?.title ?? 'SnapEngine Documentation')
			: data.metadata?.title
				? `${data.metadata.title} | ${currentProjectTitle} Docs`
				: `${currentProjectTitle} Docs`
	);
	const visibleDocNavigation = $derived(
		getDocNavigation(currentProject, $selectedFramework)
	);
	const currentProjectEntries = $derived(
		getProjectEntries(currentProject, $selectedFramework)
	);
	const currentIndex = $derived(
		currentProjectEntries.findIndex((entry) => entry.slug === currentSlug)
	);
	const prevEntry = $derived(currentIndex > 0 ? currentProjectEntries[currentIndex - 1] : null);
	const nextEntry = $derived(
		currentIndex >= 0 && currentIndex < currentProjectEntries.length - 1
			? currentProjectEntries[currentIndex + 1]
			: null
	);
	const articleHeadings = $derived(data.metadata?.headings ?? []);
	const breadcrumbs = $derived.by(() => {
		if (isDocsHome || !data.docEntry) {
			return [{ name: "Docs", href: null, current: true }];
		}

		const project = findDocProject(data.docEntry.project);
		const projectHref = project?.href ?? `/docs/${data.docEntry.project}`;
		const projectSlug = projectHref.replace(/^\/docs\//, "");
		if (data.docEntry.slug === projectSlug) {
			return [
				{ name: "Docs", href: "/docs", current: false },
				{ name: project?.title ?? data.docEntry.projectTitle, href: null, current: true }
			];
		}

		return [
			{ name: "Docs", href: "/docs", current: false },
			{
				name: project?.title ?? data.docEntry.projectTitle,
				href: projectHref,
				current: false
			},
			{ name: data.docEntry.sectionTitle, href: null, current: false },
			...data.docAncestors.map((ancestor) => ({
				name: ancestor.title,
				href: ancestor.kind === "page" ? `/docs/${ancestor.slug}` : null,
				current: false
			})),
			{ name: data.docEntry.title, href: null, current: true }
		];
	});

	function docGroupChildrenId(slug: string): string {
		return `desktop-doc-group-${slug.replaceAll("/", "-")}`;
	}

	function toggleDocGroup(slug: string) {
		collapsedDocGroups = !collapsedDocGroups.includes(slug)
			? [...collapsedDocGroups, slug]
			: collapsedDocGroups.filter((entry) => entry !== slug);
	}

	function handleFrameworkChange(framework: Framework) {
		const currentEntry = allEntries.find((entry) => entry.slug === currentSlug);
		const equivalentEntry = currentEntry?.frameworkKey
			? allEntries.find(
					(entry) =>
						entry.project === currentProject &&
						entry.section === currentEntry.section &&
						entry.framework === framework &&
						entry.frameworkKey === currentEntry.frameworkKey
				)
			: null;

		setSelectedFramework(framework, !equivalentEntry);

		if (equivalentEntry) {
			window.location.href = `/docs/${equivalentEntry.slug}?framework=${framework}`;
		}
	}

	onMount(() => {
		initializeFrameworkPreference(window.location.search);

		const currentEntry = allEntries.find((entry) => entry.slug === currentSlug);
		const currentEntryFramework = currentEntry?.framework ?? null;
		if (isFramework(currentEntryFramework)) {
			setSelectedFramework(currentEntryFramework, false);
		}
	});
</script>

{#snippet desktopDocTree(nodes: DocNavigationNode[], depth: number, listId: string | undefined, listHidden: boolean)}
	<ul id={listId} class:nested={depth > 0} hidden={listHidden}>
		{#each nodes as node (node.entry.slug)}
			<li>
				{#if node.entry.kind === "group"}
					<button
						type="button"
						class="doc-navigation-group"
						class:ancestor={docNavigationNodeContains(node, currentSlug)}
						aria-expanded={!collapsedDocGroups.includes(node.entry.slug)}
						aria-controls={docGroupChildrenId(node.entry.slug)}
						onclick={() => toggleDocGroup(node.entry.slug)}
					>
						<span>{node.entry.title}</span>
						<svg
							class="doc-navigation-chevron"
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
						class:active={node.entry.slug === currentSlug}
						class:ancestor={node.entry.slug !== currentSlug &&
							docNavigationNodeContains(node, currentSlug)}
						aria-current={node.entry.slug === currentSlug ? "page" : undefined}
					>
						{node.entry.title}
					</a>
				{/if}
				{#if node.children.length > 0}
					{@render desktopDocTree(
						node.children,
						depth + 1,
						node.entry.kind === "group"
							? docGroupChildrenId(node.entry.slug)
							: undefined,
						node.entry.kind === "group" && collapsedDocGroups.includes(node.entry.slug)
					)}
				{/if}
			</li>
		{/each}
	</ul>
{/snippet}

<SeoHead
	title={docTitle}
	description={docDescription}
	path={`/docs/${currentSlug}`}
	imageAlt={`${currentProjectTitle} documentation preview`}
	noIndex={currentProject === 'snapline'}
/>

<div
	class="doc-layout"
	class:docs-home={isDocsHome}
	class:has-article-outline={articleHeadings.length > 0}
>
	{#if !isDocsHome}
		<aside class="doc-sidebar">
			<p class="doc-sidebar-project">{currentProjectTitle}</p>
			{#if showFrameworkSelect}
				<FrameworkSelect
					id="desktop-doc-framework"
					value={$selectedFramework}
					onFrameworkChange={handleFrameworkChange}
				/>
			{/if}
			<nav aria-label="Documentation">
				{#each visibleDocNavigation?.sections ?? [] as section}
					<div class="sidebar-section">
						{#if section.name}
							<p class="section-title">{section.title}</p>
						{/if}
						{@render desktopDocTree(section.nodes, 0, undefined, false)}
					</div>
				{/each}
			</nav>
		</aside>
	{/if}
	<div class="doc-content">
		<nav class="doc-breadcrumb" aria-label="Breadcrumb">
			{#each breadcrumbs as crumb, i}
				{#if i > 0} <span class="breadcrumb-sep" aria-hidden="true">/</span> {/if}
				{#if crumb.href}
					<a href={crumb.href}>{crumb.name}</a>
				{:else}
					<span aria-current={crumb.current ? "page" : undefined}>{crumb.name}</span>
				{/if}
			{/each}
		</nav>
		<div class="doc-header">
			{#if data.metadata}
				{#if data.metadata.title}
					<h1>{data.metadata.title}</h1>
				{/if}
			{/if}
			<ArticleOutline headings={articleHeadings} variant="inline" />
		</div>
		<article class="doc-article" data-framework={$selectedFramework}>
			<data.component />
		</article>

		<nav class="doc-pagination" aria-label="Documentation pages">
			{#if prevEntry}
				<a href={prevEntry.slug ? `/docs/${prevEntry.slug}` : '/docs'} class="pagination-link prev">
					<span class="pagination-label">Previous</span>
					<span class="pagination-title">{prevEntry.title}</span>
				</a>
			{:else}
				<div class="pagination-placeholder"></div>
			{/if}
			{#if nextEntry}
				<a href={nextEntry.slug ? `/docs/${nextEntry.slug}` : '/docs'} class="pagination-link next">
					<span class="pagination-label">Next</span>
					<span class="pagination-title">{nextEntry.title}</span>
				</a>
			{:else}
				<div class="pagination-placeholder"></div>
			{/if}
		</nav>
	</div>
	<ArticleOutline headings={articleHeadings} variant="rail" />
</div>

<style lang="scss">

.doc-layout {
	--doc-page-gutter: clamp(var(--size-16), 2vw, var(--size-32));
	display: grid;
	grid-template-columns: minmax(210px, 250px) minmax(0, 1fr);
	gap: clamp(var(--size-24), 3vw, var(--size-48));
	width: 100%;
	margin: clamp(var(--size-48), 6vw, var(--size-96)) 0;
	padding-inline: var(--doc-page-gutter);
	align-items: start;
	box-sizing: border-box;
}

.doc-layout.docs-home {
	grid-template-columns: minmax(0, 1fr);
}

@media (min-width: 1200px) {
	.doc-layout.has-article-outline:not(.docs-home) {
		grid-template-columns: minmax(200px, 220px) minmax(0, 1fr) minmax(170px, 190px);
		gap: clamp(var(--size-16), 1.5vw, var(--size-24));
	}

	.doc-layout.docs-home.has-article-outline {
		grid-template-columns: minmax(0, 1fr) minmax(170px, 190px);
		gap: clamp(var(--size-16), 1.5vw, var(--size-24));
	}
}

.doc-sidebar {
	position: sticky;
	top: var(--size-32);
	min-width: 0;
	max-height: calc(100vh - var(--size-64));
	overflow-y: auto;
	padding: var(--size-24);
	scrollbar-width: thin;
	box-sizing: border-box;

	.sidebar-section {
		margin-bottom: var(--size-24);

		&:last-child {
			margin-bottom: 0;
		}
	}

	ul {
		list-style: none;
		padding: 0;
		margin: 0;

		&.nested {
			padding-left: var(--size-12);
		}
	}

	li {
		margin-bottom: var(--size-2);
	}

	a,
	.doc-navigation-group {
		display: block;
		padding: var(--size-8) 0;
		border-radius: calc(var(--ui-radius) - 2px);
		color: var(--color-text);
		font-weight: 400;
		text-decoration: none;
		font-size: 0.9rem;
		line-height: 1.3;
		text-wrap: balance;
		transition:
			color 0.15s ease,
			text-shadow 0.15s ease;

		&:hover,
		&:focus-visible {
			color: var(--color-action);
			text-decoration: none;
		}

		&.ancestor {
			color: var(--color-background-dark);
			font-weight: 500;
		}
	}

	a.active {
		color: var(--color-action);
		font-weight: 600;
	}

	.doc-navigation-group {
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

	.doc-navigation-chevron {
		flex: 0 0 auto;
		transition: transform 0.15s ease;
	}

	.doc-navigation-group[aria-expanded="false"] .doc-navigation-chevron {
		transform: rotate(-90deg);
	}
}

.doc-sidebar-project {
	margin: 0 0 var(--size-20);
	color: var(--color-background-dark);
	font-family: "Geist Pixel Circle", sans-serif;
	font-size: 1.35rem;
	font-weight: 500;
	line-height: 1;
}

.section-title {
	margin: 0 0 var(--size-12);
	color: var(--color-background-dark);
	font-family: "Bitcount Grid Single", monospace;
	font-size: 1rem;
	font-weight: 300;
	letter-spacing: 0;
	line-height: 1;
}

.doc-content {
	min-width: 0;
	width: 100%;
}

.doc-breadcrumb,
.doc-header,
.doc-pagination {
	width: min(100%, var(--doc-reading-width, 700px));
	margin-inline: auto;
	box-sizing: border-box;
}

.doc-header {
	margin-bottom: clamp(var(--size-48), 6vw, var(--size-80));

	h1 {
		margin: 0;
		font-family: "Geist Pixel Circle", sans-serif;
		font-size: clamp(2.25rem, 4.5vw, 4rem);
		font-weight: 500;
		line-height: 0.9;
		text-wrap: balance;
	}
}

.doc-breadcrumb {
	display: flex;
	flex-wrap: wrap;
	align-items: center;
	gap: 0.25rem;
	margin-bottom: var(--size-16);
	color: var(--color-background-dark);
	font-family: "Bitcount Grid Single", monospace;
	font-size: 0.84rem;
	font-weight: 300;
	line-height: 1.25;

	a {
		color: inherit;
		font-family: inherit;
		font-size: inherit;
		font-weight: inherit;
		text-decoration: none;

		&:hover {
			color: var(--color-action);
			text-decoration: none;
		}
	}
}

.breadcrumb-sep {
	margin: 0 0.35em;
	color: color-mix(in srgb, var(--color-background-dark) 55%, transparent);
}

.doc-pagination {
	display: flex;
	justify-content: space-between;
	gap: var(--size-16);
	margin-top: var(--size-80);
	padding-top: var(--size-32);
	border-top: 1px solid color-mix(in srgb, var(--color-background-dark) 22%, transparent);
}

.pagination-placeholder {
	flex: 1;
}

.pagination-link {
	display: flex;
	flex-direction: column;
	flex: 1;
	padding: var(--size-20);
	border-radius: var(--ui-radius);
	text-decoration: none;

	&:hover,
	&:focus-visible {
		background: transparent;

		.pagination-label,
		.pagination-title {
			color: var(--color-action);
		}
	}

	&.prev {
		align-items: flex-start;
	}

	&.next {
		align-items: flex-end;
		text-align: right;
	}
}

.pagination-label {
	color: var(--color-background-dark);
	font-family: "Bitcount Grid Single", monospace;
	font-size: 0.82rem;
	font-weight: 300;
	line-height: 1;
	margin-bottom: var(--size-8);
	transition:
		color 0.15s ease,
		text-shadow 0.15s ease;
}

.pagination-title {
	color: var(--color-text);
	font-family: "Geist", sans-serif;
	font-size: 1rem;
	font-weight: 500;
	line-height: 1.3;
	transition:
		color 0.15s ease,
		text-shadow 0.15s ease;
}

// Responsive styles
@media (max-width: 768px) {
	.doc-layout {
		display: block;
		margin: 1.5rem auto;
		width: clamp(100px, 92%, 720px);
		padding-inline: 0;
	}

	// The project documentation links move into the global mobile menu.
	.doc-sidebar {
		display: none;
	}

	.doc-header {
		margin-bottom: 2rem;
	}

	.doc-pagination {
		flex-direction: column;
	}

	.pagination-link {
		&.prev, &.next {
			align-items: flex-start;
			text-align: left;
		}
	}
}

</style>
