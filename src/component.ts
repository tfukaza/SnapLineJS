import {ComponentBase} from './base';
import { ComponentConfig, GlobalStats, lineObject } from './types';
import { NodeUI } from "./node"
import { addLabel } from './helper';

class ConnectorComponent extends ComponentBase{

    connector_x: number;
    connector_y: number;
    c_total_offset_x: number;
    c_total_offset_y:number;

    name: string;

    parentContent: HTMLElement;
    connector: HTMLElement | null;

    constructor(config: ComponentConfig, parent: NodeUI, globals:GlobalStats, parentContent: HTMLElement) {
        super(config, parent, globals);

        this.connector_x = 0;
        this.connector_y = 0;

        this.c_total_offset_x = 0;
        this.c_total_offset_y = 0;

        this.dom = null;
        this.parentContent = parentContent;
        
        this.connector = null;

        if (config.name) {
            this.name = config.name;
        } else {
            globals.gid++;
            this.name = globals.gid.toString();
        }

        this.parent!.elements[this.name] = this;
        this.g.globalNodes[this.gid] = this;

    }

    pxToInt(px: string): number {
        return parseInt(px.substring(0, px.length - 2));
    }

    updateDOMproperties() {


        const container_offset_x = this.parent!.nodeContainerOffsetLeft;
        const container_offset_y = this.parent!.nodeContainerOffsetTop;

        const content_offset_x = 0;this.pxToInt(window.getComputedStyle(this.parentContent).marginLeft) 
            + this.pxToInt(window.getComputedStyle(this.parentContent).paddingLeft)
            + this.pxToInt(window.getComputedStyle(this.parentContent).borderLeftWidth)
            + this.parentContent.offsetLeft;
        const content_offset_y = this.parentContent.offsetTop;
       
        const connector_offset_x = this.pxToInt(window.getComputedStyle(<Element>this.connector).marginLeft) 
            + this.pxToInt(window.getComputedStyle(<Element>this.connector).paddingLeft)
            + this.pxToInt(window.getComputedStyle(<Element>this.connector).borderLeftWidth)
            + this.connector!.offsetLeft
        const connector_offset_y = this.pxToInt(window.getComputedStyle(<Element>this.connector).marginTop) 
            + this.pxToInt(window.getComputedStyle(<Element>this.connector).paddingTop)
            + this.pxToInt(window.getComputedStyle(<Element>this.connector).borderTopWidth)
            + this.connector!.offsetTop;
        console.debug(`connector_offset_x: ${connector_offset_x} connector_offset_y: ${connector_offset_y}`);
        const connectorWidth = this.connector!.getBoundingClientRect().width;
        const connectorHeight = this.connector!.getBoundingClientRect().height;
        this.c_total_offset_x = container_offset_x + content_offset_x + connector_offset_x + connectorWidth/2;
        this.c_total_offset_y = container_offset_y + content_offset_y + connector_offset_y + connectorHeight/2;
       
    }

    setLineXY(line:SVGSVGElement | SVGLineElement, x:number, y:number) {
        line.setAttribute('x1', ''+0);
        line.setAttribute('y1', ''+0);
        line.setAttribute('x2', ''+x);
        line.setAttribute('y2', ''+y);
        line.setAttribute('stroke-width', `${4 * this.g.zoom}`);
    }
}

class InputComponent extends ConnectorComponent {

    inputDOM: HTMLElement | null;       // Reference to the UI element where the user enters the value
    inputValue: Function;               // Function to get the value from inputDOM
    peerOutput: OutputComponent | null;

    constructor(config: ComponentConfig, parent: NodeUI, globals: GlobalStats, content: HTMLElement){

        super(config, parent, globals, content);

        this.inputDOM = null; 
        this.peerOutput = null;

        const input = document.createElement('div');
        input.classList.add('sl-input');
        const connector = document.createElement('span');
        connector.classList.add('sl-input-connector');
        connector.id = `input-${this.gid}`;
        connector.onmousedown = this.domMouseDown.bind(this);
        input.appendChild(connector);

        this.inputValue = () => {};
        switch (config.type) {
            case 'input-text':{
                addLabel(input, config);
                const inp = document.createElement('input');
                inp.classList.add('sl-input-text');
                inp.type = 'text';
                input.appendChild(inp);
                this.inputDOM = inp;
                inp.onkeyup = () => {
                    this.parent?.findLeaf();
                }
                this.inputValue = () => {return (<HTMLInputElement>this.inputDOM!).value}
            }
                break; 
            case 'input-bool':{
                addLabel(input, config);
                const inp = document.createElement('input');
                inp.classList.add('sl-input-bool');
                inp.type = 'checkbox';
                input.appendChild(inp);
                this.inputDOM = inp;
                inp.onchange = () => {
                    this.parent?.findLeaf();
                }
                this.inputValue = () => {return (<HTMLInputElement>this.inputDOM!).checked}
            }
                break;
            }
           
            
        this.connector = connector;
        this.dom = input;
    }
    
    domMouseDown(e:MouseEvent): void {
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
        this.dom?.classList.remove("connected");
    }
    
    connectToOutput(output: OutputComponent) {
        this.peerOutput = output;
        this.dom?.classList.add("connected");
    }
    
    nodeDrag() {
        this.updateConnectorPosition();
        if (!this.peerOutput) {
            return;
        }
        this.peerOutput.nodeDrag();
    }

    getValue() {
        if (this.peerOutput) {
            return this.peerOutput.getValue();
        } else if (this.inputDOM){
            return this.inputValue();
        }
        return null;
    }

}


class OutputComponent extends ConnectorComponent {

    val: any;
    svgTmp: {
        svg: SVGSVGElement | SVGLineElement | null;
        line: SVGSVGElement | SVGLineElement | null;
    }
    svgs: Array<lineObject>;

    constructor(config: ComponentConfig, parent: NodeUI, globals:GlobalStats, content: HTMLElement) {
        super(config, parent, globals, content);
        
        this.val = null;
        this.svgTmp = {
            svg: null,
            line: null,
        };
        this.svgs = [];
        
        const output = document.createElement('div');
        output.classList.add('sl-output');

        addLabel(output, config);
        
        const connector = document.createElement('span');
        connector.classList.add('sl-output-connector');
        connector.id = `output-${this.gid}`;
        connector.onmousedown = this.domMouseDown.bind(this);
        output.appendChild(connector);
        
        this.connector = connector;
        this.dom = output;
    }
    
    connectToInput(input: InputComponent) {
        // already connected, do nothing
        console.debug("Connecting to input: ", input); 
        if (this === input.peerOutput) {
            console.debug("Already connected");
            return;
        }
        // If there is something already connected to the input, disconnect it
        if (input.peerOutput){
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
    
    disconnectFromInput(input: InputComponent){
        console.debug("Disconnecting from input: ", input);
        for (const svg of this.svgs){
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
    getValue() {
        this.parent!.exec();
        return this.val;
    }
    
    setValue(val: any) {
        this.val = val;
    }
    
    moveToParent() {
        /* Called when lines need to be updated */
        this.updateConnectorPosition();

        if (this.svgTmp.line){
            this.svgTmp.svg!.style.transform = `translate3d(${this.connector_x}px, ${this.connector_y}px, 0)`;
        }

        if (this.svgs.length<1) {
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
        
        line.setAttribute('stroke-width', `${4 * this.g.zoom}`);
    
        svg.appendChild(line);

        this.updateConnectorPosition();
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
        const hn: HTMLElement | null= <HTMLElement>this.g.hoverDOM;
        if (hn && hn.id && hn.id.startsWith('input-')) {
            const gid = hn.id.split('-')[1];
            const input = <InputComponent>this.g.globalNodes[gid];
            input.updateConnectorPosition();
            connector_x = input.connector_x;
            connector_y = input.connector_y;
            distance = Math.sqrt(Math.pow(this.connector_x+this.g.dx/this.g.zoom - connector_x, 2) + Math.pow(this.connector_y+this.g.dy/this.g.zoom - connector_y, 2));
        }

        if (distance < 40) {
            this.setLineXY(this.svgTmp.line!, (connector_x-this.connector_x), (connector_y-this.connector_y));
        } else {
            this.setLineXY(this.svgTmp.line!, this.g.dx/this.g.zoom, this.g.dy/this.g.zoom);
        }
    }

    nodeDrag() {
        this.moveToParent();
    }
    
    domMouseUp(): void {
        const hn: HTMLElement | null= <HTMLElement>this.g.hoverDOM;
        if (hn && hn.id && hn.id.startsWith('input-')) {
            console.debug("Connecting to input: ", hn.id);
            const input = <InputComponent>this.g.globalNodes[hn.id.split('-')[1]];
            this.connectToInput(input);

            input.parent!.findLeaf();
        } 

        this.g.canvas!.removeChild(<Node>this.svgTmp.svg);
        this.svgTmp = {
            svg: null,
            line: null
        };
    }
}


class uiComponent extends ComponentBase {

    parentContent: HTMLElement;
    getUIvalue: Function;
    setUIvalue: Function;
    
    name: string;

    constructor(config: ComponentConfig, parent: NodeUI, globals:GlobalStats, content: HTMLElement) {

        super(config, parent, globals);

        this.parentContent = content;
        this.name = config.name;
        this.getUIvalue = () => { return null };
        this.setUIvalue = (v: any) => { console.debug(v); };

        const cont = document.createElement('div');
        cont.classList.add('sl-ui');
    
        const uiType = config.type;
        switch (uiType) {
            case 'ui-paragraph':
                const ui = document.createElement('p');
                ui.style.pointerEvents = 'none';
                ui.innerText = config.text;
                cont.appendChild(ui);
                break;
            case 'ui-display':
                const display = document.createElement('p');
                display.style.pointerEvents = 'none';
                display.innerText = "Output";
                cont.appendChild(display);
                this.setSetFunction((v: any) => { display.innerText = v})
                break;
            case 'ui-dropdown':
                const dropdown = document.createElement('select');
                dropdown.classList.add('sl-ui-dropdown');
                for (const option of config.values) {
                    const opt = document.createElement('option');
                    opt.innerText = option.label;
                    opt.value = option.value;
                    dropdown.appendChild(opt);
                }
                cont.appendChild(dropdown);
                this.setGetFunction(() => { return dropdown.value });
                this.setExecTrigger(dropdown, 'change');
                break;
        }
        this.dom = cont;
        if (this.name) {
            this.parent!.elements[this.name] = this;
        }
    }

    setExecTrigger(dom: HTMLElement, event: string){
        dom.addEventListener(event, () => {
            this.parent?.findLeaf();
        });
        console.debug(dom, event);
    }

    setGetFunction(f: Function) {
        this.getUIvalue = f;
    }

    setSetFunction(f: Function) {
        this.setUIvalue = f;
    }

    getValue() {
        return this.getUIvalue();
    }

    setValue(val: any) {
        return this.setUIvalue(val);
    }
}

class customComponent extends ComponentBase {

    parentContent: HTMLElement;
    getUIvalue: Function;
    setUIvalue: Function;

    constructor(config: ComponentConfig, parent: NodeUI, globals:GlobalStats, content: HTMLElement) {

        super(config, parent, globals);

        this.parentContent = content;

        this.getUIvalue = () => { return null };
        this.setUIvalue = (v:any) => { console.debug(v) };

        const template = document.createElement('template');
        template.innerHTML = config.html.trim();
        this.dom = <HTMLElement>template.content.firstChild
    }

    setExecTrigger(dom: HTMLElement, event:string){
        console.debug(dom, event);
    }

    setGetFunction(f: Function) {
        this.getUIvalue = f;
    }

    setSetFunction(f: Function) {
        this.setUIvalue = f;
    }

    getValue() {
        return this.getUIvalue();
    }

    setValue(val:any) {
        return this.setUIvalue(val);
    }
}


export {
    ConnectorComponent,
    uiComponent,
    customComponent,
    InputComponent,
    OutputComponent
}
