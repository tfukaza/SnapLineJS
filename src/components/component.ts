import { ComponentConfig, GlobalStats } from "../types";
import { NodeComponent } from "./node";
import { Base } from "./base";

/**
 * Components refer to any element that is part of a node.
 */
export class ComponentBase extends Base {
  parent: NodeComponent | null;
  config: ComponentConfig;
  dom: HTMLElement | null;

  constructor(
    config: ComponentConfig,
    parent: NodeComponent | null,
    globals: GlobalStats,
  ) {
    super(globals);
    this.config = config;
    this.parent = parent;
    this.dom = null;
  }
}

/**
 * InputForms are any components that take input from the user, such as text fields, sliders, etc.
 */
class InputForm extends ComponentBase {
  name: string; // Name of the component
  dom: HTMLElement; // The DOM element of the component
  prop: { [key: string]: any }; // Properties of the component

  constructor(
    dom: HTMLElement,
    config: ComponentConfig,
    parent: NodeComponent,
    globals: GlobalStats,
  ) {
    super(config, parent, globals);
    this.name = config.name;
    this.prop = parent.prop;
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
