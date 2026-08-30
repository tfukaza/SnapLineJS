import { highlightDocsCode } from "$lib/server/highlight";

const standaloneExample = `import { Engine } from "@snap-engine/core";

const host = document.querySelector<HTMLElement>("#demo");
const engine = new Engine();

if (host) engine.element = host;`;

const frameworkExamples = [
  {
    id: "vanilla",
    label: "Vanilla",
    language: "typescript",
    code: standaloneExample,
  },
  {
    id: "svelte",
    label: "Svelte",
    language: "svelte",
    code: `<script lang="ts">
  import { Engine } from "@snap-engine/core";

  const engine = new Engine();
</script>

<div bind:this={engine.element}></div>`,
  },
  {
    id: "react",
    label: "React",
    language: "tsx",
    code: `import { useEffect, useRef } from "react";
import { Engine } from "@snap-engine/core";

export function EngineSurface() {
  const host = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const engine = new Engine();
    if (host.current) engine.element = host.current;
    return () => engine.destroy();
  }, []);

  return <div ref={host} />;
}`,
  },
] as const;

export async function load() {
  const [standalone, tabs] = await Promise.all([
    highlightDocsCode(standaloneExample, "typescript"),
    Promise.all(
      frameworkExamples.map(async ({ id, label, language, code }) => ({
        id,
        label,
        html: await highlightDocsCode(code, language),
      })),
    ),
  ]);

  return { codeExamples: { standalone, tabs } };
}
