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
    connector_x; // Location of the connector on canvas
    connector_y;
    c_total_offset_x; // Location of the connector relative to the location of parent Node
    c_total_offset_y;
    prop; // Reference to the parent's prop object
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
        this.g.globalNodes[this.gid] = this;
        this.bindFunction(this.dom);
        this.dom.setAttribute('sl-gid', this.gid.toString());
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
    setLineXY(line, x, y) {
        line.setAttribute('x1', '' + 0);
        line.setAttribute('y1', '' + 0);
        line.setAttribute('x2', '' + x);
        line.setAttribute('y2', '' + y);
        line.setAttribute('stroke-width', '4');
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
    svgTmp;
    svgLines;
    peerInputs = [];
    constructor(dom, config, parent, globals) {
        super(dom, config, parent, globals);
        this.val = null;
        this.svgTmp = {
            svg: null,
            line: null,
        };
        this.svgLines = [];
        this.dom = dom;
    }
    connectToInput(input) {
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
        this.peerInputs.push(input);
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
        this.svgLines.push(newSVG);
        this.g.globalLines.push(newSVG);
        this.g.canvas.appendChild(svg);
        this.setLineXY(line, input.connector_x - this.connector_x, input.connector_y - this.connector_y);
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
    moveToParent() {
        /* Called when lines need to be updated */
        this.updateConnectorPosition();
        if (this.svgTmp.line) {
            this.svgTmp.svg.style.transform = `translate3d(${this.connector_x}px, ${this.connector_y}px, 0)`;
        }
        if (this.svgLines.length < 1) {
            return;
        }
        for (const svg of this.svgLines) {
            svg.svg.style.transform = `translate3d(${this.connector_x}px, ${this.connector_y}px, 0)`;
            svg.connector_x = this.connector_x;
            svg.connector_y = this.connector_y;
            svg.x2 = (svg.to.connector_x - this.connector_x);
            svg.y2 = (svg.to.connector_y - this.connector_y);
            this.setLineXY(svg.line, svg.x2, svg.y2);
        }
    }
    createNewSVG(isTmp = false) {
        console.debug("Creating new SVG");
        // create a new svg path
        const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
        svg.classList.add('sl-connector-svg');
        svg.setAttribute('output-gid', this.gid.toString());
        if (isTmp)
            svg.classList.add('tmp');
        svg.style.pointerEvents = 'none';
        svg.style.position = 'absolute';
        svg.style.overflow = 'visible';
        svg.setAttribute('width', '4');
        svg.setAttribute('height', '4');
        svg.style.willChange = "transform";
        const line = document.createElementNS('http://www.w3.org/2000/svg', 'line');
        line.classList.add('sl-connector-line');
        line.classList.add('tmp');
        line.setAttribute('stroke-width', '4');
        svg.appendChild(line);
        this.updateConnectorPosition();
        console.debug("connector x: " + this.connector_x);
        svg.style.transform = `translate3d(${this.connector_x}px, ${this.connector_y}px, 0)`;
        this.g.canvas.appendChild(svg);
        return [svg, line];
    }
    customCursorDown(_) {
        console.debug(`ConnectorComponent mousedown event triggered on ${this.gid}!`);
        // while dragging, we use a temporary svg to show the line
        // if (this.g.noNewSVG) {
        //     return;
        // }
        const s = this.createNewSVG(true);
        //console.debug(s[0]);
        this.svgTmp.svg = s[0];
        this.svgTmp.line = s[1];
        this.moveToParent();
        this.setLineXY(this.svgTmp.line, this.g.dx, this.g.dy);
    }
    onDrag() {
        // Handle snapping lines to connectors
        //console.debug("Dragging connector", this.g.hoverDOM);
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
            const input = this.g.globalNodes[gid];
            input.updateConnectorPosition();
            connector_x = input.connector_x;
            connector_y = input.connector_y;
            distance = Math.sqrt(Math.pow(this.connector_x + this.g.dx / this.g.zoom - connector_x, 2) + Math.pow(this.connector_y + this.g.dy / this.g.zoom - connector_y, 2));
        }
        if (distance < 40) {
            this.setLineXY(this.svgTmp.line, (connector_x - this.connector_x), (connector_y - this.connector_y));
        }
        else {
            this.setLineXY(this.svgTmp.line, this.g.dx / this.g.zoom, this.g.dy / this.g.zoom);
        }
    }
    nodeDrag() {
        this.moveToParent();
    }
    deleteTmpSvg() {
        if (this.svgTmp.svg) {
            this.g.canvas.removeChild(this.svgTmp.svg);
        }
        this.svgTmp = {
            svg: null,
            line: null
        };
    }
    domCursorUp() {
        console.debug(`connector domMouseUp`);
        const hn = this.g.hoverDOM;
        if (hn && hn.classList.contains('sl-input-connector')) {
            const gid = hn.getAttribute('sl-gid');
            console.debug("Hovering over input connector: ", gid);
            if (!gid) {
                this.deleteTmpSvg();
                return;
            }
            const input = this.g.globalNodes[gid];
            this.connectToInput(input);
            input.prop[input.name] = this.prop[this.name];
            input.updateFunction();
        }
        this.deleteTmpSvg();
        console.debug("Canvas children: ", this.g.canvas.children);
    }
    getValue() {
        this.parent.exec();
        return this.val;
    }
    destroy() {
        for (const input of this.peerInputs) {
            this.disconnectFromInput(input);
        }
        for (const svg of this.svgLines) {
            console.debug("Removing svg: ", svg);
            this.g.canvas.removeChild(svg.svg);
        }
        //this.g.canvas?.removeChild(this.dom!);
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
    constructor(dom, globals) {
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
        this.dom.style.transform = `translate3d(${this.position_x}px, ${this.position_y}px, 0)`;
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
    constructor(canvasContainerID) {
        this.g = {
            canvas: null,
            canvasContainer: null,
            canvasBackground: null,
            currentMouseDown: mouseDownButton.none,
            mousedown_x: 0, // Initial mouse  position when mouse is pressed
            mousedown_y: 0,
            mouse_x: 0, // Current mouse position
            mouse_y: 0,
            mouse_x_world: 0, // Current mouse position, in world space
            mouse_y_world: 0,
            camera_pan_start_x: 0, // Initial camera position when camera is being panned
            camera_pan_start_y: 0,
            dx: 0, // How much the mouse has moved since being pressed
            dy: 0,
            dx_offset: 0, // Offset for dx and dy
            dy_offset: 0,
            overrideDrag: false,
            camera_x: 0,
            camera_y: 0,
            zoom: 1,
            cameraWidth: 0,
            cameraHeight: 0,
            targetObject: null, // Node that is currently being dragged
            focusNodes: [], // Node that is currently focused
            hoverDOM: null,
            gid: 0,
            nodeArray: [],
            globalLines: [],
            globalNodes: {},
            selectionBox: null,
            mouseHasMoved: false,
            ignoreMouseUp: false,
            prevTouches: null,
            prevSingleTouchTime: 0,
        };
        const g = this.g;
        g.canvasContainer = document.getElementById(canvasContainerID);
        if (!g.canvasContainer) {
            console.error("Canvas not found");
            return;
        }
        g.cameraWidth = g.canvasContainer.clientWidth;
        g.cameraHeight = g.canvasContainer.clientHeight;
        console.debug(`Canvas size: ${g.cameraWidth}x${g.cameraHeight}`);
        // g.camera_x = g.cameraWidth/2;
        // g.camera_y = g.cameraHeight/2;
        const c = document.createElement('div');
        c.style.position = 'relative';
        c.style.top = '0px';
        c.style.left = '0px';
        c.className = 'canvas';
        g.canvasContainer.appendChild(c);
        g.canvas = c;
        g.canvas.style.transform = `translate(${g.cameraWidth / 2}px, ${g.cameraHeight / 2}px)`;
        g.canvas.style.width = '0px';
        g.canvas.style.height = '0px';
        g.canvasContainer.style.overflow = "hidden";
        g.canvasContainer.tabIndex = 0;
        g.canvasContainer.style.position = "relative";
        const bg = document.createElement('div');
        bg.id = "sl-background";
        bg.style.width = (g.cameraWidth * 10) + 'px';
        bg.style.height = (g.cameraHeight * 10) + 'px';
        bg.style.transform = `translate(${-g.cameraWidth * 5}px, ${-g.cameraHeight * 5}px)`;
        bg.style.transformOrigin = "center";
        bg.style.zIndex = "0";
        bg.style.position = "absolute";
        g.canvas.appendChild(bg);
        g.canvasBackground = bg;
        // Create the div element that will be the rectangle to select nodes
        const selectionBox = document.createElement('div');
        selectionBox.id = "sl-selection-box";
        selectionBox.style.position = 'absolute';
        // selectionBox.style.zIndex = "2";
        // selectionBox.style.border = "1px solid red";
        selectionBox.style.pointerEvents = "none";
        g.canvasContainer.appendChild(selectionBox);
        g.selectionBox = selectionBox;
        g.canvasContainer.addEventListener('mousedown', this.onMouseDown.bind(this));
        g.canvasContainer.addEventListener('mousemove', this.onMouseMove.bind(this));
        g.canvasContainer.addEventListener('mouseup', this.onMouseUp.bind(this));
        g.canvasContainer.addEventListener('wheel', this.onWheel.bind(this));
        g.canvasContainer.addEventListener('keydown', this.onKeyDown.bind(this));
        document.addEventListener('mousemove', this.onMouseMove.bind(this));
        document.addEventListener('mouseup', this.onMouseUp.bind(this));
        g.canvasContainer.addEventListener('touchstart', this.onTouchStart.bind(this));
        g.canvasContainer.addEventListener('touchmove', this.onTouchMove.bind(this));
        g.canvasContainer.addEventListener('touchend', this.onTouchEnd.bind(this));
        window.requestAnimationFrame(this.step.bind(this));
    }
    onTouchStart(e) {
        // else if (Date.now() - this.g.prevSingleTouchTime > 300) {
        //     this.g.prevSingleTouchTime = 0;
        //     this.onCursorDown(1, e.touches[0].clientX, e.touches[0].clientY);
        //     return;
        // }
        if (e.touches.length > 1) {
            if (this.g.prevTouches.length == 1) {
                this.onCursorUp();
            }
            console.debug("Multitouch touchstart");
            this.g.currentMouseDown = mouseDownButton.middle;
            let middleX = (e.touches[0].clientX + e.touches[1].clientX) / 2;
            let middleY = (e.touches[0].clientY + e.touches[1].clientY) / 2;
            this.onCursorDown(1, middleX, middleY);
            this.g.prevTouches = e.touches;
            return;
        }
        this.onCursorDown(0, e.touches[0].clientX, e.touches[0].clientY);
    }
    onMouseDown(e) {
        this.onCursorDown(e.button, e.clientX, e.clientY);
    }
    /**
     * Event handler when mouse or touchscreen is pressed.
     * Can be called by mousedown ot touch start.
     * Because most elements have stopPropagation on mousedown,
     * this will only be called if the user clicks on the canvas background.
     *
     * Usually this means the user is performing a camera pan or selecting multiple nodes.
     */
    onCursorDown(button, clientX, clientY) {
        console.debug("Cursor down: " + button);
        const tmpLine = document.querySelector('.sl-connector-svg.tmp');
        if (tmpLine) {
            console.debug("Cursor down with tmp line");
            const output_gid = tmpLine.getAttribute('output-gid');
            if (output_gid != null) {
                console.debug("Cursor down with tmp line and output gid: " + output_gid);
                const output = this.g.globalNodes[output_gid];
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
        // Handle cases where a mouse button is already pressed
        if (g.currentMouseDown != mouseDownButton.none) {
            g.selectionBox.style.width = '0px';
            g.selectionBox.style.height = '0px';
            g.selectionBox.style.left = '0px';
            g.selectionBox.style.top = '0px';
        }
        if (button == 1) {
            g.currentMouseDown = mouseDownButton.middle;
        }
        else if (button == 0) {
            g.currentMouseDown = mouseDownButton.left;
        }
        else {
            g.currentMouseDown = mouseDownButton.invalid;
        }
        /* Unselect all nodes */
        g.focusNodes = [];
        for (const node of g.nodeArray) {
            node.offFocus();
        }
        g.mousedown_x = clientX;
        g.mousedown_y = clientY;
        g.camera_pan_start_x = g.camera_x;
        g.camera_pan_start_y = g.camera_y;
    }
    onMouseMove(e) {
        this.onCursorMove(e.target, e.clientX, e.clientY);
    }
    onTouchMove(e) {
        // if (this.g.timer) {
        //     clearTimeout(this.g.timer);
        //     this.g.timer = null;
        //     this.g.prevSingleTouchTime = 0;
        //     return;
        // }
        if (e.touches.length > 1) {
            if (this.g.prevTouches == null || this.g.prevTouches.length != 2) {
                if (e.touches.length == 2)
                    this.g.prevTouches = e.touches;
                return;
            }
            //alert("Multitouch not supported yet");
            let cur1 = e.touches[0];
            let cur2 = e.touches[1];
            // FInd the corresponding touch in the previous event
            let prev1 = null;
            let prev2 = null;
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
            // Set mouse position to the middle of the two touches
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
        let element = document.elementFromPoint(e.touches[0].clientX, e.touches[0].clientY);
        this.onCursorMove(element, e.touches[0].clientX, e.touches[0].clientY);
        this.g.prevTouches = e.touches;
    }
    /**
     * Handle cursor movement.
        * This can be called by mousemove or touchmove.
        */
    onCursorMove(target, clientX, clientY) {
        console.debug("Cursor move");
        const g = this.g;
        g.hoverDOM = target;
        // Get mouse position relative to canvas
        g.mouse_x = clientX - g.canvasContainer.offsetLeft;
        g.mouse_y = clientY - g.canvasContainer.offsetTop;
        // Adjust mouse position to world coordinates
        let w_x = (g.mouse_x - g.cameraWidth / 2) / g.zoom + g.camera_x;
        let w_y = (g.mouse_y - g.cameraHeight / 2) / g.zoom + g.camera_y;
        g.mouse_x_world = w_x;
        g.mouse_y_world = w_y;
        //console.debug("Mouse move: " + g.mouse_x + ", " + g.mouse_y + " (" + w_x + ", " + w_y + ")");
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
                g.canvas.style.transform = `matrix3d(${worldToCamera(g.camera_x, g.camera_y, g)})`;
                g.canvasBackground.style.transform = `translate(${g.camera_x + -g.cameraWidth * 5}px, ${g.camera_y + -g.cameraHeight * 5}px)`;
                g.canvasBackground.style.backgroundPosition = `${-g.camera_x}px ${-g.camera_y}px`;
                g.canvas.style.cursor = "grabbing";
            }
            else if (g.currentMouseDown == mouseDownButton.left) {
                // Select multiple boxes if left mouse button is pressed
                g.selectionBox.style.width = Math.abs(g.dx) + 'px';
                g.selectionBox.style.height = Math.abs(g.dy) + 'px';
                g.selectionBox.style.left = Math.min(g.mousedown_x, g.mouse_x) + 'px';
                g.selectionBox.style.top = Math.min(g.mousedown_y, g.mouse_y) + 'px';
                // Check if any nodes are inside the selection box
                let w_x_start = (Math.min(g.mousedown_x, g.mouse_x) - g.cameraWidth / 2) / g.zoom + g.camera_x;
                let w_y_start = (Math.min(g.mousedown_y, g.mouse_y) - g.cameraHeight / 2) / g.zoom + g.camera_y;
                let w_x_end = (Math.max(w_x, g.mousedown_x, g.mouse_x) - g.cameraWidth / 2) / g.zoom + g.camera_x;
                let w_y_end = (Math.max(w_y, g.mousedown_y, g.mouse_y) - g.cameraHeight / 2) / g.zoom + g.camera_y;
                let selectedNodes = [];
                for (const node of g.nodeArray) {
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
    }
    onMouseUp(_) {
        this.onCursorUp();
    }
    onTouchEnd(_) {
        // if (this.g.prevTouches.length >= 2) {
        //     this.g.prevTouches = null;
        // }
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
                g.selectionBox.style.width = '0px';
                g.selectionBox.style.height = '0px';
                g.selectionBox.style.left = '0px';
                g.selectionBox.style.top = '0px';
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
            // g.noNewSVG = true;
            // for (const node of g.focusNodes) {
            //     node.domMouseDown(e);
            // }
            // g.noNewSVG = false;
        }
        g.currentMouseDown = mouseDownButton.none;
        if (g.overrideDrag) {
            g.canvasBackground.style.cursor = "default";
        }
        g.overrideDrag = false;
        g.canvas.style.cursor = "default";
        // if (g.targetObject == null) {
        //     console.debug("Mouse up with no target node");
        // } else {
        //     console.debug("Mouse up with target node: " + g.targetObject.gid);
        //     for (const node of g.focusNodes) {
        //         node.domMouseUp();
        //     }
        //     g.targetObject.domMouseUp();
        //     //g.focusNodes = [];
        // }
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
        g.canvas.style.transform = `matrix3d(${worldToCamera(g.camera_x, g.camera_y, g)})`;
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
        if (this.g.targetObject?.type == ObjectTypes.node) {
            for (const node of this.g.focusNodes) {
                node.onDrag();
            }
        }
        else {
            this.g.targetObject?.onDrag();
        }
        window.requestAnimationFrame(this.step.bind(this));
    }
    createNode(dom) {
        const n = new NodeComponent(dom, this.g);
        this.g.globalNodes[n.gid] = n;
        // n.domMouseDown();
        // n.onDrag();
        // n.domMouseUp();
        return n;
    }
    createNodeAuto(dom) {
        const n = new NodeComponent(dom, this.g);
        this.g.globalNodes[n.gid] = n;
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
        for (const node of this.g.nodeArray) {
            node.offFocus();
        }
        this.onMouseMove(e);
        // this.g.canvasBackground!.style.cursor = "none";
    }
    deleteNode(id) {
        if (!(id in this.g.globalNodes)) {
            console.error("Node not found: " + id);
            return null;
        }
        this.g.globalNodes[id].destroy();
        delete this.g.globalNodes[id];
        return id;
    }
    focusNode(id) {
        if (!(id in this.g.globalNodes))
            return null;
        const node = this.g.globalNodes[id];
        node.onFocus();
        return id;
    }
    connectNodes(node0, outputID, node1, inputID) {
        const n0 = this.g.globalNodes[node0];
        const n1 = this.g.globalNodes[node1];
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
