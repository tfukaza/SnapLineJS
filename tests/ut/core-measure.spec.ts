import { expect, test } from "@playwright/test";
import {
  elementBoxFromMeasurement,
  generateTransformString,
  parseTransformOrigin,
  parseTransformString,
} from "../../src/util";

/** A camera at `zoom`, its container at (100, 50), looking at world (10, 20). */
function stubCamera(zoom: number) {
  const offset = { x: 100, y: 50 };
  const position = { x: 10, y: 20 };
  return {
    getCameraFromScreen: (x: number, y: number): [number, number] => [
      x - offset.x,
      y - offset.y,
    ],
    getWorldFromCamera: (x: number, y: number): [number, number] => [
      x / zoom + position.x,
      y / zoom + position.y,
    ],
    getWorldDeltaFromCameraDelta: (x: number, y: number): [number, number] => [
      x / zoom,
      y / zoom,
    ],
  };
}

const edges = {
  margin: { top: 1, right: 2, bottom: 3, left: 4 },
  padding: { top: 5, right: 6, bottom: 7, left: 8 },
  border: { top: 1, right: 1, bottom: 1, left: 1 },
};

test.describe("element box measurement", () => {
  for (const zoom of [0.5, 1, 2]) {
    test(`maps the border box into world space at zoom ${zoom}`, () => {
      const clientRect = { x: 180, y: 90, width: 120, height: 60 };
      const box = elementBoxFromMeasurement(
        stubCamera(zoom),
        clientRect,
        edges,
      );

      expect(box.x).toBeCloseTo(80 / zoom + 10, 9);
      expect(box.y).toBeCloseTo(40 / zoom + 20, 9);
      expect(box.width).toBeCloseTo(120 / zoom, 9);
      expect(box.height).toBeCloseTo(60 / zoom, 9);
      // Computed CSS edges are already world units inside the camera layer.
      expect(box.margin).toBe(edges.margin);
      expect(box.padding).toBe(edges.padding);
      expect(box.border).toBe(edges.border);
      expect(box.screen).toEqual(clientRect);
      expect(Object.isFrozen(box)).toBe(true);
      expect(Object.isFrozen(box.screen)).toBe(true);
    });
  }

  test("without a camera every space is the client rect", () => {
    const clientRect = { x: 5, y: 6, width: 7, height: 8 };
    const box = elementBoxFromMeasurement(null, clientRect, edges);
    expect([box.x, box.y, box.width, box.height]).toEqual([5, 6, 7, 8]);
    expect(box.screen).toEqual(clientRect);
  });
});

test.describe("transform parsing", () => {
  test("round-trips the strings the engine writes", () => {
    for (const transform of [
      { x: 0, y: 0, scaleX: 1, scaleY: 1 },
      { x: 12.5, y: -40, scaleX: 1, scaleY: 1 },
      { x: -3, y: 7, scaleX: 2, scaleY: 0.5 },
    ]) {
      expect(parseTransformString(generateTransformString(transform))).toEqual(
        transform,
      );
    }
  });

  test("reads single-argument scale and two-argument translate", () => {
    expect(parseTransformString("scale(2)")).toEqual({
      x: 0,
      y: 0,
      scaleX: 2,
      scaleY: 2,
    });
    expect(parseTransformString("translate(5px, 6px)")).toEqual({
      x: 5,
      y: 6,
      scaleX: 1,
      scaleY: 1,
    });
    expect(parseTransformString("translateX(4px) translateY(-2px)")).toEqual({
      x: 4,
      y: -2,
      scaleX: 1,
      scaleY: 1,
    });
  });

  test("composes functions left to right", () => {
    // A translate written after a scale moves by the scaled distance.
    expect(parseTransformString("scale(2) translate(10px, 5px)")).toEqual({
      x: 20,
      y: 10,
      scaleX: 2,
      scaleY: 2,
    });
  });

  test("treats none, empty, and unsupported values as identity", () => {
    const identity = { x: 0, y: 0, scaleX: 1, scaleY: 1 };
    expect(parseTransformString("none")).toEqual(identity);
    expect(parseTransformString("")).toEqual(identity);
    expect(parseTransformString("rotate(30deg) translate(50%, 0)")).toEqual(
      identity,
    );
  });

  test("reads pixel transform origins", () => {
    expect(parseTransformOrigin("60px 20.5px")).toEqual([60, 20.5]);
    expect(parseTransformOrigin("0px 0px 0px")).toEqual([0, 0]);
  });
});
