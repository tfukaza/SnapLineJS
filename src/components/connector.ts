
import { NodeUI } from "../node";
import { ComponentConfig, GlobalStats, lineObject } from "../types";
import { ComponentBase } from "./base";
import { InputInterface } from "./component";


class ConnectorComponent extends ComponentBase {

    connector_x: number;        // Location of the connector on canvas
    connector_y: number;
    c_total_offset_x: number;   // Location of the connector relative to the location of parent Node
    c_total_offset_y: number;

    name: string;

    constructor(config: ComponentConfig, parent: NodeUI, globals: GlobalStats) {
        super(config, parent, globals);

        this.connector_x = 0;
        this.connector_y = 0;

        this.c_total_offset_x = 0;
        this.c_total_offset_y = 0;

        this.dom = null;
        //this.parentContent = parentContent;


        if (config.name) {
            this.name = config.name;
        } else {
            globals.gid++;
            this.name = globals.gid.toString();
        }
        this.g.globalNodes[this.gid] = this;

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
        let p1 = this.parent!.dom.getBoundingClientRect();
        this.c_total_offset_x = (p.left - p1.left) / this.g.zoom + p.width / 2 / this.g.zoom;
        this.c_total_offset_y = (p.top - p1.top) / this.g.zoom + p.height / 2 / this.g.zoom;


    }

    setLineXY(line: SVGSVGElement | SVGLineElement, x: number, y: number) {
        line.setAttribute('x1', '' + 0);
        line.setAttribute('y1', '' + 0);
        line.setAttribute('x2', '' + x);
        line.setAttribute('y2', '' + y);
        line.setAttribute('stroke-width', '4');
    }
}


class InputConnector extends ConnectorComponent {

    inputDOM: HTMLElement | null;       // Reference to the UI element where the user enters the value
    inter: InputInterface;
    peerOutput: OutputConnector | null;

    constructor(config: ComponentConfig, parent: NodeUI, globals: GlobalStats, inter: InputInterface) {

        super(config, parent, globals);

        this.inter = inter;

        this.inputDOM = null;
        this.peerOutput = null;

        const connector = document.createElement('span');
        connector.classList.add('sl-input-connector');
        connector.id = `input-${this.gid}`;
        connector.onmousedown = this.domMouseDown.bind(this);

        this.dom = connector;
    }

    domMouseDown(e: MouseEvent): void {
        if (this.peerOutput) {
            super.domMouseDown(e);
            // Hand over control to the peer output
            this.g.targetNode = this.peerOutput;

            this.g.dx_offset = (this.connector_x - this.peerOutput.connector_x) * this.g.zoom;
            this.g.dy_offset = (this.connector_y - this.peerOutput.connector_y) * this.g.zoom;
            this.g.dx = this.g.dx_offset;
            this.g.dy = this.g.dy_offset;
            this.peerOutput.customMouseDown(e);
            this.peerOutput.disconnectFromInput(this);
            e.stopPropagation();
        }
    }

    updateConnectorPosition() {
        this.connector_x = this.parent!.position_x + this.c_total_offset_x;
        this.connector_y = this.parent!.position_y + this.c_total_offset_y;
    }

    disconnectFromOutput() {
        this.peerOutput = null;
        this.inter.dom!.classList.remove("connected");
        this.inter.inputUI?.inputDOM?.setAttribute('disabled', 'false');
    }

    connectToOutput(output: OutputConnector) {
        this.peerOutput = output;
        this.inter.dom?.classList.add("connected");
        this.inter.inputUI?.inputDOM?.setAttribute('disabled', 'true');
    }

    nodeDrag() {
        this.updateConnectorPosition();
        if (!this.peerOutput) {
            return;
        }
        this.peerOutput.nodeDrag();
    }

    // getValue() {
    //     if (this.peerOutput) {
    //         return this.peerOutput.getValue();
    //     } else if (this.inputDOM){
    //         return this.inputValue();
    //     }
    //     return null;
    // }

}


class OutputConnector extends ConnectorComponent {

    val: any;
    svgTmp: {
        svg: SVGSVGElement | SVGLineElement | null;
        line: SVGSVGElement | SVGLineElement | null;
    }
    svgs: Array<lineObject>;

    constructor(config: ComponentConfig, parent: NodeUI, globals: GlobalStats) {
        super(config, parent, globals);

        this.val = null;
        this.svgTmp = {
            svg: null,
            line: null,
        };
        this.svgs = [];

        const connector = document.createElement('span');
        connector.classList.add('sl-output-connector');
        connector.id = `output-${this.gid}`;
        connector.onmousedown = this.domMouseDown.bind(this);

        this.dom = connector;
    }

    connectToInput(input: InputConnector) {
        // already connected, do nothing
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

        const s = this.createNewSVG();
        const svg = s[0];
        const line = s[1];

        const newSVG = {
            svg: svg,
            line: line,
            to: input,
            from: this,
            connector_x: this.connector_x,
            connector_y: this.connector_y,
            x2: 0,
            y2: 0,
            connector: this
        };

        this.svgs.push(newSVG);
        this.g.globalLines.push(newSVG);
        this.g.canvas!.appendChild(svg);
        this.setLineXY(line, input.connector_x - this.connector_x, input.connector_y - this.connector_y);

        this.parent!.outputCount++;
        input.parent!.inputCount++;

    }

    disconnectFromInput(input: InputConnector) {
        console.debug("Disconnecting from input: ", input);
        for (const svg of this.svgs) {
            if (svg.to == input) {
                this.g.canvas!.removeChild(svg.svg);
                this.svgs = this.svgs.filter(s => s != svg);
                this.g.globalLines = this.g.globalLines.filter(s => s != svg);
                console.debug("Deleted line: ", svg);
                break;
            }
        }
        input.disconnectFromOutput();
        this.parent!.outputCount--;
        input.parent!.inputCount--;
    }

    updateConnectorPosition() {
        // Update the position of the output connector
        this.connector_x = this.parent!.position_x + this.c_total_offset_x;
        this.connector_y = this.parent!.position_y + this.c_total_offset_y;
    }

    moveToParent() {
        /* Called when lines need to be updated */
        this.updateConnectorPosition();

        if (this.svgTmp.line) {
            this.svgTmp.svg!.style.transform = `translate3d(${this.connector_x}px, ${this.connector_y}px, 0)`;
        }

        if (this.svgs.length < 1) {
            return;
        }

        for (const svg of this.svgs) {
            svg.svg.style.transform = `translate3d(${this.connector_x}px, ${this.connector_y}px, 0)`;
            svg.connector_x = this.connector_x;
            svg.connector_y = this.connector_y;

            svg.x2 = (svg.to.connector_x - this.connector_x);
            svg.y2 = (svg.to.connector_y - this.connector_y);
            this.setLineXY(svg.line, svg.x2, svg.y2);
        }
    }

    createNewSVG() {
        // create a new svg path
        const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
        svg.classList.add('sl-connector-svg');
        svg.style.pointerEvents = 'none';
        svg.style.position = 'absolute';
        svg.style.overflow = 'visible';
        svg.setAttribute('width', '4');
        svg.setAttribute('height', '4');
        svg.style.willChange = "transform";

        const line = document.createElementNS('http://www.w3.org/2000/svg', 'line');
        line.classList.add('sl-connector-line');

        line.setAttribute('stroke-width', '4');

        svg.appendChild(line);

        this.updateConnectorPosition();
        console.debug("connector x: " + this.connector_x);
        svg.style.transform = `translate3d(${this.connector_x}px, ${this.connector_y}px, 0)`;

        this.g.canvas!.appendChild(svg);

        return [svg, line];
    }

    customMouseDown(_: MouseEvent): void {
        // while dragging, we use a temporary svg to show the line
        const s = this.createNewSVG();
        this.svgTmp.svg = s[0];
        this.svgTmp.line = s[1];
        this.moveToParent();
        this.setLineXY(this.svgTmp.line, this.g.dx, this.g.dy);
    }


    onDrag() {
        // Handle snapping lines to connectors
        let distance = 9999;
        let connector_x = 0;
        let connector_y = 0;
        const hn: HTMLElement | null = <HTMLElement>this.g.hoverDOM;
        if (hn && hn.id && hn.id.startsWith('input-')) {
            const gid = hn.id.split('-')[1];
            const input = <InputConnector>this.g.globalNodes[gid];
            input.updateConnectorPosition();
            connector_x = input.connector_x;
            connector_y = input.connector_y;
            distance = Math.sqrt(Math.pow(this.connector_x + this.g.dx / this.g.zoom - connector_x, 2) + Math.pow(this.connector_y + this.g.dy / this.g.zoom - connector_y, 2));
        }

        if (distance < 40) {
            this.setLineXY(this.svgTmp.line!, (connector_x - this.connector_x), (connector_y - this.connector_y));
        } else {
            this.setLineXY(this.svgTmp.line!, this.g.dx / this.g.zoom, this.g.dy / this.g.zoom);
        }
    }

    nodeDrag() {
        this.moveToParent();
    }

    domMouseUp(): void {
        const hn: HTMLElement | null = <HTMLElement>this.g.hoverDOM;
        if (hn && hn.id && hn.id.startsWith('input-')) {
            console.debug("Connecting to input: ", hn.id);
            const input = <InputConnector>this.g.globalNodes[hn.id.split('-')[1]];
            this.connectToInput(input);

            input.parent!.findLeaf();
        }

        this.g.canvas!.removeChild(<Node>this.svgTmp.svg);
        this.svgTmp = {
            svg: null,
            line: null
        };
    }

    getValue() {
        this.parent!.exec();
        return this.val;
    }
}

export {
    ConnectorComponent,
    InputConnector,
    OutputConnector
}
