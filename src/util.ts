import { GlobalManager } from "./global";
import { TransformProperty } from "./object";
function getDomProperty(global: GlobalManager, dom: HTMLElement) {
  const rect = dom.getBoundingClientRect();
  if (global.camera == null) {
    return {
      height: rect.height,
      width: rect.width,
      x: rect.left,
      y: rect.top,
      cameraX: rect.left,
      cameraY: rect.top,
      screenX: rect.left,
      screenY: rect.top,
    };
  }
  const [cameraX, cameraY] = global.camera.getCameraFromScreen(
    rect.left,
    rect.top,
  );
  const [worldX, worldY] = global.camera.getWorldFromCamera(cameraX, cameraY);
  const [cameraWidth, cameraHeight] =
    global.camera.getCameraDeltaFromWorldDelta(rect.width, rect.height);
  const [worldWidth, worldHeight] = global.camera.getWorldDeltaFromCameraDelta(
    cameraWidth,
    cameraHeight,
  );

  return {
    height: worldHeight,
    width: worldWidth,
    x: worldX,
    y: worldY,
    cameraX: cameraX,
    cameraY: cameraY,
    screenX: rect.left,
    screenY: rect.top,
  };
}

function generateTransformString(transform: TransformProperty) {
  const string = `translate3d(${transform.x}px, ${transform.y}px, 0px) scale(${transform.scaleX}, ${transform.scaleY}) `;
  return string;
}

function parseTransformString(transform: string) {
  const transformValues = transform.split("(")[1].split(")")[0].split(",");
  return {
    x: parseFloat(transformValues[0]),
    y: parseFloat(transformValues[1]),
    scaleX: parseFloat(transformValues[3]) || 1,
    scaleY: parseFloat(transformValues[4]) || 1,
  };
}

/**
 * Converts a string from camelCase to kebab-case.
 * @param str The string to be converted.
 * @returns The converted string.
 */
function camelCaseToKebab(str: string) {
  return str.replace(/([A-Z])/g, "-$1").toLowerCase();
}

function getDomStyle(dom: HTMLElement | SVGElement) {
  const existingStyleString = dom.style.cssText;
  if (existingStyleString == "") {
    return {};
  }
  return existingStyleString
    .split(";")
    .map((item) => {
      const [key, value] = item.split(":");
      return { [key]: value };
    })
    .reduce((acc, curr) => {
      return { ...acc, ...curr };
    }, {});
}

/**
 * Sets the style of a DOM element.
 * @param dom The DOM element to be styled.
 * @param style The new style to be added to the DOM element.
 */
function setDomStyle(
  dom: HTMLElement | SVGElement,
  style: { [key: string]: string },
) {
  Object.assign(dom.style, style);
}

interface CallbackInterface extends Record<KeyType, Function | null> {}

function EventProxyFactory<BindObject, Callback extends object>(
  object: BindObject,
  dict: Callback,
  secondary: Callback | null = null,
): Callback {
  return new Proxy(dict, {
    set: (
      target: Callback,
      prop: keyof Callback & KeyType,
      value: Function | null,
    ) => {
      if (value == null) {
        target[prop] = null as any;
      } else {
        target[prop] = value.bind(object);
      }
      return true;
    },
    get: (
      target: Callback & CallbackInterface,
      prop: keyof Callback & KeyType,
    ) => {
      // console.log(
      //   object,
      //   "target[prop]",
      //   target[prop],
      //   "secondary[prop]",
      //   secondary?.[prop],
      // );
      // console.trace();
      return (...args: any[]) => {
        // if (target[prop] != null && typeof target[prop] === "function") {
        //   console.log("target[prop]", target[prop]);
        // }
        // console.log("target[prop]", target[prop]);
        // console.log("secondary[prop]", secondary?.[prop]);
        // console.trace();
        target[prop]?.(...args);
        (secondary as Callback & CallbackInterface)?.[prop]?.(...args);
      };
    },
  });
}

export {
  setDomStyle,
  EventProxyFactory,
  getDomProperty,
  generateTransformString,
  parseTransformString,
};
