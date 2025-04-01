import {
  LineComponent,
  ConnectorComponent,
  GlobalManager,
} from "../../../../../src/index";

export class FlowLineObject extends LineComponent {
  renderLine: (() => void) | null;
  constructor(g: GlobalManager, parent: ConnectorComponent) {
    super(g, parent);
    this.renderLine = null;
  }
}
