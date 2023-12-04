import {isBetween} from './helper';
import {uiComponent, customComponent, InputInterface, OutputInterface} from './components/component';
import {Base, ComponentBase} from './components/base';
import { ComponentConfig, GlobalStats, lineObject, NodeConfig, NodeConfigFunction } from './types';



class NodeUI extends Base {

    config: NodeConfig;

    inputs: Array<InputInterface>;// List of NodeInput classes for each input connector
    outputs: Array<OutputInterface>;// List of NodeOutput classes for each output connector
    inputCount: number;
    outputCount: number;

    elements: { [key: string]: ComponentBase};

    dom: HTMLElement;

    hasIandO: boolean;

    nodeWidth: number;
    nodeHeight: number;
    nodeContainerWidth: number;
    nodeContainerHeight: number;
    nodeContainerOffsetLeft: number;
    nodeContainerOffsetTop: number;

    functions: NodeConfigFunction;

    pan_start_x: number;
    pan_start_y: number;

    overlapping: lineObject | null;

    freeze: boolean;

    constructor(config: NodeConfig, globals: GlobalStats, x=0, y=0) {

        super(globals);

        this.config = config;

        this.position_x = x;// - this.g.cameraWidth / 2;
        this.position_y = y; //- this.g.cameraHeight / 2;

        this.inputs = [];    
        this.outputs = [];   
        this.inputCount = 0;
        this.outputCount = 0;
        
        this.elements = {};

        this.pan_start_x = this.position_x;
        this.pan_start_y = this.position_y;

        this.overlapping = null;

        this.freeze = false;


        const node = document.createElement('div');
        node.classList.add('sl-node');
        node.style.willChange = "transform";
        node.style.position = "absolute";
        node.style.transformOrigin = "top left";
        node.style.position = "absolute";
        const nodeContainer = document.createElement('div');
        nodeContainer.classList.add('sl-node-container');
        nodeContainer.style.position = "relative";
        for (const row of config.elements) {
            const nodeContent = document.createElement('div');
            nodeContent.style.position = "relative";
            nodeContent.style.display = "flex";
            nodeContent.style.flexDirection = "row";
            nodeContent.classList.add('sl-node-content');
            nodeContainer.appendChild(nodeContent);

            if (row instanceof Array) {
                for (const r of row) {
                    const element = this._initParseComponent(r, nodeContent);
                    if (element) nodeContent.appendChild(<Node>element.dom);
                }
            } else {
                const element = this._initParseComponent(row, nodeContent);
                if (element) nodeContent.appendChild(<Node>element.dom);
            }
            nodeContainer.appendChild(nodeContent);
        }

        node.appendChild(nodeContainer);
        node.id = this.gid;
        node.onmousedown = this.domMouseDown.bind(this);
        this.dom = node;
        
        if (this.inputs.length > 0 && this.outputs.length > 0) {
            this.hasIandO = true;
        } else {
            this.hasIandO = false;
        }
        
        this.g.canvas!.appendChild(node);

        this.nodeWidth = node.offsetWidth;
        this.nodeHeight = node.offsetHeight;
        this.nodeContainerWidth = nodeContainer.offsetWidth;
        this.nodeContainerHeight = nodeContainer.offsetHeight;
        this.nodeContainerOffsetLeft = nodeContainer.offsetLeft;
        this.nodeContainerOffsetTop = nodeContainer.offsetTop;

        this.updateDOMproperties();

        this.g.nodeArray.push(this);

        new ResizeObserver(() => {
            this.updateDOMproperties();
        }).observe(this.dom);
    
        this.functions = [];
        if (config.functions) {
            this.functions = config.functions;
            for (const [_, dict] of Object.entries(this.functions)) {
                if (dict.functionInit !== undefined){
                    dict.functionInit(this);
                }
            }
        }
    }

    findInput(id: string): InputInterface | null{
        for (const o of this.inputs){
            if (o.gid === id) return o;
        }
        return null;
    }
    
    findOutput(id: string): OutputInterface | null{
        for (const o of this.outputs){
            if (o.gid === id) return o;
        }
        return null;
    }

    _initParseComponent(ui: ComponentConfig, content: HTMLElement): InputInterface | OutputInterface | uiComponent | customComponent | null{
        let u = null;
        switch (ui.type) {
            case 'input-text':
            case 'input-bool':
            case 'input-float':
            case 'input-float-infinite':
                u = new InputInterface(ui, this, this.g);
                u.parent = this;
                this.g.globalNodes[u.gid] = u;
                this.inputs.push(u);
                break;
            case 'output-text':
                u = new OutputInterface(ui, this, this.g);
                u.parent = this;
                this.g.globalNodes[u.gid] = u;
                this.outputs.push(u);
              
                break;
            case 'ui-display':
            case 'ui-dropdown':
            case 'ui-paragraph':
                u = new uiComponent(ui, this, this.g, content);
                u.parent = this;
                this.g.globalNodes[u.gid] = u;
               
                break;
            case 'custom':
                u = new customComponent(ui, this, this.g, content);
                u.parent = this;
                this.g.globalNodes[u.gid] = u;
              
                break;
            default:
                console.warn("Unknown type " + ui.type);
        }
        return u;
        
    }

    customMouseDown(_: MouseEvent): void {     
        this.pan_start_x = this.position_x;
        this.pan_start_y = this.position_y;
        this.g.focusNode = this;
    }

    domMouseUp() {

        if (this.freeze) return;

        this.position_x = this.pan_start_x+this.g.dx/this.g.zoom
        this.position_y = this.pan_start_y+this.g.dy/this.g.zoom
        
        if (this.overlapping == null) {return;}

        const from = this.overlapping.from;
        const to = this.overlapping.to;
        const firstInput = this.inputs[0];
        const firstOutput = this.outputs[0];
        from.disconnectFromInput(to);
        from.connectToInput(firstInput.input);
        firstOutput.output.connectToInput(to);
    }

    
    // onPan() {
        
    //     this.dom.style.transform = `translate3d(${this.position_x}px, ${this.position_y}px, 0)`;

    //     for (const input of this.inputs) {
    //         input.onPan();
    //     }
    //     for (const output of this.outputs) {
    //         output.onPan();
    //     }
    // }
    
    onDrag() {

        if(this.freeze) return;

        this.position_x = this.pan_start_x+this.g.dx/this.g.zoom
        this.position_y = this.pan_start_y+this.g.dy/this.g.zoom

        // console.debug(`onDrag ${this.position_x} ${this.position_y}`);
        
        this.dom.style.transform = `translate3d(${this.position_x}px, ${this.position_y}px, 0)`;

        for (const input of this.inputs) {
            input.input.nodeDrag();
        }
        for (const output of this.outputs) {
            output.output.nodeDrag();
        }

        this.overlapping = null;
        if (!this.hasIandO) return;
        if (this.outputCount > 0 || this.inputCount > 0) return;


        let avg_height = 9999;
        for (const line of this.g.globalLines) {
            line.line.classList.remove('overlapping');
            if (isBetween(this.position_x + this.nodeWidth/2, line.connector_x, line.connector_x + line.x2) && 
            isBetween(this.position_y + this.nodeHeight/2, line.connector_y, line.connector_y + line.y2)) {
                if ((line.y2 + line.connector_x)/2 < avg_height) {
                    this.overlapping = line;
                    avg_height = (line.y2 + this.position_y)/2;
                }
            }
        }
        if (!this.overlapping) {
            return;
        }
        this.overlapping.line.classList.add('overlapping');
        
    }
    
    onFocus() {
        for (const n of this.g.nodeArray) {
            n.dom.classList.remove('focused');
            n.dom.style.zIndex = "10";
        }
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
        for (const input of this.inputs) {
            input.input.updateDOMproperties();
        }
        for (const output of this.outputs) {
            output.output.updateDOMproperties();
        }
    }

    run(){
        let outputCount = 0;
        for (const [_, fData] of Object.entries(this.functions)) {
            for (const x of fData.outputs) {
                const o = <OutputInterface>this.elements[x];
                if (o == undefined){
                    console.warn(`Output '${x}' was not found in elements. Double check '${x}' is defined.`)
                    return;
                }
                if (!o.output.svgs || o.output.svgs.length < 1) {
                    continue;
                }
                outputCount++;
                for (const line of o.output.svgs){
                    line.to.parent?.run();
                }
            }
        }
        if (outputCount === 0) {
            this.exec();
        }
    }
    
    
    exec() {
        if (!this.functions)
            return;

        for (const [_, fData] of Object.entries(this.functions)) {
            const inputs = [this];
            for (const x of fData.inputs) {
                if (x in this.elements) {
                    const i = <InputInterface>this.elements[x];
                    inputs.push(i.getValue());
                }
            }
            
            const result = fData.functionUpdate(...inputs);
            let i = 0;
            for (const x of fData.outputs) {
                const o = <OutputInterface>this.elements[x];
                if (o == undefined){
                    console.warn(`Output '${x}' was not found in elements. Double check '${x}' is defined.`)
                    return;
                }
                if (result instanceof Array){
                    o.setValue(result[i++])
                } else {
                    o.setValue(result);
                }
            }
        }
    }
}

export {
    NodeUI
}