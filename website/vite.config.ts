import { readFile } from 'node:fs/promises';
import { sveltekit } from '@sveltejs/kit/vite';
import { defineConfig, type Plugin } from 'vite';
import { parseCatalogMetadata } from './src/lib/markdown/catalogMetadata';

function docCatalogMetadata(): Plugin {
	const virtualPrefix = '\0doc-catalog-metadata:';

	return {
		name: 'doc-catalog-metadata',
		enforce: 'pre',
		async resolveId(id, importer) {
			const queryStart = id.indexOf('?');
			if (queryStart === -1) return null;

			const query = new URLSearchParams(id.slice(queryStart + 1));
			if (!query.has('doc-catalog-metadata')) return null;

			const resolved = await this.resolve(id.slice(0, queryStart), importer, {
				skipSelf: true
			});
			return resolved
				? `${virtualPrefix}${encodeURIComponent(resolved.id)}`
				: null;
		},
		async load(id) {
			if (!id.startsWith(virtualPrefix)) return null;

			const file = decodeURIComponent(id.slice(virtualPrefix.length));
			this.addWatchFile(file);
			const source = await readFile(file, 'utf8');
			return `export default ${JSON.stringify(parseCatalogMetadata(source))};`;
		}
	};
}

export default defineConfig({
	plugins: [docCatalogMetadata(), sveltekit()],
	optimizeDeps: {
		// The startup scan misses CodeBlock's import, so a cold dev server found
		// it on first visit to /about, re-optimized, and reloaded the page,
		// dropping the in-flight navigation.
		include: ['svhighlight']
	},
	server: {
		fs: {
			allow: ['..']
		}
	}
});
