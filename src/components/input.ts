import { FormConfig, GlobalStats } from "../types";
import { NodeComponent } from "./node";
import { ComponentBase } from "./base";

/**
 * InputForms are any components that take input from the user, such as text fields, sliders, etc.
 */
class InputForm extends ComponentBase {
  name: string; // Name of the component
  dom: HTMLElement; // The DOM element of the component
  prop: { [key: string]: any }; // Properties of the component

  constructor(
    dom: HTMLElement,
    parent: NodeComponent,
    globals: GlobalStats | null = null,
    config: FormConfig = {},
  ) {
    super(parent, globals);
    this.name = config.name || "";
    this.prop = parent._prop;
    this.dom = dom;
  }

  bindFunction(_: HTMLElement): void {
    // Abstract function
  }

  addInputUpdateListener(event: string, func: (value: any) => void) {
    this.dom.addEventListener(event, func.bind(this));
  }
}

export { InputForm };
