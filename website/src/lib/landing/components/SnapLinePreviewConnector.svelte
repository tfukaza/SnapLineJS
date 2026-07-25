<script lang="ts">
  const radius = 10;

  let width = $state(0);
  let height = $state(0);
  const path = $derived.by(() => {
    const middleX = width / 2;
    return [
      `M 0 ${height}`,
      `H ${middleX - radius}`,
      `A ${radius} ${radius} 0 0 0 ${middleX} ${height - radius}`,
      `V ${radius}`,
      `A ${radius} ${radius} 0 0 1 ${middleX + radius} 0`,
      `H ${width}`,
    ].join(" ");
  });
</script>

<svg bind:clientWidth={width} bind:clientHeight={height} aria-hidden="true">
  <path d={path}></path>
</svg>

<style>
  svg {
    display: block;
    width: 100%;
    height: 100%;
    overflow: visible;
    pointer-events: none;
  }

  path {
    fill: none;
    stroke: var(--color-primary);
    stroke-linecap: round;
    stroke-linejoin: round;
    stroke-width: 3px;
    filter: drop-shadow(1px 2px 1.5px rgb(31 30 41 / 18%));
    vector-effect: non-scaling-stroke;
  }
</style>
