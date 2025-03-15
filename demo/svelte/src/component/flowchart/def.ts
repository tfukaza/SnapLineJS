import { LineComponent, NodeComponent } from "../../lib/snapline.mjs";

export class FlowLineObject extends LineComponent {
  renderLine: (() => void) | null;
  constructor(g: any, parent: NodeComponent) {
    super(g, parent);
    this.renderLine = null;
  }
  render() {
    super.render();
    if (this.renderLine) {
      this.renderLine();
    }
  }
}
