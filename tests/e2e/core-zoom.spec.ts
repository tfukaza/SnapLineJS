import { expect, test, type Page } from "@playwright/test";

// ElementObject.readDom under a real zoomed Camera: the measured border box is
// world-space (CSS pixels inside the camera layer), computed edges pass
// through, and `screen` is the browser's own client rect.

interface Measurement {
  box: {
    x: number;
    y: number;
    width: number;
    height: number;
    margin: Record<string, number>;
    padding: Record<string, number>;
    border: Record<string, number>;
    screen: { x: number; y: number; width: number; height: number };
  };
  clientRect: { x: number; y: number; width: number; height: number };
}

/**
 * Mount a camera at `zoom` over a 600x400 container at (100, 50) and read a
 * 120x40 content-box element with margin 8/6, padding 5, and border 3,
 * positioned at (40, 30) inside the camera layer.
 */
async function measureAtZoom(
  page: Page,
  zoom: number,
  transform = "",
): Promise<Measurement> {
  const coreImportPath = `/@fs${process.cwd()}/src/index.ts`;
  return page.evaluate(
    async ({ coreImportPath, zoom, transform }) => {
      const { Engine, Camera, ElementObject } = await import(coreImportPath);
      document.body.replaceChildren();
      document.body.style.margin = "0";

      const host = document.createElement("div");
      host.style.cssText =
        "position:fixed;left:100px;top:50px;width:600px;height:400px;overflow:hidden;";
      const layer = document.createElement("div");
      layer.style.cssText =
        "position:absolute;left:0;top:0;width:100%;height:100%;transform-origin:0 0;";
      const target = document.createElement("div");
      target.style.cssText =
        "position:absolute;left:40px;top:30px;width:120px;height:40px;" +
        "margin:8px 6px;padding:5px;border:3px solid black;box-sizing:content-box;";
      target.style.transform = transform;
      layer.append(target);
      host.append(layer);
      document.body.append(host);

      const engine = new Engine();
      const camera = new Camera(engine, {
        enablePan: false,
        zoomBounds: { min: 0.2, max: 4 },
      });
      engine.camera = camera;
      engine.assignDom(host);
      camera.handleScroll(zoom - 1, 0, 0);
      layer.style.transform = camera.canvasStyle;

      const object = new ElementObject(engine);
      object.element = target;
      const box = object.readDom(
        { unapplyTransform: transform !== "" },
        "READ_1",
      );
      const rect = target.getBoundingClientRect();
      return {
        box: JSON.parse(JSON.stringify(box)),
        clientRect: {
          x: rect.x,
          y: rect.y,
          width: rect.width,
          height: rect.height,
        },
      };
    },
    { coreImportPath, zoom, transform },
  );
}

test.beforeEach(async ({ page }) => {
  await page.goto("/");
});

for (const zoom of [0.5, 1, 2]) {
  test(`readDom reports a world-space box at zoom ${zoom}`, async ({
    page,
  }) => {
    const { box, clientRect } = await measureAtZoom(page, zoom);

    // Border box: 120 + 2*5 + 2*3 = 136 by 40 + 2*5 + 2*3 = 56 CSS pixels,
    // placed at left 40 + margin 6, top 30 + margin 8.
    expect(box.width).toBeCloseTo(136, 2);
    expect(box.height).toBeCloseTo(56, 2);
    expect(box.x).toBeCloseTo(46, 2);
    expect(box.y).toBeCloseTo(38, 2);
    expect(box.margin).toEqual({ top: 8, right: 6, bottom: 8, left: 6 });
    expect(box.padding).toEqual({ top: 5, right: 5, bottom: 5, left: 5 });
    expect(box.border).toEqual({ top: 3, right: 3, bottom: 3, left: 3 });

    expect(box.screen).toEqual(clientRect);
    expect(clientRect.width).toBeCloseTo(136 * zoom, 2);
  });
}

test("unapplyTransform removes an inline translate and scale", async ({
  page,
}) => {
  const { box } = await measureAtZoom(
    page,
    2,
    "translate3d(20px, 10px, 0px) scale(2, 1.5)",
  );

  // Back to the untransformed layout box, despite the default 50% 50% origin.
  expect(box.width).toBeCloseTo(136, 2);
  expect(box.height).toBeCloseTo(56, 2);
  expect(box.x).toBeCloseTo(46, 2);
  expect(box.y).toBeCloseTo(38, 2);
});
