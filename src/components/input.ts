import { FormConfig, GlobalStats, ObjectTypes } from "../types";
import { NodeComponent } from "./node";
import { ElementObject } from "./object";
import { GlobalManager } from "../global";

/**
 * InputForms are any components that take input from the user, such as text fields, sliders, etc.
 */
class InputForm extends ElementObject {
  name: string; // Name of the component
  dom: HTMLElement | null; // The DOM element of the component
  prop: { [key: string]: any }; // Properties of the component

  constructor(
    globals: GlobalManager,
    parent: NodeComponent,
    config: FormConfig = {},
  ) {
    super(globals, parent);
    this.name = config.name || "";
    this.prop = parent._prop;
    this.dom = null;
  }

  // bindFunction(_: HTMLElement): void {
  //   // Abstract function
  // }

  // addInputUpdateListener(event: string, func: (value: any) => void) {
  //   this.dom.addEventListener(event, func.bind(this));
  // }
}

export { InputForm };
