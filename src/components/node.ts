import { isBetween } from '../helper';
import { Base } from './base';
import { GlobalStats, lineObject, ObjectTypes, customCursorDownProp } from '../types';
import { InputConnector, OutputConnector } from './connector';
import { InputForm } from './component';
import { ComponentBase } from './component';


class NodeComponent extends Base {

    inputConnectors: { [key: string]: InputConnector };     // Dictionary of InputConnector classes for each input connector
    outputConnectors: { [key: string]: OutputConnector };   // Dictionary of OutputConnector classes for each output connector
    outputCount: number;

    components: { [key: string]: ComponentBase };   // List iof all components in the node, except for connectors

    dom: HTMLElement;                               // The DOM element of the node 

    nodeWidth: number = 0;
    nodeHeight: number = 0;

    panStartX: number;
    panStartY: number;

    overlapping: lineObject | null;
    freeze: boolean;
    type: ObjectTypes;

    prop: { [key: string]: any };
    outputProp: { [key: string]: any };

    constructor(dom: HTMLElement, globals: GlobalStats) {

        super(globals);

        this.inputConnectors = {};
        this.outputConnectors = {};
        this.outputCount = 0;
        this.components = {};

        this.panStartX = this.position_x;
        this.panStartY = this.position_y;
        this.overlapping = null;
        this.freeze = false;
        this.type = ObjectTypes.node;

        this.dom = dom;
        this.dom.style.willChange = "transform";
        this.dom.style.position = "absolute";
        this.dom.style.transformOrigin = "top left";
        this.dom.id = this.gid;

        this.bindFunction(this.dom);
        this.g.nodeArray.push(this);

        new ResizeObserver(() => {
            this.updateDOMproperties();
        }).observe(this.dom);

        this.prop = {};
        this.outputProp = {}
        this.prop = new Proxy(this.prop, {
            set: (target, prop, value) => {
                prop = prop.toString();
                target[prop] = value;
                if (prop in this.outputProp) {
                    this.evaluate(prop);
                }

                return true;
            },
            get: (target, prop) => {
                prop = prop.toString();
                return target[prop];
            }

        });
    }

    addNodeToCanvas(x: number, y: number) {

        this.position_x = x;
        this.position_y = y;
        this.nodeWidth = this.dom.offsetWidth;
        this.nodeHeight = this.dom.offsetHeight;
        this.dom.style.transform = `translate3d(${this.position_x}px, ${this.position_y}px, 0)`;
        this.updateDOMproperties();

        this.g.canvas!.appendChild(this.dom);

    }


    addOutputConnector(dom: HTMLElement, name: string) {

        const output = new OutputConnector(dom, { name: name }, this, this.g);
        this.outputConnectors[name] = output;

        this.prop[name] = null;
        this.outputProp[name] = null;

        return output;
    }


    addInputConnector(dom: HTMLElement, name: string) {
        const input = new InputConnector(dom, { name: name }, this, this.g);
        this.inputConnectors[name] = input;

        this.prop[name] = null;

        return input;
    }


    addInputForm(dom: HTMLElement, name: string) {
        const input = new InputForm(dom, { name: name }, this, this.g);
        this.prop[name] = null;

        return input;
    }


    findInput(id: string): InputConnector | null {
        for (const input of Object.values(this.inputConnectors)) {
            if (input.name == id) {
                return input;
            }
        }
        return null;
    }

    findOutput(id: string): OutputConnector | null {
        for (const output of Object.values(this.outputConnectors)) {
            if (output.name == id) {
                return output;
            }
        }
        return null;

    }


    setStartPositions() {
        this.panStartX = this.position_x;
        this.panStartY = this.position_y;
    }


    customCursorDown(_: customCursorDownProp) {

        console.debug(`Node class mousedown event triggered on ${this.gid}!`);

        let isInFocusNodes = false;
        for (let i = 0; i < this.g.focusNodes.length; i++) {
            if (this.g.focusNodes[i].gid == this.gid) {
                isInFocusNodes = true;
                break;
            }
        }
        if (!isInFocusNodes) {
            /* If this node is not in focusNodes, then it is a regular click 
             * Unselect other nodes in focusNodes */
            for (let i = 0; i < this.g.focusNodes.length; i++) {
                this.g.focusNodes[i].offFocus();
            }
            this.g.focusNodes = [this];
            this.onFocus();
        } else {
            /* Otherwise, we are dragging multiple nodes. 
             * Call the setStartPositions function for all nodes in focusNodes */
            for (let i = 0; i < this.g.focusNodes.length; i++) {
                this.g.focusNodes[i].setStartPositions();
            }
        }

        this.setStartPositions();

    }

    domCursorUp() {

        if (this.freeze) return;

        this.position_x = this.panStartX + this.g.dx / this.g.zoom
        this.position_y = this.panStartY + this.g.dy / this.g.zoom

        /* If the mouse has not moved since being pressed, then it is a regular click
            unselect other nodes in focusNodes */
        console.debug("Mouse has moved: " + this.g.mouseHasMoved);
        if (!this.g.mouseHasMoved && this.g.targetObject && this.g.targetObject.gid == this.gid) {
            console.debug("Mouse has not moved")
            for (let i = 0; i < this.g.focusNodes.length; i++) {
                this.g.focusNodes[i].offFocus();
            }
            this.g.focusNodes = [this];
            this.onFocus();
            return;
        }


        if (this.overlapping == null) { return; }

        /* Handle dropping node on line */
        const from = this.overlapping.from;
        const to = this.overlapping.to;
        const firstInput = Object.values(this.inputConnectors)[0];
        const firstOutput = Object.values(this.outputConnectors)[0];
        from.disconnectFromInput(to);
        from.connectToInput(firstInput);
        firstOutput.connectToInput(to);


    }


    /**
     * Fired every time requestAnimationFrame is called,
     * if this object is being dragged.
     * It reads the internal states like current mouse position,
     * and updates the DOM element accordingly.
     * @returns 
     */
    onDrag() {

        if (this.freeze) return;

        this.position_x = this.panStartX + this.g.dx / this.g.zoom
        this.position_y = this.panStartY + this.g.dy / this.g.zoom

        this.dom.style.transform = `translate3d(${this.position_x}px, ${this.position_y}px, 0)`;

        for (const input of Object.values(this.inputConnectors)) {
            input.nodeDrag();
        }
        for (const output of Object.values(this.outputConnectors)) {
            output.nodeDrag();
        }

        this.overlapping = null;

        if (Object.keys(this.inputConnectors).length == 0 && Object.keys(this.outputConnectors).length == 0) return;

        let avg_height = 9999;
        for (const line of this.g.globalLines) {
            line.line.classList.remove('overlapping');
            if (isBetween(this.position_x + this.nodeWidth / 2, line.connector_x, line.connector_x + line.x2) &&
                isBetween(this.position_y + this.nodeHeight / 2, line.connector_y, line.connector_y + line.y2)) {
                if ((line.y2 + line.connector_x) / 2 < avg_height) {
                    this.overlapping = line;
                    avg_height = (line.y2 + this.position_y) / 2;
                }
            }
        }
        if (!this.overlapping) {
            return;
        }
        this.overlapping.line.classList.add('overlapping');

    }

    onFocus() {
        this.dom.classList.add('focused');
        this.dom.style.zIndex = "20";
        this.updateDOMproperties();
    }


    offFocus() {
        this.dom.classList.remove('focused');
        this.dom.style.zIndex = "10";
    }


    updateDOMproperties() {
        this.nodeHeight = this.dom.offsetHeight;
        this.nodeWidth = this.dom.offsetWidth;
        for (const input of Object.values(this.inputConnectors)) {
            input.updateDOMproperties();
        }
        for (const output of Object.values(this.outputConnectors)) {
            output.updateDOMproperties();
        }
    }


    evaluate(varName: string) {
        console.debug("Update all nodes connected to " + varName);
        const output = this.outputConnectors[varName];
        if (!output) return;
        for (const input of output.peerInputs) {
            console.debug(`Update input ${input.name} connected to ${varName} with value ${this.prop[varName]}`);
            input.prop[input.name] = this.prop[varName];
            input.updateFunction();
        }
    }


    exec() {

    }


    destroy() {
        this.g.canvas?.removeChild(this.dom!);
        for (const input of Object.values(this.inputConnectors)) {
            input.destroy();
        }
        for (const output of Object.values(this.outputConnectors)) {
            output.destroy();
        }
    }


}

export {
    NodeComponent
}