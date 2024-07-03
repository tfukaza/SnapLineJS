import { isBetween } from '../helper';
import { Base } from './base';
import { GlobalStats, lineObject, ObjectTypes, customCursorDownProp } from '../types';
import { InputConnector, OutputConnector } from './connector';
import { InputForm } from './component';
import { ComponentBase } from './component';


class NodeComponent extends Base {

    type: ObjectTypes = ObjectTypes.node;
    nodeType: string;                                       /* Type of the node */

    dom: HTMLElement | null;                                /* The DOM element of the node */
    inputConnectors: { [key: string]: InputConnector };     /* Dictionary of InputConnector classes for each input connector */
    outputConnectors: { [key: string]: OutputConnector };   /* Dictionary of OutputConnector classes for each output connector */
    components: { [key: string]: ComponentBase };           /* List iof all components in the node, except for connectors */

    nodeWidth: number = 0;                                  /* Size of the node */
    nodeHeight: number = 0;
    dragStartX: number = 0;                                 /* Initial position of the node when dragging */
    dragStartY: number = 0;

    overlapping: lineObject | null;                         /* Line that the node is overlapping with */
    freeze: boolean;                                        /* If true, the node cannot be moved */

    prop: { [key: string]: any };                           /* A dictionary of all data stored in the node */
    propFunc: { [key: string]: Function };                  /* A dictionary of all functions stored in the node */

    nodeStyle: any;                                         /* CSS style of the node */


    constructor(dom: HTMLElement | null, globals: GlobalStats) {

        super(globals);

        this.nodeType = "";

        this.dom = dom;
        this.inputConnectors = {};
        this.outputConnectors = {};
        this.components = {};

        this.dragStartX = this.positionX;
        this.dragStartY = this.positionY;

        this.overlapping = null;
        this.freeze = false;

        this.prop = {};
        this.prop = new Proxy(this.prop, {
            set: (target, prop, value) => {
                prop = prop.toString();
                target[prop] = value;
                if (prop in this.outputConnectors) {
                    console.debug(`Update all nodes connected to ${prop}`);
                    const peers = this.outputConnectors[prop].peerInputs;
                    if (peers) {
                        for (const input of peers) {
                            input.parent.prop[input.name] = value;
                        }
                    }
                } else if (prop in this.inputConnectors) {
                    console.debug(`Call all functions connected to ${prop}`);
                    if (prop in this.propFunc)
                        this.propFunc[prop](value);
                }
                return true;
            }
        });
        this.propFunc = {};

        this.setNodeStyle({
            willChange: "transform",
            position: "absolute",
            transformOrigin: "top left"
        });

        this.g.globalNodeList.push(this);

        /* Public functions */
        this.initNode = this.initNode.bind(this);
        this.addInputConnector = this.addInputConnector.bind(this);
        this.addOutputConnector = this.addOutputConnector.bind(this);
        this.addInputForm = this.addInputForm.bind(this);
        this.addPropSetFunction = this.addPropSetFunction.bind(this);

        this.setRenderNodeCallback = this.setRenderNodeCallback.bind(this);
    }


    initNode(dom: HTMLElement) {
        this.dom = dom;
        this.dom.id = this.gid;

        this.renderNode(this.nodeStyle);

        this.bindFunction(this.dom);
        new ResizeObserver(() => {
            this.updateDOMproperties();
        }).observe(this.dom);
    }


    /**
     * Updates the DOM properties of the node, such as height, width, etc.
     * Also updates the DOM properties of all input and output connectors.
     * Called when the node is first created, and when the node is resized.
     * @returns
     */
    updateDOMproperties() {
        this.nodeHeight = this.dom!.offsetHeight;
        this.nodeWidth = this.dom!.offsetWidth;
        for (const input of Object.values(this.inputConnectors)) {
            input.updateDOMproperties();
        }
        for (const output of Object.values(this.outputConnectors)) {
            output.updateDOMproperties();
        }
    }


    setNodeStyle(style: any) {
        this.nodeStyle = Object.assign({}, this.nodeStyle, style);
    }


    renderNode(style: any) {
        for (const key in style) {
            if (key[0] == "_") continue;
            this.dom!.style[<any>key] = style[key];
        }

        if (style._focus) {
            this.dom!.classList.add("focus");
        } else {
            this.dom!.classList.remove("focus");
        }

        for (const output of Object.values(this.outputConnectors)) {
            output.renderAllLines(output.svgLines);
        }
        for (const input of Object.values(this.inputConnectors)) {
            let peer = input.peerOutput;
            if (!peer) continue;
            let peerOutputs = peer.parent.outputConnectors;
            for (const output of Object.values(peerOutputs)) {
                output.renderAllLines(output.svgLines);
            }
        }
    }

    setRenderNodeCallback(callback: (style: any) => void) {
        this.renderNode = (style: any) => {
            callback(style);
            for (const output of Object.values(this.outputConnectors)) {
                output.renderAllLines(output.svgLines);
            }
            for (const input of Object.values(this.inputConnectors)) {
                let peer = input.peerOutput;
                if (!peer) continue;
                let peerOutputs = peer.parent.outputConnectors;
                for (const output of Object.values(peerOutputs)) {
                    output.renderAllLines(output.svgLines);
                }
            }
        }
    }

    addNodeToCanvas(x: number, y: number) {

        this.positionX = x;
        this.positionY = y;
        this.nodeWidth = this.dom!.offsetWidth;
        this.nodeHeight = this.dom!.offsetHeight;
        this.setNodeStyle({
            transform: `translate3d(${this.positionX}px, ${this.positionY}px, 0)`
        });
        this.renderNode(this.nodeStyle);

        this.updateDOMproperties();

        this.g.canvas!.appendChild(this.dom!);

    }


    addOutputConnector(dom: HTMLElement, name: string) {
        const output = new OutputConnector(dom, { name: name }, this, this.g);
        this.outputConnectors[name] = output;
        this.prop[name] = null;
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

    addPropSetFunction(func: Function, name: string) {
        this.propFunc[name] = func;
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
        this.dragStartX = this.positionX;
        this.dragStartY = this.positionY;
    }


    componentCursorDown(_: customCursorDownProp): void {

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

    componentCursorUp() {

        if (this.freeze) return;

        this.positionX = this.dragStartX + this.g.dx / this.g.zoom
        this.positionY = this.dragStartY + this.g.dy / this.g.zoom

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

        this.renderNode(this.nodeStyle);


        if (this.overlapping == null) { return; }

        /* Handle dropping node on line */
        const from = this.overlapping.from;
        const to = this.overlapping.to;
        const firstInput = Object.values(this.inputConnectors)[0];
        const firstOutput = Object.values(this.outputConnectors)[0];
        if (to) {
            from.disconnectFromInput(to);
            from.connectToInput(firstInput);
            firstOutput.connectToInput(to);
        }


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

        this.positionX = this.dragStartX + this.g.dx / this.g.zoom
        this.positionY = this.dragStartY + this.g.dy / this.g.zoom


        this.setNodeStyle({
            transform: `translate3d(${this.positionX}px, ${this.positionY}px, 0)`
        });

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
            //line.line.classList.remove('overlapping');
            if (isBetween(this.positionX + this.nodeWidth / 2, line.connector_x, line.connector_x + line.x2) &&
                isBetween(this.positionY + this.nodeHeight / 2, line.connector_y, line.connector_y + line.y2)) {
                if ((line.y2 + line.connector_x) / 2 < avg_height) {
                    this.overlapping = line;
                    avg_height = (line.y2 + this.positionY) / 2;
                }
            }
        }
        if (!this.overlapping) {
            return;
        }
        //this.overlapping.line.classList.add('overlapping');

    }

    onFocus() {
        this.setNodeStyle({ "_focus": true });
        this.renderNode(this.nodeStyle);
    }


    offFocus() {
        this.setNodeStyle({ "_focus": false });
        this.renderNode(this.nodeStyle);
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