import { worldRectFromScreenRect, type ScreenToWorldMapper } from "./camera";
import { ZERO_EDGES, type Edges, type ElementBox, type Rect } from "./geometry";
import type { DomElement, TransformProperty } from "./object";

/**
 * Merges defined override values onto a complete defaults object.
 *
 * Unlike object spread, an explicit `undefined` does not replace a default.
 * Other falsy values such as `false`, `0`, `""`, and `null` are preserved.
 */
function mergeDefined<T extends object>(defaults: T, overrides: Partial<T>): T {
  const merged = { ...defaults };
  for (const key of Object.keys(overrides) as (keyof T)[]) {
    const value = overrides[key];
    if (value !== undefined) merged[key] = value as T[keyof T];
  }
  return merged;
}

/** The CSS edge thicknesses read from an element's computed style. */
interface MeasuredEdges {
  readonly margin: Edges;
  readonly padding: Edges;
  readonly border: Edges;
}

/** A frozen, all-zero element box used before the first DOM read. */
const EMPTY_ELEMENT_BOX: ElementBox = Object.freeze({
  x: 0,
  y: 0,
  width: 0,
  height: 0,
  screen: Object.freeze({ x: 0, y: 0, width: 0, height: 0 }),
  margin: ZERO_EDGES,
  padding: ZERO_EDGES,
  border: ZERO_EDGES,
});

function sameEdges(a: Edges, b: Edges): boolean {
  return (
    a.top === b.top &&
    a.right === b.right &&
    a.bottom === b.bottom &&
    a.left === b.left
  );
}

/** A frozen edge set, reusing `previous` or `ZERO_EDGES` when values match. */
function internEdges(
  top: number,
  right: number,
  bottom: number,
  left: number,
  previous: Edges | undefined,
): Edges {
  const edges = { top, right, bottom, left };
  if (previous && sameEdges(previous, edges)) return previous;
  if (sameEdges(ZERO_EDGES, edges)) return ZERO_EDGES;
  return Object.freeze(edges);
}

function readEdges(
  css: CSSStyleDeclaration,
  previous: ElementBox | undefined,
): MeasuredEdges {
  const px = (value: string) => parseFloat(value) || 0;
  return {
    margin: internEdges(
      px(css.marginTop),
      px(css.marginRight),
      px(css.marginBottom),
      px(css.marginLeft),
      previous?.margin,
    ),
    padding: internEdges(
      px(css.paddingTop),
      px(css.paddingRight),
      px(css.paddingBottom),
      px(css.paddingLeft),
      previous?.padding,
    ),
    border: internEdges(
      px(css.borderTopWidth),
      px(css.borderRightWidth),
      px(css.borderBottomWidth),
      px(css.borderLeftWidth),
      previous?.border,
    ),
  };
}

/**
 * Build an element box from a measured client rect and computed CSS edges.
 *
 * Pure: performs no DOM reads, so it can be exercised with a stub camera.
 * The border box maps from screen to world space through `camera`: its
 * origin through the camera transform and its size by the zoom. Computed
 * CSS edges are already world-space for elements inside the camera layer
 * (one world unit is one CSS pixel there), so they pass through unchanged.
 * `screen` keeps the client rect exactly as measured.
 */
function elementBoxFromMeasurement(
  camera: ScreenToWorldMapper | null,
  clientRect: Rect,
  edges: MeasuredEdges,
): ElementBox {
  const world = worldRectFromScreenRect(camera, clientRect);
  return Object.freeze({
    x: world.x,
    y: world.y,
    width: world.width,
    height: world.height,
    screen: Object.freeze({
      x: clientRect.x,
      y: clientRect.y,
      width: clientRect.width,
      height: clientRect.height,
    }),
    margin: edges.margin,
    padding: edges.padding,
    border: edges.border,
  });
}

/**
 * Measure an element's box: its transformed client rect and computed CSS
 * margin, padding, and border widths.
 *
 * Forces layout, so call it only in a READ stage. Pass the element's
 * previous box to reuse unchanged edge objects.
 */
function measureElementBox(
  camera: ScreenToWorldMapper | null,
  element: DomElement,
  previous?: ElementBox,
): ElementBox {
  const rect = element.getBoundingClientRect();
  const css = window.getComputedStyle(element);
  return elementBoxFromMeasurement(
    camera,
    { x: rect.left, y: rect.top, width: rect.width, height: rect.height },
    readEdges(css, previous),
  );
}

/**
 * Converts a transform object into a CSS transform string.
 *
 * Generates a translate3d and scale transformation for hardware acceleration.
 *
 * @param transform - The transform properties to convert.
 * @returns A CSS transform string.
 */
function generateTransformString(transform: TransformProperty) {
  const string = `translate3d(${transform.x}px, ${transform.y}px, 0px) scale(${transform.scaleX}, ${transform.scaleY}) `;
  return string;
}

const TRANSFORM_FUNCTION = /([a-zA-Z0-9]+)\(([^)]*)\)/g;

/** A pixel length (`12px`, `-3.5px`, or a bare `0`), else `null`. */
function parsePixelLength(value: string | undefined): number | null {
  if (value === undefined) return null;
  const trimmed = value.trim();
  if (/^-?[\d.]+(e-?\d+)?px$/i.test(trimmed)) return parseFloat(trimmed);
  return parseFloat(trimmed) === 0 ? 0 : null;
}

/**
 * Parses the translation and scale of a CSS transform string, such as the
 * `translate3d(...) scale(...)` strings `generateTransformString` writes.
 *
 * Functions compose left to right, so a translate after a scale is scaled.
 * Supported: `translate`, `translate3d`, `translateX`, `translateY` (pixel
 * lengths only) and `scale`, `scaleX`, `scaleY`. Other functions, and
 * translations in units other than `px`, are ignored.
 *
 * @param transform - A CSS transform string to parse.
 * @returns The composed translation (`x`, `y`, in pixels) and scale.
 */
function parseTransformString(transform: string): TransformProperty {
  let x = 0;
  let y = 0;
  let scaleX = 1;
  let scaleY = 1;
  const translate = (dx: number | null, dy: number | null) => {
    x += scaleX * (dx ?? 0);
    y += scaleY * (dy ?? 0);
  };
  for (const [, name, rawArgs] of transform.matchAll(TRANSFORM_FUNCTION)) {
    const args = rawArgs.split(",");
    switch (name) {
      case "translate":
      case "translate3d":
        translate(parsePixelLength(args[0]), parsePixelLength(args[1] ?? "0"));
        break;
      case "translateX":
        translate(parsePixelLength(args[0]), 0);
        break;
      case "translateY":
        translate(0, parsePixelLength(args[0]));
        break;
      case "scale": {
        const sx = parseFloat(args[0]);
        const sy = args[1] === undefined ? sx : parseFloat(args[1]);
        if (Number.isFinite(sx)) scaleX *= sx;
        if (Number.isFinite(sy)) scaleY *= sy;
        break;
      }
      case "scaleX": {
        const sx = parseFloat(args[0]);
        if (Number.isFinite(sx)) scaleX *= sx;
        break;
      }
      case "scaleY": {
        const sy = parseFloat(args[0]);
        if (Number.isFinite(sy)) scaleY *= sy;
        break;
      }
    }
  }
  return { x, y, scaleX, scaleY };
}

/** The pixel `transform-origin` offsets of a computed style value. */
function parseTransformOrigin(origin: string): [number, number] {
  const [x, y] = origin.trim().split(/\s+/);
  return [parsePixelLength(x) ?? 0, parsePixelLength(y) ?? 0];
}

/**
 * Applies CSS styles to a DOM element.
 *
 * @param dom - The HTML or SVG element to style.
 * @param style - An object containing CSS property-value pairs.
 */
function setDomStyle(dom: DomElement, style: { [key: string]: string }) {
  Object.assign(dom.style, style);
}

type CallbackFunction = (...args: any[]) => void;

interface CallbackInterface extends Record<KeyType, CallbackFunction | null> {}

/**
 * Creates a proxy for event callbacks that automatically binds them to an object.
 *
 * When a callback function is assigned to the proxy, it's automatically bound to the
 * specified object, ensuring the correct `this` context during event handling.
 *
 * @param object - The object to bind callbacks to.
 * @param dict - The callback dictionary to proxy.
 * @param secondary - Optional secondary callback dictionary for fallback.
 * @returns A proxy that handles callback binding automatically.
 * ```
 */
function EventProxyFactory<BindObject, Callback extends object>(
  object: BindObject,
  dict: Callback,
  secondary: Callback | null = null,
): Callback {
  return new Proxy(dict, {
    set: (
      target: Callback,
      prop: keyof Callback & KeyType,
      value: CallbackFunction | null,
    ) => {
      if (value == null) {
        target[prop] = null as any;
      } else {
        target[prop] = value.bind(object) as any;
      }
      return true;
    },
    get: (
      target: Callback & CallbackInterface,
      prop: keyof Callback & KeyType,
    ) => {
      return (...args: any[]) => {
        target[prop]?.(...args);
        (secondary as Callback & CallbackInterface)?.[prop]?.(...args);
      };
    },
  });
}

export type { MeasuredEdges };
export {
  setDomStyle,
  EventProxyFactory,
  EMPTY_ELEMENT_BOX,
  measureElementBox,
  elementBoxFromMeasurement,
  generateTransformString,
  parseTransformString,
  parseTransformOrigin,
  mergeDefined,
};
