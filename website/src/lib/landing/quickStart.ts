import type { Framework } from "$lib/frameworks";

/**
 * Landing-page quick start. Mirrors docs/snapsort/introduction/01_setup.mdx —
 * keep these in step when that page changes.
 */
export const installCommands: Record<Framework, string> = {
  svelte: "npm install @snap-engine/snapsort @snap-engine/asset-base",
  react:
    "npm install @snap-engine/snapsort @snap-engine/asset-base react react-dom",
  vanilla: "npm install @snap-engine/snapsort",
};

export const sampleLanguages: Record<Framework, string> = {
  svelte: "svelte",
  react: "tsx",
  vanilla: "javascript",
};

const svelteSample = [
  '<script lang="ts">',
  '  import { Engine } from "@snap-engine/asset-base/svelte";',
  '  import { Container, Item } from "@snap-engine/snapsort/svelte";',
  '  import type { ItemMoveEvent } from "@snap-engine/snapsort";',
  "",
  "  let tasks = $state([",
  '    { id: "design", label: "Design" },',
  '    { id: "build", label: "Build" },',
  '    { id: "ship", label: "Ship" },',
  "  ]);",
  "",
  "  function onItemMove(event: ItemMoveEvent) {",
  "    const task = tasks.find((entry) => entry.id === event.itemId);",
  "    if (!task) return;",
  "",
  "    const next = tasks.filter((entry) => entry.id !== event.itemId);",
  "    next.splice(event.to.index, 0, task);",
  "    tasks = next;",
  "  }",
  "</" + "script>",
  "",
  '<Engine id="quick-start">',
  "  <Container",
  '    config={{ groupID: "tasks", callbacks: { onItemMove } }}',
  "    items={tasks}",
  "  >",
  "    {#snippet entry(task)}",
  "      <Item itemId={task.id}>{task.label}</Item>",
  "    {/snippet}",
  "  </Container>",
  "</Engine>",
].join("\n");

const reactSample = `import { useState } from "react";
import { Engine, Container, Item } from "@snap-engine/snapsort/react";
import type { ItemMoveEvent } from "@snap-engine/snapsort";

const initial = [
  { id: "design", label: "Design" },
  { id: "build", label: "Build" },
  { id: "ship", label: "Ship" },
];

export function QuickStart() {
  const [tasks, setTasks] = useState(initial);

  function onItemMove(event: ItemMoveEvent) {
    setTasks((current) => {
      const task = current.find((entry) => entry.id === event.itemId);
      if (!task) return current;

      const next = current.filter((entry) => entry.id !== event.itemId);
      next.splice(event.to.index, 0, task);
      return next;
    });
  }

  // Ghost previews need onGhostInsert / onGhostRemove — see the setup guide.
  return (
    <Engine id="quick-start">
      <Container config={{ groupID: "tasks", callbacks: { onItemMove } }}>
        {tasks.map((task) => (
          <Item key={task.id} itemId={task.id}>{task.label}</Item>
        ))}
      </Container>
    </Engine>
  );
}`;

const vanillaSample = `import { Engine } from "@snap-engine/core";
import { CollisionEngine } from "@snap-engine/core/collision";
import { Container, Item } from "@snap-engine/snapsort";

const root = document.querySelector("#quick-start");
const list = root.querySelector("[data-snapsort-container]");
const engine = new Engine();

engine.setCollisionEngine(new CollisionEngine());
engine.assignDom(root);

const container = new Container(engine, null, {
  groupID: "tasks",
});
container.element = list;

for (const element of list.querySelectorAll("[data-item-id]")) {
  const item = new Item(engine, container);
  item.itemId = element.dataset.itemId;
  item.element = element;
}`;

export const samples: Record<Framework, string> = {
  svelte: svelteSample,
  react: reactSample,
  vanilla: vanillaSample,
};
