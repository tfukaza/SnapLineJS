function isBetween(x, a, b) {
    return (x >= a && x <= b) || (x >= b && x <= a);
}
function worldToCamera(x, y, g) {
    const s1 = g.zoom;
    const s2 = g.zoom;
    const t1 = -x * g.zoom + g.cameraWidth / 2;
    const t2 = -y * g.zoom + g.cameraHeight / 2;
    return `${s1},0,0,0,0,${s2},0,0,0,0,1,0,${t1},${t2},0,1`;
}

var mouseDownButton;
(function (mouseDownButton) {
    mouseDownButton["none"] = "none";
    mouseDownButton["left"] = "left";
    mouseDownButton["middle"] = "middle";
    mouseDownButton["right"] = "right";
    mouseDownButton["invalid"] = "invalid";
})(mouseDownButton || (mouseDownButton = {}));
var ObjectTypes;
(function (ObjectTypes) {
    ObjectTypes["node"] = "node";
    ObjectTypes["connector"] = "connector";
    ObjectTypes["line"] = "line";
    ObjectTypes["unspecified"] = "unspecified";
    ObjectTypes["invalid"] = "invalid";
})(ObjectTypes || (ObjectTypes = {}));
var userState;
(function (userState) {
    userState["idle"] = "idle";
    userState["dragging"] = "dragging";
    userState["panning"] = "panning";
    userState["connecting"] = "connecting";
    userState["selecting"] = "selecting";
    userState["invalid"] = "invalid";
})(userState || (userState = {}));
var SnapLineDomType;
(function (SnapLineDomType) {
    SnapLineDomType[SnapLineDomType["canvasContainer"] = 0] = "canvasContainer";
    SnapLineDomType[SnapLineDomType["canvas"] = 1] = "canvas";
    SnapLineDomType[SnapLineDomType["canvasBackground"] = 2] = "canvasBackground";
    SnapLineDomType[SnapLineDomType["selectionBox"] = 3] = "selectionBox";
    SnapLineDomType[SnapLineDomType["invalid"] = 4] = "invalid";
})(SnapLineDomType || (SnapLineDomType = {}));

/**
 * Base class for all classes.
 * It contains attributes and methods that are common to all classes,
 * such as position, id, etc.
*/
class Base {
    g;
    gid;
    position_x;
    position_y;
    type;
    constructor(globals) {
        this.g = globals;
        globals.gid++;
        this.gid = globals.gid.toString();
        this.position_x = 0;
        this.position_y = 0;
        this.type = ObjectTypes.unspecified;
    }
    /**
     * Binds the mousedown event to the given DOM element.
     * This overrides the default mousedown event.
     *
     * @param dom The DOM element to bind the function to
     */
    bindFunction(dom) {
        dom.onmousedown = this.domMouseDown.bind(this);
        dom.ontouchstart = this.domTouchStart.bind(this);
    }
    domMouseDown(e) {
        this.domCursorDown(e.button, e.clientX, e.clientY);
        e.stopPropagation();
    }
    domTouchStart(e) {
        // if (this.g.prevSingleTouchTime == 0) {
        //     this.g.timer = setTimeout(() => {
        //         this.g.timer = null;
        //         this.g.prevSingleTouchTime = 0;
        //         this.domCursorDown(0, e.touches[0].clientX, e.touches[0].clientY);
        //         e.stopPropagation();
        //     }
        //         , 300);
        //     this.g.prevSingleTouchTime = Date.now();
        //     //return;
        // }
        this.domCursorDown(0, e.touches[0].clientX, e.touches[0].clientY);
        e.stopPropagation();
    }
    domCursorDown(button, clientX, clientY) {
        console.debug(`Base class mousedown event triggered on ${this.gid}!`);
        if (button == 0) {
            this.g.currentMouseDown = mouseDownButton.left;
        }
        else if (button == 1) {
            this.g.currentMouseDown = mouseDownButton.middle;
        }
        else if (button == 2) {
            this.g.currentMouseDown = mouseDownButton.right;
        }
        this.g.targetObject = this;
        this.g.mousedown_x = clientX;
        this.g.mousedown_y = clientY;
        this.g.dx = 0;
        this.g.dy = 0;
        this.g.dx_offset = 0;
        this.g.dy_offset = 0;
        this.customCursorDown({ button: button, clientX: clientX, clientY: clientY });
    }
    customCursorDown(_) { }
    domCursorUp() { }
    onFocus() { }
    offFocus() { }
    onDrag() { }
    onPan() { }
    destroy() { }
}

/**
 * Components are the buildings blocks of a node.
 */
class ComponentBase extends Base {
    parent;
    config;
    dom;
    constructor(config, parent, globals) {
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
    name; /* Name of the component */
    dom; /* The DOM element of the component */
    prop; /* Reference to the parent's prop object */
    constructor(dom, config, parent, globals) {
        super(config, parent, globals);
        this.name = config.name;
        this.prop = parent.prop;
        this.dom = dom;
    }
    bindFunction(_) {
    }
    addInputUpdateListener(event, func) {
        this.dom.addEventListener(event, func.bind(this));
    }
}

/**
 * Connector components are the elements that are used to connect nodes.
 */
class ConnectorComponent extends ComponentBase {
    name; /* Name of the component */
    connector_x; /* Location of the connector on canvas */
    connector_y;
    c_total_offset_x; /* Location of the connector relative to the location of parent Node */
    c_total_offset_y;
    prop; /* Reference to the parent's prop object */
    // tmpSvgDom: SVGSVGElement | null;
    // tmpSvgData: lineObject | null;
    svgLines;
    type = ObjectTypes.connector;
    constructor(dom, config, parent, globals) {
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
        }
        else {
            globals.gid++;
            this.name = globals.gid.toString();
        }
        this.g.globalNodeTable[this.gid] = this;
        this.bindFunction(this.dom);
        this.dom.setAttribute('sl-gid', this.gid.toString());
        // this.tmpSvgDom = null;
        // this.tmpSvgData = null;
        this.svgLines = [];
    }
    pxToInt(px) {
        return parseInt(px.substring(0, px.length - 2));
    }
    getComputed(element, prop) {
        const s = window.getComputedStyle(element, null).getPropertyValue(prop);
        if (s.endsWith('px'))
            return this.pxToInt(s);
        else
            return parseInt(s);
    }
    updateDOMproperties() {
        let parentDOM = this.dom;
        let p = parentDOM.getBoundingClientRect();
        let p1 = this.parent.dom.getBoundingClientRect();
        this.c_total_offset_x = (p.left - p1.left) / this.g.zoom + p.width / 2 / this.g.zoom;
        this.c_total_offset_y = (p.top - p1.top) / this.g.zoom + p.height / 2 / this.g.zoom;
    }
    /* SVG line functions */
    createLineDOM(x, y) {
        const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
        const line = document.createElementNS('http://www.w3.org/2000/svg', 'line');
        svg.appendChild(line);
        this.g.canvas.appendChild(svg);
        this.setLineAttr(svg, line, x, y);
        return svg;
    }
    setLineAttr(svg, line, x, y) {
        svg.classList.add('sl-connector-svg');
        // svg.setAttribute('output-gid', this.g.gid.toString());
        // this.setTmpSvgLineStyle({
        //     position: 'absolute',
        //     overflow: 'visible',
        //     pointerEvents: 'none',
        //     willChange: 'transform',
        //     transform: `translate3d(${x}px, ${y}px, 0)`,
        // });
        // svg.setAttribute('width', '4');
        // svg.setAttribute('height', '4');
        line.classList.add('sl-connector-line');
        line.setAttribute('stroke-width', '4');
    }
    setStyle(dom, style) {
        for (const key in style) {
            dom.style[key] = style[key];
        }
    }
    renderLinePosition(entry) {
        let svg = entry.svg;
        this.setStyle(svg, {
            position: 'absolute',
            overflow: 'visible',
            pointerEvents: 'none',
            willChange: 'transform',
            transform: `translate3d(${entry.connector_x}px, ${entry.connector_y}px, 0)`,
        });
        let line = svg.children[0];
        line.setAttribute('x1', '' + 0);
        line.setAttribute('y1', '' + 0);
        line.setAttribute('x2', '' + entry.x2);
        line.setAttribute('y2', '' + entry.y2);
    }
    // setTmpSvgLineStyle(style: any) {
    //     for (const key in style) {
    //         this.tmpSvgDom!.style[<any>key] = style[key];
    //     }
    // }
    /* Deletes the line from the svgLines array */
    deleteLine(i) {
        // if (this.svgLines.length > 0) {
        //     const svg = this.svgLines[i];
        //     this.svgLines.splice(i, 1);
        //     return svg;
        // }
        // return undefined;
        if (this.svgLines.length > 0) {
            const svg = this.svgLines[i];
            svg.requestDelete = true;
        }
        return undefined;
    }
    deleteAllLines() {
        // let tmpLines = [...this.svgLines];
        // this.svgLines = [];
        // return tmpLines;
        for (const svg of this.svgLines) {
            svg.requestDelete = true;
        }
    }
}
class InputConnector extends ConnectorComponent {
    //inputDOM: HTMLElement | null;       // Reference to the UI element where the user enters the value
    // inter: InputInterface;
    peerOutput;
    updateFunction = () => {
        console.debug("Update function not set for input connector");
    };
    constructor(dom, config, parent, globals) {
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
    renderAllLines(svgLines, deletedLines = [], newLines = [], updatedLines = []) {
        this.peerOutput?.renderAllLines(svgLines, deletedLines, newLines, updatedLines);
    }
    domTouchStart(e) {
        this.domCursorDown(0, e.touches[0].clientX, e.touches[0].clientY);
        e.stopPropagation();
    }
    domMouseDown(e) {
        this.domCursorDown(e.button, e.clientX, e.clientY);
        e.stopPropagation();
    }
    domCursorDown(button, clientX, clientY) {
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
    connectToOutput(output) {
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
    destroy() {
        if (this.peerOutput) {
            this.peerOutput.disconnectFromInput(this);
        }
    }
}
class OutputConnector extends ConnectorComponent {
    val;
    peerInputs = [];
    constructor(dom, config, parent, globals) {
        super(dom, config, parent, globals);
        this.val = null;
        this.svgLines = [];
        this.dom = dom;
        this.renderAllLines = this.renderAllLines.bind(this);
    }
    connectToInput(input) {
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
    disconnectFromInput(input) {
        console.debug("Disconnecting from input: ", input);
        for (const svg of this.svgLines) {
            if (svg.to == input) {
                this.g.canvas.removeChild(svg.svg);
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
    setLineXYPosition(entry, x, y) {
        entry.x2 = x;
        entry.y2 = y;
    }
    refreshLinePosition(entry) {
        entry.connector_x = this.connector_x;
        entry.connector_y = this.connector_y;
        if (!entry.to) {
            entry.x2 = 0;
            entry.y2 = 0;
        }
        else {
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
    renderAllLines(svgLines, deletedLines = [], newLines = [], updatedLines = []) {
        for (const svg of newLines) {
            let svgDom = this.createLineDOM(svg.connector_x, svg.connector_y);
            svg.svg = svgDom;
            this.renderLinePosition(svg);
        }
        for (const svg of deletedLines) {
            this.g.canvas.removeChild(svg.svg);
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
                let svgDom = this.createLineDOM(svgEntry.connector_x, svgEntry.connector_y);
                svgEntry.svg = svgDom;
            }
            else if (svgEntry.requestDelete) {
                this.g.canvas.removeChild(svgEntry.svg);
                continue;
            }
            svgEntry.connector_x = this.connector_x;
            svgEntry.connector_y = this.connector_y;
            if (svgEntry.to) {
                svgEntry.x2 = (svgEntry.to.connector_x - this.connector_x);
                svgEntry.y2 = (svgEntry.to.connector_y - this.connector_y);
            }
            svgEntry.svg.style.transform = `translate3d(${this.connector_x}px, ${this.connector_y}px, 0)`;
            this.renderLinePosition(svgEntry);
        }
    }
    /* Called when a user clicks on the output connector */
    customCursorDown(_) {
        console.debug(`ConnectorComponent mousedown event triggered on ${this.gid}!`);
        let tmpData = {
            svg: null,
            to: null,
            from: this,
            connector_x: this.connector_x,
            connector_y: this.connector_y,
            x2: 0,
            y2: 0,
            connector: this,
            requestDelete: false
        };
        // Insert the temporary line into the svgLines array at index 0
        this.svgLines.unshift(tmpData);
        this.g.targetObject = this;
        this.refreshAllLinePositions();
        //this.renderAllLines(this.svgLines, [], [this.svgLines[0]]);
    }
    /* Called when the user drags the lines extending from the output connector */
    onDrag() {
        let distance = 9999;
        let connector_x = 0;
        let connector_y = 0;
        const hn = this.g.hoverDOM;
        // If the node has a class of "sl-input-connector", then it is an input connector
        if (hn && hn.classList.contains('sl-input-connector')) {
            const gid = hn.getAttribute('sl-gid');
            if (!gid)
                return;
            console.debug("Hovering over input connector: ", gid);
            const input = this.g.globalNodeTable[gid];
            input.updateConnectorPosition(); /* Update the position of the input connector to the latest position. Not needed? */
            connector_x = input.connector_x;
            connector_y = input.connector_y;
            distance = Math.sqrt(Math.pow(this.connector_x + this.g.dx / this.g.zoom - connector_x, 2) + Math.pow(this.connector_y + this.g.dy / this.g.zoom - connector_y, 2));
            /* Handle snapping to the input connector */
            if (distance < 40) {
                this.setLineXYPosition(this.svgLines[0], (connector_x - this.connector_x), (connector_y - this.connector_y));
            }
            else {
                this.setLineXYPosition(this.svgLines[0], this.g.dx / this.g.zoom, this.g.dy / this.g.zoom);
            }
        }
        else {
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
    domCursorUp() {
        console.debug(`connector domMouseUp`);
        const hn = this.g.hoverDOM;
        if (hn && hn.classList.contains('sl-input-connector')) {
            const gid = hn.getAttribute('sl-gid');
            console.debug("Connected to input connector: ", gid);
            if (!gid) {
                console.error(`Error: gid is null`);
                return;
            }
            const input = this.g.globalNodeTable[gid];
            this.connectToInput(input);
            input.prop[input.name] = this.prop[this.name]; /* Logically connect the input to the output */
            input.updateFunction(); /* Update the input */
            this.setLineXYPosition(this.svgLines[0], (input.connector_x - this.connector_x), (input.connector_y - this.connector_y));
            // this.renderAllLines(this.svgLines, [], [], [this.svgLines[0]]);
        }
        else {
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

class NodeComponent extends Base {
    inputConnectors; // Dictionary of InputConnector classes for each input connector
    outputConnectors; // Dictionary of OutputConnector classes for each output connector
    outputCount;
    components; // List iof all components in the node, except for connectors
    dom; // The DOM element of the node 
    nodeWidth = 0;
    nodeHeight = 0;
    panStartX;
    panStartY;
    overlapping;
    freeze;
    type;
    prop;
    outputProp;
    nodeType;
    nodeStyle;
    constructor(dom, globals) {
        super(globals);
        this.dom = null;
        this.inputConnectors = {};
        this.outputConnectors = {};
        this.outputCount = 0;
        this.components = {};
        this.panStartX = this.position_x;
        this.panStartY = this.position_y;
        this.overlapping = null;
        this.freeze = false;
        this.type = ObjectTypes.node;
        if (dom) {
            this.dom = dom;
            this.dom.id = this.gid;
            this.setNodeStyle({
                willChange: "transform",
                position: "absolute",
                transformOrigin: "top left"
            });
            this.renderNode(this.nodeStyle);
            this.bindFunction(this.dom);
            new ResizeObserver(() => {
                this.updateDOMproperties();
            }).observe(this.dom);
        }
        this.g.globalNodeList.push(this);
        this.prop = {};
        this.outputProp = {};
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
        this.nodeType = "";
        this.initNode = this.initNode.bind(this);
        this.addInputConnector = this.addInputConnector.bind(this);
        this.addOutputConnector = this.addOutputConnector.bind(this);
        this.addInputForm = this.addInputForm.bind(this);
        this.setNodeStyle({
            willChange: "transform",
            position: "absolute",
            transformOrigin: "top left"
        });
    }
    initNode(dom) {
        this.dom = dom;
        this.dom.id = this.gid;
        this.renderNode(this.nodeStyle);
        this.bindFunction(this.dom);
        new ResizeObserver(() => {
            this.updateDOMproperties();
        }).observe(this.dom);
    }
    setNodeStyle(style) {
        this.nodeStyle = Object.assign({}, this.nodeStyle, style);
    }
    renderNode(style) {
        for (const key in style) {
            this.dom.style[key] = style[key];
        }
        for (const output of Object.values(this.outputConnectors)) {
            output.renderAllLines(output.svgLines);
        }
    }
    addNodeToCanvas(x, y) {
        this.position_x = x;
        this.position_y = y;
        this.nodeWidth = this.dom.offsetWidth;
        this.nodeHeight = this.dom.offsetHeight;
        this.dom.style.transform = `translate3d(${this.position_x}px, ${this.position_y}px, 0)`;
        this.updateDOMproperties();
        this.g.canvas.appendChild(this.dom);
    }
    addOutputConnector(dom, name) {
        const output = new OutputConnector(dom, { name: name }, this, this.g);
        this.outputConnectors[name] = output;
        this.prop[name] = null;
        this.outputProp[name] = null;
        return output;
    }
    addInputConnector(dom, name) {
        const input = new InputConnector(dom, { name: name }, this, this.g);
        this.inputConnectors[name] = input;
        this.prop[name] = null;
        return input;
    }
    addInputForm(dom, name) {
        const input = new InputForm(dom, { name: name }, this, this.g);
        this.prop[name] = null;
        return input;
    }
    findInput(id) {
        for (const input of Object.values(this.inputConnectors)) {
            if (input.name == id) {
                return input;
            }
        }
        return null;
    }
    findOutput(id) {
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
    customCursorDown(_) {
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
        }
        else {
            /* Otherwise, we are dragging multiple nodes.
             * Call the setStartPositions function for all nodes in focusNodes */
            for (let i = 0; i < this.g.focusNodes.length; i++) {
                this.g.focusNodes[i].setStartPositions();
            }
        }
        this.setStartPositions();
    }
    domCursorUp() {
        if (this.freeze)
            return;
        this.position_x = this.panStartX + this.g.dx / this.g.zoom;
        this.position_y = this.panStartY + this.g.dy / this.g.zoom;
        /* If the mouse has not moved since being pressed, then it is a regular click
            unselect other nodes in focusNodes */
        console.debug("Mouse has moved: " + this.g.mouseHasMoved);
        if (!this.g.mouseHasMoved && this.g.targetObject && this.g.targetObject.gid == this.gid) {
            console.debug("Mouse has not moved");
            for (let i = 0; i < this.g.focusNodes.length; i++) {
                this.g.focusNodes[i].offFocus();
            }
            this.g.focusNodes = [this];
            this.onFocus();
            return;
        }
        if (this.overlapping == null) {
            return;
        }
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
        if (this.freeze)
            return;
        this.position_x = this.panStartX + this.g.dx / this.g.zoom;
        this.position_y = this.panStartY + this.g.dy / this.g.zoom;
        this.setNodeStyle({
            transform: `translate3d(${this.position_x}px, ${this.position_y}px, 0)`
        });
        // this.renderNode(this.nodeStyle);
        for (const input of Object.values(this.inputConnectors)) {
            input.nodeDrag();
        }
        for (const output of Object.values(this.outputConnectors)) {
            output.nodeDrag();
        }
        this.overlapping = null;
        if (Object.keys(this.inputConnectors).length == 0 && Object.keys(this.outputConnectors).length == 0)
            return;
        let avg_height = 9999;
        for (const line of this.g.globalLines) {
            //line.line.classList.remove('overlapping');
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
        //this.overlapping.line.classList.add('overlapping');
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
    evaluate(varName) {
        console.debug("Update all nodes connected to " + varName);
        const output = this.outputConnectors[varName];
        if (!output)
            return;
        for (const input of output.peerInputs) {
            console.debug(`Update input ${input.name} connected to ${varName} with value ${this.prop[varName]}`);
            input.prop[input.name] = this.prop[varName];
            input.updateFunction();
        }
    }
    exec() {
    }
    destroy() {
        this.g.canvas?.removeChild(this.dom);
        for (const input of Object.values(this.inputConnectors)) {
            input.destroy();
        }
        for (const output of Object.values(this.outputConnectors)) {
            output.destroy();
        }
    }
}

class SnapLine {
    g;
    canvasContainerStyle = {};
    canvasStyle = {};
    canvasSelectionBoxStyle = {};
    canvasBackgroundStyle = {};
    constructor() {
        this.g = null;
        this.canvasContainerStyle = {
            position: 'relative',
            overflow: 'hidden',
        };
        this.canvasSelectionBoxStyle = {
            position: 'absolute',
            pointerEvents: "none",
        };
        /* Public methods */
        this.initSnapLine = this.initSnapLine.bind(this);
    }
    initSnapLine(containerDom, canvasDom, backgroundDom, selectionBoxDom) {
        this.g = {
            canvas: canvasDom,
            canvasContainer: containerDom,
            canvasBackground: backgroundDom,
            selectionBox: selectionBoxDom,
            currentMouseDown: mouseDownButton.none,
            mousedown_x: 0,
            mousedown_y: 0,
            mouse_x: 0,
            mouse_y: 0,
            mouse_x_world: 0,
            mouse_y_world: 0,
            camera_pan_start_x: 0,
            camera_pan_start_y: 0,
            dx: 0,
            dy: 0,
            dx_offset: 0,
            dy_offset: 0,
            overrideDrag: false,
            camera_x: 0,
            camera_y: 0,
            zoom: 1,
            cameraWidth: 0,
            cameraHeight: 0,
            targetObject: null,
            focusNodes: [],
            hoverDOM: null,
            gid: 0,
            globalLines: [],
            globalNodeList: [],
            globalNodeTable: {},
            mouseHasMoved: false,
            ignoreMouseUp: false,
            prevTouches: null,
            prevSingleTouchTime: 0,
            snapline: this,
        };
        const g = this.g;
        g.cameraWidth = g.canvasContainer.clientWidth;
        g.cameraHeight = g.canvasContainer.clientHeight;
        console.debug(`Canvas size: ${g.cameraWidth}x${g.cameraHeight}`);
        this.setCanvasElementStyle(this.canvasStyle, {
            position: 'relative',
            top: '0px',
            left: '0px',
            transform: `translate(${g.cameraWidth / 2}px, ${g.cameraHeight / 2}px)`,
            width: '0px',
            height: '0px',
        });
        this.setCanvasElementStyle(this.canvasBackgroundStyle, {
            width: (g.cameraWidth * 10) + 'px',
            height: (g.cameraHeight * 10) + 'px',
            transform: `translate(${-g.cameraWidth * 5}px, ${-g.cameraHeight * 5}px)`,
            transformOrigin: "center",
            zIndex: "0",
            position: "absolute",
        });
        this.renderCanvasElement(SnapLineDomType.canvasContainer, this.canvasContainerStyle);
        this.renderCanvasElement(SnapLineDomType.canvas, this.canvasStyle);
        this.renderCanvasElement(SnapLineDomType.canvasBackground, this.canvasBackgroundStyle);
        this.renderCanvasElement(SnapLineDomType.selectionBox, this.canvasSelectionBoxStyle);
        g.canvasContainer.addEventListener('mouseup', this.onMouseUp.bind(this));
        g.canvasContainer.addEventListener('mousemove', this.onMouseMove.bind(this));
        g.canvasContainer.addEventListener('mousedown', this.onMouseDown.bind(this));
        g.canvasContainer.addEventListener('wheel', this.onWheel.bind(this));
        g.canvasContainer.addEventListener('keydown', this.onKeyDown.bind(this));
        document.addEventListener('mousemove', this.onMouseMove.bind(this));
        document.addEventListener('mouseup', this.onMouseUp.bind(this));
        g.canvasContainer.addEventListener('touchstart', this.onTouchStart.bind(this));
        g.canvasContainer.addEventListener('touchmove', this.onTouchMove.bind(this));
        g.canvasContainer.addEventListener('touchend', this.onTouchEnd.bind(this));
        window.requestAnimationFrame(this.step.bind(this));
    }
    setCanvasElementStyle(curStyle, newStyle) {
        curStyle = Object.assign({}, curStyle, newStyle);
    }
    renderCanvasElement(domType, style) {
        let dom = null;
        if (this.g == null) {
            return;
        }
        switch (domType) {
            case SnapLineDomType.canvas:
                dom = this.g.canvas;
                break;
            case SnapLineDomType.canvasContainer:
                dom = this.g.canvasContainer;
                break;
            case SnapLineDomType.canvasBackground:
                dom = this.g.canvasBackground;
                break;
            case SnapLineDomType.selectionBox:
                dom = this.g.selectionBox;
                break;
            default:
                console.error("Invalid dom type: " + domType);
                return;
        }
        if (dom == null) {
            return;
        }
        for (const key in style) {
            dom.style[key] = style[key];
        }
    }
    /* Event handlers */
    onTouchStart(e) {
        /* If multiple touches are detected, treat it as a middle mouse button press (pan camera) */
        if (e.touches.length > 1) {
            /* If there was only one touch previously, it means up until now it has been handled as a mouse press or drag.
             * Call the cursor up handler to reset the state */
            if (this.g.prevTouches.length == 1) {
                this.onCursorUp();
            }
            this.g.currentMouseDown = mouseDownButton.middle;
            /* Use the middle of the two touches as the mouse position */
            let middleX = (e.touches[0].clientX + e.touches[1].clientX) / 2;
            let middleY = (e.touches[0].clientY + e.touches[1].clientY) / 2;
            this.onCursorDown(mouseDownButton.middle, middleX, middleY);
            this.g.prevTouches = e.touches;
            return;
        }
        /* If there is only one touch, treat it as a left mouse button press */
        this.onCursorDown(mouseDownButton.left, e.touches[0].clientX, e.touches[0].clientY);
    }
    onMouseDown(e) {
        let button = mouseDownButton.invalid;
        switch (e.button) {
            case 0:
                button = mouseDownButton.left;
                break;
            case 1:
                button = mouseDownButton.middle;
                break;
            default:
                return;
        }
        this.onCursorDown(button, e.clientX, e.clientY);
    }
    /**
     * Event handler when mouse or touchscreen is pressed.
     * Can be called by mousedown ot touch start.
     * Because most elements have stopPropagation on mousedown,
     * this will only be called if the user clicks on the canvas background.
     *
     * Usually this means the user is performing a camera pan or selecting multiple nodes.
     *
     * @param button: The mouse button that was pressed.
     * @param clientX: The x position of the cursor.
     * @param clientY: The y position of the cursor.
     * @returns
     */
    onCursorDown(button, clientX, clientY) {
        this.g.currentMouseDown = button;
        /*  If the user is dragging a line when another cursor down event is detected, then the line should be deleted.
            This usually happens on touch devices with multi-touch support */
        const tmpLine = document.querySelector('.sl-connector-svg.tmp');
        if (tmpLine) {
            console.debug("Cursor down with tmp line");
            const output_gid = tmpLine.getAttribute('output-gid');
            if (output_gid != null) {
                console.debug("Cursor down with tmp line and output gid: " + output_gid);
                const output = this.g.globalNodeTable[output_gid];
                if (output) {
                    output.domCursorUp();
                    this.onCursorUp();
                }
            }
        }
        const g = this.g;
        if (g.overrideDrag) {
            return;
        }
        /* Reset the selection box */
        if (g.currentMouseDown != mouseDownButton.none) {
            this.setCanvasElementStyle(this.canvasSelectionBoxStyle, {
                width: '0px',
                height: '0px',
                left: '0px',
                top: '0px',
                pointerEvents: "none",
                opacity: "0",
            });
        }
        /* Unselect all nodes */
        g.focusNodes = [];
        for (const node of g.globalNodeList) {
            node.offFocus();
        }
        g.mousedown_x = clientX;
        g.mousedown_y = clientY;
        g.camera_pan_start_x = g.camera_x;
        g.camera_pan_start_y = g.camera_y;
    }
    onTouchMove(e) {
        /* Single touch move is same as mouse drag */
        if (e.touches.length <= 0) {
            let element = document.elementFromPoint(e.touches[0].clientX, e.touches[0].clientY);
            this.onCursorMove(element, e.touches[0].clientX, e.touches[0].clientY);
            this.g.prevTouches = e.touches;
            return;
        }
        /* If there are multiple touches moving, it is a camera pan and zoom */
        /*  If there are more or less than two touches, then ignore as ir is likely the user was
            trying to drag and accidentally touched the screen with another finger */
        if (this.g.prevTouches == null || this.g.prevTouches.length != 2) {
            if (e.touches.length == 2)
                this.g.prevTouches = e.touches;
            return;
        }
        let cur1 = e.touches[0];
        let cur2 = e.touches[1];
        let prev1 = null;
        let prev2 = null;
        /* Find the previous touch positions for each finger */
        for (let i = 0; i < e.touches.length; i++) {
            if (cur1.identifier == this.g.prevTouches[i].identifier) {
                prev1 = this.g.prevTouches[i];
            }
            else if (cur2.identifier == this.g.prevTouches[i].identifier) {
                prev2 = this.g.prevTouches[i];
            }
        }
        let curDistance = Math.sqrt(Math.pow(cur1.clientX - cur2.clientX, 2) + Math.pow(cur1.clientY - cur2.clientY, 2));
        let prevDistance = Math.sqrt(Math.pow(prev1.clientX - prev2.clientX, 2) + Math.pow(prev1.clientY - prev2.clientY, 2));
        let d_zoom = -2 * (curDistance - prevDistance);
        let middle_x = (cur1.clientX + cur2.clientX) / 2;
        let middle_y = (cur1.clientY + cur2.clientY) / 2;
        let newMouseX = middle_x - this.g.canvasContainer.offsetLeft;
        let newMouseY = middle_y - this.g.canvasContainer.offsetTop;
        this.onCursorMove(document.elementFromPoint(newMouseX, newMouseY), newMouseX, newMouseY);
        this.g.mouse_x = newMouseX;
        this.g.mouse_y = newMouseY;
        this.onZoom(d_zoom);
        this.g.prevTouches = e.touches;
        return;
    }
    onMouseMove(e) {
        this.onCursorMove(e.target, e.clientX, e.clientY);
    }
    /**
     * Handle cursor move events.
     * This usually means the camera is panned or a selection box is being drawn.
     *
     * @param target
     * @param clientX
     * @param clientY
     * @returns
     */
    onCursorMove(target, clientX, clientY) {
        const g = this.g;
        g.hoverDOM = target;
        g.mouse_x = clientX - g.canvasContainer.offsetLeft;
        g.mouse_y = clientY - g.canvasContainer.offsetTop;
        /* Adjust mouse position to world coordinates */
        let w_x = (g.mouse_x - g.cameraWidth / 2) / g.zoom + g.camera_x;
        let w_y = (g.mouse_y - g.cameraHeight / 2) / g.zoom + g.camera_y;
        g.mouse_x_world = w_x;
        g.mouse_y_world = w_y;
        g.dx = clientX - g.mousedown_x + g.dx_offset;
        g.dy = clientY - g.mousedown_y + g.dy_offset;
        /* Handle cases where a mouse button is pressed, i.e. dragging */
        if (g.currentMouseDown == mouseDownButton.none || g.overrideDrag) {
            return;
        }
        if (g.dx !== 0 || g.dy !== 0) {
            g.mouseHasMoved = true;
        }
        /* If nothing is selected, then this drag is either a camera pan or a selection box */
        if (g.targetObject == null) {
            if (g.currentMouseDown == mouseDownButton.middle) {
                // Pan camera if middle mouse button is pressed
                g.camera_x = g.camera_pan_start_x - g.dx / g.zoom;
                g.camera_y = g.camera_pan_start_y - g.dy / g.zoom;
                this.setCanvasElementStyle(this.canvasStyle, {
                    transform: `matrix3d(${worldToCamera(g.camera_x, g.camera_y, g)})`,
                    cursor: "grabbing",
                });
                this.setCanvasElementStyle(this.canvasBackgroundStyle, {
                    transform: `translate(${g.camera_x + -g.cameraWidth * 5}px, ${g.camera_y + -g.cameraHeight * 5}px)`,
                    backgroundPosition: `${-g.camera_x}px ${-g.camera_y}px`,
                });
            }
            else if (g.currentMouseDown == mouseDownButton.left) {
                // Select multiple boxes if left mouse button is pressed
                this.setCanvasElementStyle(this.canvasSelectionBoxStyle, {
                    width: Math.abs(g.dx) + 'px',
                    height: Math.abs(g.dy) + 'px',
                    left: Math.min(g.mousedown_x, g.mouse_x) + 'px',
                    top: Math.min(g.mousedown_y, g.mouse_y) + 'px',
                });
                // Check if any nodes are inside the selection box
                let w_x_start = (Math.min(g.mousedown_x, g.mouse_x) - g.cameraWidth / 2) / g.zoom + g.camera_x;
                let w_y_start = (Math.min(g.mousedown_y, g.mouse_y) - g.cameraHeight / 2) / g.zoom + g.camera_y;
                let w_x_end = (Math.max(w_x, g.mousedown_x, g.mouse_x) - g.cameraWidth / 2) / g.zoom + g.camera_x;
                let w_y_end = (Math.max(w_y, g.mousedown_y, g.mouse_y) - g.cameraHeight / 2) / g.zoom + g.camera_y;
                let selectedNodes = [];
                /* Focus on nodes that are inside the selection box */
                for (const node of g.globalNodeList) {
                    if (node.position_x + node.nodeWidth > w_x_start && node.position_x < w_x_end && node.position_y + node.nodeHeight > w_y_start && node.position_y < w_y_end) {
                        node.onFocus();
                        selectedNodes.push(node);
                    }
                    else {
                        node.offFocus();
                    }
                }
                g.focusNodes = selectedNodes;
            }
        }
        else {
            /* If an object is selected, then this drag is for that object */
            if (g.targetObject.type == ObjectTypes.node) {
                /* If the object being dragged is a node, then handle mouse move for all selected nodes */
                for (const node of g.focusNodes) {
                    node.onDrag();
                }
            }
            else {
                /* Otherwise, just handle mouse move for the selected object */
                g.targetObject.onDrag();
            }
        }
    }
    onMouseUp(_) {
        this.onCursorUp();
    }
    onTouchEnd(_) {
        this.onCursorUp();
    }
    onCursorUp() {
        const g = this.g;
        console.debug("Cursor up");
        if (g.ignoreMouseUp) {
            g.ignoreMouseUp = false;
            return;
        }
        if (g.currentMouseDown == mouseDownButton.left) {
            if (g.targetObject == null) {
                /* If nothing is selected, then this drag is a selection box */
                this.setCanvasElementStyle(this.canvasSelectionBoxStyle, {
                    width: '0px',
                    height: '0px',
                    left: '0px',
                    top: '0px',
                });
            }
            else if (g.targetObject.type == ObjectTypes.node) {
                /* If the object being dragged is a node, then handle mouse up for all selected nodes */
                for (const node of g.focusNodes) {
                    console.debug("Mouse up with target node: " + node.gid);
                    node.domCursorUp();
                }
            }
            else {
                /* Otherwise, just handle mouse up for the selected object */
                g.targetObject.domCursorUp();
            }
        }
        g.currentMouseDown = mouseDownButton.none;
        if (g.overrideDrag) {
            this.setCanvasElementStyle(this.canvasStyle, {
                cursor: "default",
            });
        }
        g.overrideDrag = false;
        this.setCanvasElementStyle(this.canvasBackgroundStyle, {
            cursor: "default",
        });
        g.targetObject = null;
        g.dx = 0;
        g.dy = 0;
        g.dx_offset = 0;
        g.dy_offset = 0;
        g.mouseHasMoved = false;
    }
    onWheel(e) {
        this.onZoom(e.deltaY);
        e.preventDefault();
    }
    onZoom(deltaY = 0) {
        const g = this.g;
        let d_zoom = (1 * g.zoom) * (-deltaY / 1000);
        if (g.zoom + d_zoom < 0.2) {
            d_zoom = 0.2 - g.zoom;
        }
        else if (g.zoom + d_zoom > 1) {
            d_zoom = 1 - g.zoom;
        }
        let dz = g.zoom / (g.zoom + d_zoom);
        let camera_dx = (g.cameraWidth / g.zoom * (dz - 1)) * (1 - (g.cameraWidth * 1.5 - g.mouse_x) / g.cameraWidth);
        let camera_dy = (g.cameraHeight / g.zoom * (dz - 1)) * (1 - (g.cameraHeight * 1.5 - g.mouse_y) / g.cameraHeight);
        g.zoom += d_zoom;
        g.camera_x -= camera_dx;
        g.camera_y -= camera_dy;
        this.setCanvasElementStyle(this.canvasStyle, {
            transform: `matrix3d(${worldToCamera(g.camera_x, g.camera_y, g)})`,
        });
    }
    onKeyDown(e) {
        console.debug("Keydown: " + e.key);
        switch (e.key) {
            case 'Backspace':
            case 'Delete':
                if (this.g.focusNodes.length > 0) {
                    // this.deleteNode(g.focusNode.gid);
                    for (const node of this.g.focusNodes) {
                        console.debug("Deleting node: " + node.gid);
                        this.deleteNode(node.gid);
                    }
                }
                break;
        }
    }
    step() {
        console.debug("Step", this.g.targetObject?.type);
        if (this.g.targetObject?.type == ObjectTypes.node) {
            for (const node of this.g.focusNodes) {
                node.renderNode(node.nodeStyle);
            }
        }
        else if (this.g.targetObject?.type == ObjectTypes.connector && this.g.targetObject instanceof OutputConnector) {
            let output = this.g.targetObject;
            output.renderAllLines(output.svgLines);
        }
        this.renderCanvasElement(SnapLineDomType.canvasContainer, this.canvasContainerStyle);
        this.renderCanvasElement(SnapLineDomType.canvas, this.canvasStyle);
        this.renderCanvasElement(SnapLineDomType.canvasBackground, this.canvasBackgroundStyle);
        this.renderCanvasElement(SnapLineDomType.selectionBox, this.canvasSelectionBoxStyle);
        window.requestAnimationFrame(this.step.bind(this));
    }
    addNodeObject() {
        const n = new NodeComponent(null, this.g);
        this.g.globalNodeTable[n.gid] = n;
        return [n, this.g.globalNodeTable];
    }
    createNode(dom) {
        const n = new NodeComponent(dom, this.g);
        this.g.globalNodeTable[n.gid] = n;
        // n.domMouseDown();
        // n.onDrag();
        // n.domMouseUp();
        return n;
    }
    createNodeAuto(dom) {
        const n = new NodeComponent(dom, this.g);
        this.g.globalNodeTable[n.gid] = n;
        // Get all 'sl-input' elements
        const inputs = dom.querySelectorAll('.sl-input');
        for (let i = 0; i < inputs.length; i++) {
            const inputDom = inputs[i];
            const inputName = inputDom.getAttribute('sl-name');
            const input = n.addInputForm(inputDom, inputName);
            // Loop through all attributes for ones that start with 'sl-event:<event>'
            // If the attribute is found, add an event listener to the input connector
            for (let j = 0; j < inputDom.attributes.length; j++) {
                const attr = inputDom.attributes[j];
                if (attr.name.startsWith('sl-event:')) {
                    const event = attr.name.split(':')[1];
                    const func = window[attr.value];
                    console.debug("Adding event listener: " + event);
                    input.addInputUpdateListener(event, func);
                }
            }
        }
        // Get all 'sl-input-connector' elements
        const connectors = dom.querySelectorAll('.sl-input-connector');
        for (let i = 0; i < connectors.length; i++) {
            const connector = connectors[i];
            const connectorName = connector.getAttribute('sl-name');
            const input = n.addInputConnector(connector, connectorName);
            const updateFuncName = connector.getAttribute('sl-update');
            console.debug("Update function: " + updateFuncName);
            if (updateFuncName != null || updateFuncName != undefined) {
                console.debug("Update function: " + updateFuncName, input);
                const updateFunc = window[updateFuncName];
                input.updateFunction = updateFunc.bind(input);
            }
        }
        // Get all 'sl-output-connector' elements
        const outputs = dom.querySelectorAll('.sl-output-connector');
        for (let i = 0; i < outputs.length; i++) {
            const output = outputs[i];
            const outputName = output.getAttribute('sl-name');
            n.addOutputConnector(output, outputName);
        }
        for (let j = 0; j < dom.attributes.length; j++) {
            const attr = dom.attributes[j];
            if (attr.name.startsWith('sl-init')) {
                const func = window[attr.value];
                console.debug("Calling init func: " + func);
                func.bind(n)();
            }
        }
        return n;
    }
    addNode(node, x, y) {
        node.addNodeToCanvas(x, y);
        // n.domMouseDown();
        // n.onDrag();
        // n.domMouseUp();
    }
    addNodeAtMouse(node, e) {
        this.g.ignoreMouseUp = true;
        let x = this.g.mouse_x_world;
        let y = this.g.mouse_y_world;
        console.debug("Adding node at " + x + ", " + y);
        this.addNode(node, x, y);
        node.setStartPositions();
        this.g.currentMouseDown = mouseDownButton.left;
        this.g.mousedown_x = this.g.mouse_x;
        this.g.mousedown_y = this.g.mouse_y;
        this.g.camera_pan_start_x = this.g.camera_x;
        this.g.camera_pan_start_y = this.g.camera_y;
        //this.g.overrideDrag = true;
        this.g.focusNodes = [node];
        this.g.targetObject = node;
        for (const node of this.g.globalNodeList) {
            node.offFocus();
        }
        this.onMouseMove(e);
        // this.g.canvasBackground!.style.cursor = "none";
    }
    deleteNode(id) {
        if (!(id in this.g.globalNodeTable)) {
            console.error("Node not found: " + id);
            return null;
        }
        this.g.globalNodeTable[id].destroy();
        delete this.g.globalNodeTable[id];
        return id;
    }
    focusNode(id) {
        if (!(id in this.g.globalNodeTable))
            return null;
        const node = this.g.globalNodeTable[id];
        node.onFocus();
        return id;
    }
    connectNodes(node0, outputID, node1, inputID) {
        const n0 = this.g.globalNodeTable[node0];
        const n1 = this.g.globalNodeTable[node1];
        if (!n0 || !n1 || !(n0 instanceof NodeComponent) || !(n1 instanceof NodeComponent)) {
            return null;
        }
        const o = n0.findOutput(outputID);
        const i = n1.findInput(inputID);
        if (!o || !i)
            return null;
        o.connectToInput(i);
        return 0;
    }
}

export { SnapLine as default };
//# sourceMappingURL=snapline.js.map
