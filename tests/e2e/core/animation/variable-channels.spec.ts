import { expect, test } from "@playwright/test";
import { repoRoot } from "../../shared/servers";

// AnimationObject drives `$` variables through pooled `--snap-var-*` custom
// properties on the target. A finished animation must clear its channel before
// releasing it: the next animation's Web Animation can stay pending until the
// following frame, and would sample the stale terminal value until then.

test.beforeEach(async ({ page }) => {
  await page.goto("/");
});

test("resets pooled animation variables before a channel is reused", async ({
  page,
}) => {
  const animationModuleUrl = `/@fs${repoRoot}/src/animation.ts`;
  const result = await page.evaluate(async (moduleUrl) => {
    const { AnimationObject } = await import(/* @vite-ignore */ moduleUrl);
    const target = document.createElement("div");
    document.body.appendChild(target);

    const first = new AnimationObject(
      target,
      { $value: [0, 1] },
      { duration: 40 },
    );
    first.play();
    for (let frame = 0; frame < 20 && !first.requestDelete; frame++) {
      await new Promise<void>((resolve) =>
        requestAnimationFrame(() => resolve()),
      );
    }

    const propertiesAfterFinish = Array.from(target.style).filter((name) =>
      name.startsWith("--snap-var-"),
    );
    const samples: number[] = [];
    const second = new AnimationObject(
      target,
      { $value: [0.25, 0.75] },
      {
        duration: 800,
        tick: (values: Record<string, number>) => samples.push(values.$value),
      },
    );
    const acquiredProperties = Array.from(target.style)
      .filter((name) => name.startsWith("--snap-var-"))
      .map((name) => target.style.getPropertyValue(name));
    second.play();
    second.progress = 0;
    second.calculateFrame(performance.now());
    second.cancel();
    target.remove();

    return {
      acquiredProperties,
      firstSample: samples[0] ?? null,
      propertiesAfterFinish,
    };
  }, animationModuleUrl);

  expect(result.propertiesAfterFinish).toEqual([]);
  expect(result.acquiredProperties).toHaveLength(1);
  expect(Number(result.acquiredProperties[0])).toBeCloseTo(0.25);
  expect(result.firstSample).toBeCloseTo(0.25);
});
