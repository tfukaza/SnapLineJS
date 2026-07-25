
<script lang="ts">
	import "./doc.scss";
	import { onMount } from "svelte";
	import FrameworkSelect from "$lib/components/FrameworkSelect.svelte";
	import ProjectSelect from "$lib/components/ProjectSelect.svelte";
	import SeoHead from "$lib/components/SeoHead.svelte";
	import {
		initializeFrameworkPreference,
		selectedFramework,
		setSelectedFramework,
		type Framework
	} from "$lib/stores/frameworkState.svelte";
	let { data } = $props();

	// Import the grouped entries function from +page.ts for sidebar
	import { _getGroupedEntries, entries } from './+page.js';
	const docSections = _getGroupedEntries();
	const allEntries = entries();
	const projectOptions = [
		{ slug: 'snapengine', label: 'SnapEngine', href: '/docs/snapengine/introduction' },
		{ slug: 'snapsort', label: 'SnapSort', href: '/docs/snapsort/introduction' }
	];

	// Compute breadcrumbs from $page.params.slug
	import { page } from '$app/stores';
	const slugParts = $derived($page.params.slug ? $page.params.slug.split('/') : []);
	// Strip leading two-digit number prefix (e.g., "01_intro" -> "intro")
	const formatBreadcrumb = (part: string, index: number) => {
		if (index === 0) {
			return projectOptions.find((project) => project.slug === part)?.label ?? part;
		}

		const stripped = part.replace(/^\d{2}_/, '');
		return stripped.charAt(0).toUpperCase() + stripped.slice(1).replace(/_/g, ' ');
	};
	const breadcrumbs = $derived([
		{ name: 'Docs', href: '/docs' },
		...slugParts.map((part, i) => ({
			name: formatBreadcrumb(part, i),
			href:
				i === 0
					? (projectOptions.find((project) => project.slug === part)?.href ??
						'/docs/' + slugParts.slice(0, i + 1).join('/'))
					: '/docs/' + slugParts.slice(0, i + 1).join('/')
		}))
	]);

	// Compute prev/next navigation
	const currentSlug = $derived($page.params.slug || '');
	const isDocsHome = $derived(slugParts.length === 0);
	const currentProject = $derived(slugParts[0] || 'snapengine');
	const currentProjectTitle = $derived(
		isDocsHome ? 'SnapEngine' : currentProject === 'snapsort' ? 'SnapSort' : 'SnapEngine Core'
	);
	const docDescription = $derived(
		data.metadata?.description ??
			(currentProject === 'snapsort'
				? 'Documentation for installing, configuring, and building drag and drop interfaces with SnapSort.'
				: 'Documentation for building draggable, animated, collision-aware web experiences with SnapEngine.')
	);
	const docTitle = $derived(
		isDocsHome
			? (data.metadata?.title ?? 'SnapEngine Documentation')
			: data.metadata?.title
				? `${data.metadata.title} | ${currentProjectTitle} Docs`
				: `${currentProjectTitle} Docs`
	);
	const visibleDocSections = $derived(
		docSections
			.filter((section) => section.project === currentProject)
			.map((section) => ({
				...section,
				entries: section.entries.filter(
					(entry) => !entry.framework || entry.framework === $selectedFramework
				)
			}))
			.filter((section) => section.entries.length > 0)
	);
	const currentProjectEntries = $derived(
		allEntries.filter(
			(entry) =>
				entry.project === currentProject &&
				(!entry.framework || entry.framework === $selectedFramework)
		)
	);
	const currentIndex = $derived(currentProjectEntries.findIndex(e => e.slug === currentSlug));
	const prevEntry = $derived(currentIndex > 0 ? currentProjectEntries[currentIndex - 1] : null);
	const nextEntry = $derived(currentIndex < currentProjectEntries.length - 1 ? currentProjectEntries[currentIndex + 1] : null);

	// Mobile menu state
	let mobileMenuOpen = $state(false);
	let mobileMenuButton = $state<HTMLButtonElement | null>(null);

	function toggleMobileMenu() {
		mobileMenuOpen = !mobileMenuOpen;
	}

	function closeMobileMenu() {
		mobileMenuOpen = false;
	}

	function handleDocKeyDown(event: KeyboardEvent) {
		if (event.key !== 'Escape' || !mobileMenuOpen) return;
		closeMobileMenu();
		mobileMenuButton?.focus();
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
		if (currentEntry?.framework) {
			setSelectedFramework(currentEntry.framework as Framework, false);
		}
	});
</script>

<svelte:window onkeydown={handleDocKeyDown} />

<SeoHead
	title={docTitle}
	description={docDescription}
	path={`/docs/${currentSlug}`}
	imageAlt={`${currentProjectTitle} documentation preview`}
/>

<!-- Mobile sub-navbar with hamburger, breadcrumb, and dropdown menu -->
<div class="mobile-navbar card">
	<div class="mobile-navbar-bar">
		<button
			bind:this={mobileMenuButton}
			type="button"
			class="mobile-menu-btn"
			onclick={toggleMobileMenu}
			aria-label="Toggle documentation menu"
			aria-expanded={mobileMenuOpen}
			aria-controls="mobile-doc-menu"
		>
			<span class="hamburger-line" class:open={mobileMenuOpen}></span>
			<span class="hamburger-line" class:open={mobileMenuOpen}></span>
			<span class="hamburger-line" class:open={mobileMenuOpen}></span>
		</button>
		<nav class="mobile-breadcrumb" aria-label="Breadcrumb">
			{#each breadcrumbs as crumb, i}
				{#if i > 0} <span class="breadcrumb-sep">/</span> {/if}
				<a href={crumb.href} aria-current={i === breadcrumbs.length - 1 ? 'page' : undefined}>
					{crumb.name}
				</a>
			{/each}
		</nav>
	</div>

	<!-- Mobile dropdown menu -->
	<div id="mobile-doc-menu" class="mobile-menu-dropdown" class:open={mobileMenuOpen}>
		<nav aria-label="Documentation">
			<ProjectSelect id="mobile-doc-project" value={currentProject} options={projectOptions} />
			{#if currentProject === 'snapsort'}
				<FrameworkSelect
					id="mobile-doc-framework"
					value={$selectedFramework}
					onFrameworkChange={handleFrameworkChange}
				/>
			{/if}
			{#each visibleDocSections as section}
				<div class="sidebar-section">
					{#if section.name}
						<p class="section-title">{section.title}</p>
					{/if}
					<ul>
						{#each section.entries as entry}
							<li>
								<a
									href={entry.slug ? `/docs/${entry.slug}` : '/docs'}
									class:active={(entry.slug || '') === currentSlug}
									aria-current={(entry.slug || '') === currentSlug ? 'page' : undefined}
									onclick={closeMobileMenu}
								>
									{entry.title}
								</a>
							</li>
						{/each}
					</ul>
				</div>
			{/each}
		</nav>
	</div>
</div>

<div class="doc-layout">
	<aside class="doc-sidebar">
		<ProjectSelect id="desktop-doc-project" value={currentProject} options={projectOptions} />
		{#if currentProject === 'snapsort'}
			<FrameworkSelect
				id="desktop-doc-framework"
				value={$selectedFramework}
				onFrameworkChange={handleFrameworkChange}
			/>
		{/if}
		<nav aria-label="Documentation">
			{#each visibleDocSections as section}
				<div class="sidebar-section">
					{#if section.name}
						<p class="section-title">{section.title}</p>
					{/if}
					<ul>
						{#each section.entries as entry}
							<li>
								<a
									href={entry.slug ? `/docs/${entry.slug}` : '/docs'}
									class:active={(entry.slug || '') === currentSlug}
									aria-current={(entry.slug || '') === currentSlug ? 'page' : undefined}
								>
									{entry.title}
								</a>
							</li>
						{/each}
					</ul>
				</div>
			{/each}
		</nav>
	</aside>
	<div class="doc-content">
		<nav class="doc-breadcrumb" aria-label="Breadcrumb">
			{#each breadcrumbs as crumb, i}
				{#if i > 0} <span class="breadcrumb-sep">/</span> {/if}
				<a href={crumb.href} aria-current={i === breadcrumbs.length - 1 ? 'page' : undefined}>
					{crumb.name}
				</a>
			{/each}
		</nav>
		<div class="doc-header">
			{#if data.metadata}
				{#if data.metadata.title}
					<h1>{data.metadata.title}</h1>
				{/if}
				{#if data.metadata.description}
					<p class="description">{data.metadata.description}</p>
				{/if}
			{/if}
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
</div>

<style lang="scss">

.doc-layout {
	display: grid;
	grid-template-columns: minmax(210px, 260px) minmax(0, 1fr);
	gap: clamp(var(--size-32), 5vw, var(--size-80));
	margin: clamp(var(--size-48), 6vw, var(--size-96)) auto;
	width: clamp(100px, 90%, 1200px);
	align-items: start;
}

.doc-sidebar {
	position: sticky;
	top: var(--size-32);
	min-width: 0;
	max-height: calc(100vh - var(--size-64));
	overflow-y: auto;
	padding: var(--size-24);
	scrollbar-width: thin;

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
	}

	li {
		margin-bottom: var(--size-2);
	}

	a {
		display: block;
		padding: var(--size-8) var(--size-12);
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

		&.active {
			color: var(--color-action);
			font-weight: 600;
		}
	}
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
	max-width: 840px;
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

p.description {
	max-width: 680px;
	margin: var(--size-24) 0 0;
	color: var(--color-text);
	font-size: clamp(1rem, 1.6vw, 1.18rem);
	font-weight: 300;
	line-height: 1.6;
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

// Mobile navbar (hidden on desktop)
.mobile-navbar {
	display: none;
	position: sticky;
	top: 0;
	left: 0;
	right: 0;
	z-index: 100;
	--card-color: var(--color-background);
	padding: 0;
	flex-direction: column;
}

.mobile-navbar-bar {
	display: flex;
	align-items: center;
	gap: 0.75rem;
	padding: 0.75rem 1rem;
	border-bottom: 1px solid color-mix(in srgb, var(--color-background-dark) 16%, transparent);
}

// Mobile menu button
.mobile-menu-btn {
	display: flex;
	align-items: center;
	justify-content: center;
	min-width: 44px;
	min-height: 44px;
	box-sizing: border-box;
	background: transparent;
	border: none;
	padding: 8px 8px;
	cursor: pointer;
	flex-direction: column;
	gap: 5px;
	flex-shrink: 0;

	.hamburger-line {
		display: block;
		width: 18px;
		height: 2px;
		background: #333;
		border-radius: 1px;
		transition: transform 0.3s, opacity 0.3s;
		margin-bottom: 0px;

		&.open:nth-child(1) {
			transform: translateY(7px) rotate(45deg);
		}
		&.open:nth-child(2) {
			transform: scaleX(0);
		}
		&.open:nth-child(3) {
			transform: translateY(-7px) rotate(-45deg);
		}
	}
}

// Mobile breadcrumb
.mobile-breadcrumb {
	font-size: 0.85rem;
	color: #888;
	overflow: hidden;
	text-overflow: ellipsis;
	white-space: nowrap;
	font-family: "Bitcount Grid Single", monospace;

	a {
		color: var(--color-background-dark);
		font-family: inherit;
		font-size: inherit;
		text-decoration: none;

		&:hover {
			color: var(--color-action);
			text-decoration: none;
		}
	}

	.breadcrumb-sep {
		margin: 0 0.25em;
		color: #bbb;
	}
}

// Mobile dropdown menu
.mobile-menu-dropdown {
	display: none;
	max-height: 0;
	overflow: hidden;
	visibility: hidden;
	pointer-events: none;
	background: var(--color-background);
	transition:
		max-height 0.3s ease,
		visibility 0s linear 0.3s;

	&.open {
		max-height: 70vh;
		overflow-y: auto;
		visibility: visible;
		pointer-events: auto;
		transition-delay: 0s;
		border-bottom: 1px solid color-mix(in srgb, var(--color-background-dark) 16%, transparent);
	}

	nav {
		padding: 2rem 1rem;
	}

	.sidebar-section {
		margin-bottom: 1.5rem;

		&:last-child {
			margin-bottom: 0;
		}
	}

	.section-title {
		font-size: 0.92rem;
		font-weight: 300;
		text-transform: none;
		letter-spacing: 0;
		color: var(--color-background-dark);
		margin: 0 0 0.5rem 0;
	}

	ul {
		list-style: none;
		padding: 0;
		margin: 0;
	}

	li {
		margin-bottom: 0.5rem;
	}

	a {
		display: block;
		padding: var(--size-8) var(--size-12);
		border-radius: calc(var(--ui-radius) - 2px);
		color: var(--color-text);
		text-decoration: none;
		font-size: 0.9rem;
		line-height: 1.3;
		transition:
			color 0.15s ease,
			text-shadow 0.15s ease;

		&:hover,
		&:focus-visible {
			color: var(--color-action);
			text-decoration: none;
		}

		&.active {
			color: var(--color-action);
			font-weight: 600;
		}
	}
}

// Responsive styles
@media (max-width: 768px) {
	.mobile-navbar {
		display: flex;
	}

	.mobile-menu-dropdown {
		display: block;
	}

	.doc-layout {
		display: block;
		margin: 1.5rem auto;
		width: clamp(100px, 92%, 720px);
	}

	// Hide desktop sidebar and breadcrumb on mobile
	.doc-sidebar {
		display: none;
	}

	.doc-breadcrumb {
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
