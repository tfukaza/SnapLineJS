import type { DocNavigation } from "$lib/docsCatalog";
import type { DocMetadata } from "$lib/markdown/docMetadata";

// See https://svelte.dev/docs/kit/types#app.d.ts
// for information about these interfaces
declare global {
	namespace App {
		// interface Error {}
		// interface Locals {}
		interface PageData {
			mobileDocsNavigation?: DocNavigation | null;
		}
		// interface PageState {}
		// interface Platform {}
	}
}

declare module '*.md' {
	import type { Component } from 'svelte';
	const component: Component;
	export default component;
	export const metadata: DocMetadata;
}

declare module '*.mdx' {
	import type { Component } from 'svelte';
	const component: Component;
	export default component;
	export const metadata: DocMetadata;
}

export {};
