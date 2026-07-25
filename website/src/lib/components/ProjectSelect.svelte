<script lang="ts">
	type ProjectOption = { slug: string; label: string; href: string };

	let {
		id,
		value,
		options
	}: {
		id: string;
		value: string;
		options: ProjectOption[];
	} = $props();

	function handleChange(event: Event) {
		const select = event.currentTarget as HTMLSelectElement;
		const target = options.find((option) => option.slug === select.value);
		if (target) window.location.href = target.href;
	}
</script>

<div class="project-select">
	<label class="project-label" for={id}>Project</label>
	<select {id} class="project-dropdown" {value} onchange={handleChange}>
		{#each options as option}
			<option value={option.slug}>{option.label}</option>
		{/each}
	</select>
</div>

<style lang="scss">
	.project-select {
		position: relative;
		margin-bottom: var(--size-24);
	}

	.project-label {
		display: block;
		margin-bottom: var(--size-8);
		color: var(--color-background-dark);
		font-family: "Bitcount Grid Single", monospace;
		font-size: 0.82rem;
		font-weight: 300;
		line-height: 1;
	}

	.project-dropdown {
		width: 100%;
		box-shadow: none;
		color: var(--color-text);
		font-family: "Geist", sans-serif;
		font-size: 0.9rem;
		font-weight: 400;
		line-height: 1.3;

		&:focus {
			box-shadow: none;
		}

		option {
			color: var(--color-text) !important;
			-webkit-text-fill-color: var(--color-text);
			font-family: "Geist", sans-serif;
			font-weight: 400;
			text-decoration: none;
			font-size: 0.9rem;
			line-height: 1.3;
		}
	}
</style>
