
import { ComponentConfig, GlobalStats, ObjectTypes, customCursorDownProp, lineObject } from "../types";
import { ComponentBase } from "./component";
import { NodeComponent } from "./node";
import { LineElement } from "../types";


/**
 * Connector components are the elements that are used to connect nodes.
 */
class ConnectorComponent extends ComponentBase {

    name: string;                   /* Name of the component */

    connector_x: number;            /* Location of the connector on canvas */
    connector_y: number;
    c_total_offset_x: number;       /* Location of the connector relative to the location of parent Node */
    c_total_offset_y: number;

    prop: { [key: string]: any };   /* Reference to the parent's prop object */

    svgLines: Array<lineObject>;
    type: ObjectTypes = ObjectTypes.connector;

    dom: HTMLElement;
    parent: NodeComponent;


    constructor(dom: HTMLElement, config: ComponentConfig, parent: NodeComponent, globals: GlobalStats) {
        super(config, parent, globals);

        this.connector_x = 0;
        this.connector_y = 0;

        this.c_total_offset_x = 0;
        this.c_total_offset_y = 0;

        this.dom = dom;
        this.parent = parent;
        this.prop = parent.prop;


        if (config.name) {
            this.name = config.name;
        } else {
            globals.gid++;
            this.name = globals.gid.toString();
        }
        this.g.globalNodeTable[this.gid] = this;

        this.bindFunction(this.dom);

        this.dom.setAttribute('sl-gid', this.gid.toString());

        this.svgLines = [];
    }

    pxToInt(px: string): number {
        return parseInt(px.substring(0, px.length - 2));
    }

    getComputed(element: HTMLElement, prop: string) {
        const s = window.getComputedStyle(element, null).getPropertyValue(prop);
        if (s.endsWith('px')) return this.pxToInt(s);
        else return parseInt(s);
    }

    updateDOMproperties() {
        let parentDOM = this.dom;
        let p = parentDOM!.getBoundingClientRect();
        let p1 = this.parent.dom!.getBoundingClientRect();
        this.c_total_offset_x = (p.left - p1.left) / this.g.zoom + p.width / 2 / this.g.zoom;
        this.c_total_offset_y = (p.top - p1.top) / this.g.zoom + p.height / 2 / this.g.zoom;
    }


    /* SVG line functions */


    createLineDOM(): SVGSVGElement {
        const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
        const line = document.createElementNS('http://www.w3.org/2000/svg', 'line');
        svg.appendChild(line);
        svg.classList.add('sl-connector-svg');
        line.classList.add('sl-connector-line');
        line.setAttribute('stroke-width', '4');

        this.g.canvas!.appendChild(svg);

        return svg;
    }


    setStyle(dom: LineElement, style: any) {
        if (!dom) {
            return;
        }
        for (const key in style) {
            dom.style[<any>key] = style[key];
        }
    }

    renderLinePosition(entry: lineObject) {

        let svg: LineElement = entry.svg;
        if (!svg) {
            return;
        }
        this.setStyle(svg, {
            position: 'absolute',
            overflow: 'visible',
            pointerEvents: 'none',
            willChange: 'transform',
            transform: `translate3d(${entry.connector_x}px, ${entry.connector_y}px, 0)`,
        });
        let line = svg.children[0] as SVGLineElement;
        line.setAttribute('x1', '' + 0);
        line.setAttribute('y1', '' + 0);
        line.setAttribute('x2', '' + entry.x2);
        line.setAttribute('y2', '' + entry.y2);
    }


    /* Deletes the line from the svgLines array */
    deleteLine(i: number): lineObject | undefined {
        if (this.svgLines.length > 0) {
            const svg = this.svgLines[i];
            svg.requestDelete = true;
        }
        return undefined;
    }

    deleteAllLines() {
        for (const svg of this.svgLines) {
            svg.requestDelete = true;
        }
    }


}


class InputConnector extends ConnectorComponent {

    //inputDOM: HTMLElement | null;       // Reference to the UI element where the user enters the value
    // inter: InputInterface;
    peerOutput: OutputConnector | null;
    updateFunction: Function = () => {
        console.debug("Update function not set for input connector");
    };

    constructor(dom: HTMLElement, config: ComponentConfig, parent: NodeComponent, globals: GlobalStats) {

        super(dom, config, parent, globals);

        // this.inter = inter;


        this.peerOutput = null;

        // const connector = document.createElement('span');
        // connector.classList.add('sl-input-connector');
        // connector.id = `input-${this.gid}`;

        // connector.onmousedown = this.domMouseDown.bind(this);
        // connector.ontouchstart = this.domTouchStart.bind(this);

        //this.dom = dom;
    }

    renderAllLines(svgLines: Array<lineObject>, deletedLines: Array<lineObject> = [], newLines: Array<lineObject> = [], updatedLines: Array<lineObject> = []) {
        this.peerOutput?.renderAllLines(svgLines, deletedLines, newLines, updatedLines);
    }

    domTouchStart(e: TouchEvent): void {
        this.domCursorDown(0, e.touches[0].clientX, e.touches[0].clientY);
        e.stopPropagation();
    }

    domMouseDown(e: MouseEvent): void {
        this.domCursorDown(e.button, e.clientX, e.clientY);
        e.stopPropagation();
    }

    domCursorDown(button: number, clientX: number, clientY: number): void {
        if (this.peerOutput) {
            super.domCursorDown(button, clientX, clientY);
            // Hand over control to the peer output
            this.g.targetObject = this.peerOutput;

            this.g.dx_offset = (this.connector_x - this.peerOutput.connector_x) * this.g.zoom;
            this.g.dy_offset = (this.connector_y - this.peerOutput.connector_y) * this.g.zoom;
            this.g.dx = this.g.dx_offset;
            this.g.dy = this.g.dy_offset;
            this.peerOutput.customCursorDown({ button: button, clientX: clientX, clientY: clientY });
            this.peerOutput.disconnectFromInput(this);

        }
    }

    updateConnectorPosition() {
        this.connector_x = this.parent.position_x + this.c_total_offset_x;
        this.connector_y = this.parent.position_y + this.c_total_offset_y;
    }

    disconnectFromOutput() {
        this.peerOutput = null;
        // this.inter.dom!.classList.remove("connected");
        // this.inter.inputUI?.inputDOM?.setAttribute('disabled', 'false');
    }

    connectToOutput(output: OutputConnector) {
        this.peerOutput = output;
        // this.inter.dom?.classList.add("connected");
        // this.inter.inputUI?.inputDOM?.setAttribute('disabled', 'true');
    }

    nodeDrag() {
        this.updateConnectorPosition();
        if (!this.peerOutput) {
            return;
        }
        this.peerOutput.nodeDrag();
    }

    destroy(): void {
        if (this.peerOutput) {
            this.peerOutput.disconnectFromInput(this);
        }


    }

}


class OutputConnector extends ConnectorComponent {

    val: any;

    peerInputs: Array<InputConnector> = [];

    constructor(dom: HTMLElement, config: ComponentConfig, parent: NodeComponent, globals: GlobalStats) {
        super(dom, config, parent, globals);

        this.val = null;

        this.svgLines = [];


        this.dom = dom;

        this.renderAllLines = this.renderAllLines.bind(this);
    }



    connectToInput(input: InputConnector) {
        // Already connected, do nothing
        console.debug("Connecting to input: ", input);
        if (this === input.peerOutput) {
            console.debug("Already connected");
            return;
        }

        // If there is something already connected to the input, disconnect it
        if (input.peerOutput) {
            console.debug("Disconnecting from: ", input.peerOutput);
            input.peerOutput.disconnectFromInput(input);
            input.disconnectFromOutput();
        }

        console.debug("Now connecting to: ", input);
        input.connectToOutput(this);
        this.peerInputs.push(input);

        this.updateConnectorPosition();

        //const [svg, line] = this.createTmpSvgLine(this.connector_x, this.connector_y);

        // let newSVG = {
        //     svg: null,
        //     line: null,
        //     to: input,
        //     from: this,
        //     connector_x: this.connector_x,
        //     connector_y: this.connector_y,
        //     x2: 0,
        //     y2: 0,
        //     connector: this
        // };

        this.svgLines[0].to = input;
        this.g.globalLines.push(this.svgLines[0]);

        // this.renderAllLines(this.svgLines);

    }

    disconnectFromInput(input: InputConnector) {
        console.debug("Disconnecting from input: ", input);
        for (const svg of this.svgLines) {
            if (svg.to == input && svg.svg) {
                this.g.canvas!.removeChild(svg.svg);
                this.svgLines = this.svgLines.filter(s => s != svg);
                this.g.globalLines = this.g.globalLines.filter(s => s != svg);
                console.debug("Deleted line: ", svg);
                break;
            }
        }
        input.disconnectFromOutput();
        // Remove the input from the peerInputs array using gid as key
        this.peerInputs = this.peerInputs.filter(i => i.gid != input.gid);
    }

    updateConnectorPosition() {
        // Update the position of the output connector
        this.connector_x = this.parent.position_x + this.c_total_offset_x;
        this.connector_y = this.parent.position_y + this.c_total_offset_y;
    }

    setLineXYPosition(entry: lineObject, x: number, y: number) {
        entry.x2 = x;
        entry.y2 = y;
    }

    refreshLinePosition(entry: lineObject) {

        entry.connector_x = this.connector_x;
        entry.connector_y = this.connector_y;
        if (!entry.to) {
            entry.x2 = 0;
            entry.y2 = 0;
        } else {
            entry.x2 = (entry.to.connector_x - this.connector_x);
            entry.y2 = (entry.to.connector_y - this.connector_y);
        }
    }

    /* Called when lines need to be updated */
    refreshAllLinePositions() {
        this.updateConnectorPosition();
        for (const svgEntry of this.svgLines) {
            this.refreshLinePosition(svgEntry);
        }
    }

    renderAllLines(
        svgLines: Array<lineObject>,
        deletedLines: Array<lineObject> = [],
        newLines: Array<lineObject> = [],
        updatedLines: Array<lineObject> = []
    ) {
        for (const svg of newLines) {
            let svgDom = this.createLineDOM();
            svg.svg = svgDom;
            this.renderLinePosition(svg);
        }

        for (const svg of deletedLines) {
            this.g.canvas!.removeChild(<Node>svg.svg!);
        }

        for (const svg of updatedLines) {
            this.renderLinePosition(svg);
        }
        // if (this.tmpSvgDom) {
        //     this.setTmpSvgLineStyle({
        //         transform: `translate3d(${this.connector_x}px, ${this.connector_y}px, 0)`,
        //     });
        // }

        if (deletedLines.length > 0 || newLines.length > 0 || updatedLines.length > 0) {
            return;
        }

        for (const svgEntry of svgLines) {
            if (!svgEntry.svg) {
                let svgDom = this.createLineDOM();
                svgEntry.svg = svgDom;
            } else if (svgEntry.requestDelete) {
                this.g.canvas!.removeChild(<Node>svgEntry.svg!);
                continue;
            }

            svgEntry.connector_x = this.connector_x;
            svgEntry.connector_y = this.connector_y;
            if (svgEntry.to) {
                svgEntry.x2 = (svgEntry.to.connector_x - this.connector_x);
                svgEntry.y2 = (svgEntry.to.connector_y - this.connector_y);
            }
            svgEntry.svg!.style.transform = `translate3d(${this.connector_x}px, ${this.connector_y}px, 0)`;
            this.renderLinePosition(svgEntry);
        }
    }

    /* Called when a user clicks on the output connector */
    customCursorDown(_: customCursorDownProp) {

        console.debug(`ConnectorComponent mousedown event triggered on ${this.gid}!`);

        // Insert the temporary line into the svgLines array at index 0
        this.svgLines.unshift({
            svg: null,
            to: null,
            from: this,
            connector_x: this.connector_x,
            connector_y: this.connector_y,
            x2: 0,
            y2: 0,
            connector: this,
            requestDelete: false
        });
        this.g.targetObject = this;

        this.refreshAllLinePositions();
        //this.renderAllLines(this.svgLines, [], [this.svgLines[0]]);

    }

    /* Called when the user drags the lines extending from the output connector */
    onDrag() {

        let distance = 9999;
        let connector_x = 0;
        let connector_y = 0;
        const hn: HTMLElement | null = <HTMLElement>this.g.hoverDOM;

        // If the node has a class of "sl-input-connector", then it is an input connector
        if (hn && hn.classList.contains('sl-input-connector')) {
            const gid = hn.getAttribute('sl-gid');
            if (!gid) return;
            console.debug("Hovering over input connector: ", gid);
            const input = <InputConnector>this.g.globalNodeTable[gid];
            input.updateConnectorPosition();    /* Update the position of the input connector to the latest position. Not needed? */
            connector_x = input.connector_x;
            connector_y = input.connector_y;
            distance = Math.sqrt(Math.pow(this.connector_x + this.g.dx / this.g.zoom - connector_x, 2) + Math.pow(this.connector_y + this.g.dy / this.g.zoom - connector_y, 2));

            /* Handle snapping to the input connector */
            if (distance < 40) {
                this.setLineXYPosition(this.svgLines[0], (connector_x - this.connector_x), (connector_y - this.connector_y));
            } else {
                this.setLineXYPosition(this.svgLines[0], this.g.dx / this.g.zoom, this.g.dy / this.g.zoom);
            }
        } else {
            this.setLineXYPosition(this.svgLines[0], this.g.dx / this.g.zoom, this.g.dy / this.g.zoom);
        }

        console.debug(`Distance: ${distance}`);
        // this.renderAllLines(this.svgLines, [], [], [this.svgLines[0]]);
    }


    nodeDrag() {
        this.refreshAllLinePositions();
        // return this.renderAllLines(this.svgLines, [], [], this.svgLines);
    }

    /* Called when the user releases the mouse button */
    domCursorUp(): void {
        console.debug(`connector domMouseUp`);
        const hn: HTMLElement | null = <HTMLElement>this.g.hoverDOM;
        if (hn && hn.classList.contains('sl-input-connector')) {
            const gid = hn.getAttribute('sl-gid');
            console.debug("Connected to input connector: ", gid);
            if (!gid) {
                console.error(`Error: gid is null`);
                return;
            }
            const input = <InputConnector>this.g.globalNodeTable[gid];
            this.connectToInput(input);

            input.prop[input.name] = this.prop[this.name];  /* Logically connect the input to the output */
            input.updateFunction();                         /* Update the input */

            this.setLineXYPosition(this.svgLines[0], (input.connector_x - this.connector_x), (input.connector_y - this.connector_y));
            // this.renderAllLines(this.svgLines, [], [], [this.svgLines[0]]);
        } else {
            let delLine = this.deleteLine(0);
            if (delLine) {
                // this.renderAllLines(this.svgLines, [delLine]);
                delLine.requestDelete = true;
            }
        }
    }

    getValue() {
        this.parent.exec();
        return this.val;
    }

    destroy() {

        for (const input of this.peerInputs) {
            this.disconnectFromInput(input);
        }
        //let deletedLines = this.deleteAllLines();
        //this.renderAllLines(this.svgLines, deletedLines);

    }
}

export {
    ConnectorComponent,
    InputConnector,
    OutputConnector
}
