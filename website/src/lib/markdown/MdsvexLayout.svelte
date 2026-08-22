<script context="module">
	import CodeBlockPre from './CodeBlockPre.svelte';
	export const pre = CodeBlockPre;
</script>

<script lang="ts">
	import { onMount } from 'svelte';

	const storagePrefix = 'preferredCodeTab:';

	function tabsIn(group: Element): HTMLButtonElement[] {
		return Array.from(group.querySelectorAll<HTMLButtonElement>('[data-code-tab]'));
	}

	function panelsIn(group: Element): HTMLElement[] {
		return Array.from(group.querySelectorAll<HTMLElement>('[data-code-tab-panel]'));
	}

	function activate(group: Element, value: string): boolean {
		const buttons = tabsIn(group);
		const panels = panelsIn(group);
		const selectedIndex = buttons.findIndex((button) => button.dataset.codeTabValue === value);
		if (selectedIndex < 0) return false;

		buttons.forEach((button, index) => {
			const selected = index === selectedIndex;
			button.setAttribute('aria-selected', String(selected));
			button.tabIndex = selected ? 0 : -1;
		});
		panels.forEach((panel, index) => {
			panel.hidden = index !== selectedIndex;
		});
		return true;
	}

	function storedPreference(signature: string): string | null {
		try {
			return localStorage.getItem(`${storagePrefix}${signature}`);
		} catch {
			return null;
		}
	}

	function storePreference(signature: string, value: string): void {
		try {
			localStorage.setItem(`${storagePrefix}${signature}`, value);
		} catch {
			// Storage can be unavailable in privacy-restricted browser contexts.
		}
	}

	function selectAcrossMatchingGroups(group: HTMLElement, value: string): void {
		const signature = group.dataset.codeTabGroup;
		if (!signature) return;
		for (const candidate of document.querySelectorAll<HTMLElement>('[data-code-tabs]')) {
			if (candidate.dataset.codeTabGroup === signature) activate(candidate, value);
		}
		storePreference(signature, value);
	}

	onMount(() => {
		for (const group of document.querySelectorAll<HTMLElement>('[data-code-tabs]')) {
			const signature = group.dataset.codeTabGroup;
			const preferred = signature ? storedPreference(signature) : null;
			if (preferred) activate(group, preferred);
		}

		const handleClick = (event: MouseEvent) => {
			const button = (event.target as Element | null)?.closest<HTMLButtonElement>('[data-code-tab]');
			const group = button?.closest<HTMLElement>('[data-code-tabs]');
			const value = button?.dataset.codeTabValue;
			if (!button || !group || !value) return;
			selectAcrossMatchingGroups(group, value);
		};

		const handleKeydown = (event: KeyboardEvent) => {
			const button = (event.target as Element | null)?.closest<HTMLButtonElement>('[data-code-tab]');
			const group = button?.closest<HTMLElement>('[data-code-tabs]');
			if (!button || !group) return;

			const buttons = tabsIn(group);
			const currentIndex = buttons.indexOf(button);
			if (currentIndex < 0) return;

			let nextIndex: number | null = null;
			if (event.key === 'ArrowRight') nextIndex = (currentIndex + 1) % buttons.length;
			if (event.key === 'ArrowLeft') nextIndex = (currentIndex - 1 + buttons.length) % buttons.length;
			if (event.key === 'Home') nextIndex = 0;
			if (event.key === 'End') nextIndex = buttons.length - 1;
			if (nextIndex === null) return;

			event.preventDefault();
			const nextButton = buttons[nextIndex];
			const value = nextButton.dataset.codeTabValue;
			if (!value) return;
			selectAcrossMatchingGroups(group, value);
			nextButton.focus();
		};

		document.addEventListener('click', handleClick);
		document.addEventListener('keydown', handleKeydown);
		return () => {
			document.removeEventListener('click', handleClick);
			document.removeEventListener('keydown', handleKeydown);
		};
	});
</script>

<slot />
