var SnapLine = (function () {
    'use strict';

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
    function addLabel(dom, config) {
        if (config.name === "") {
            return;
        }
        const label = document.createElement('span');
        label.classList.add('sl-label');
        label.innerText = config.name;
        dom.appendChild(label);
    }

    /*
        Root class of all classes.
    */
    class Base {
        g;
        gid;
        position_x;
        position_y;
        constructor(globals) {
            this.g = globals;
            globals.gid++;
            this.gid = globals.gid.toString();
            this.position_x = 0;
            this.position_y = 0;
        }
        domMouseDown(e) {
            this.g.isMouseDown = true;
            this.g.targetNode = this;
            this.g.mousedown_x = e.clientX;
            this.g.mousedown_y = e.clientY;
            this.g.dx = 0;
            this.g.dy = 0;
            this.g.dx_offset = 0;
            this.g.dy_offset = 0;
            this.onFocus();
            this.customMouseDown(e);
            e.stopPropagation();
        }
        customMouseDown(e) { console.debug(e); }
        domMouseUp() { }
        onFocus() { }
        offFocus() { }
        onDrag() { }
        onPan() { }
    }
    /*
        Base for all components
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

    class ConnectorComponent extends ComponentBase {
        connector_x;
        connector_y;
        c_total_offset_x;
        c_total_offset_y;
        name;
        parentContent;
        connector;
        constructor(config, parent, globals, parentContent) {
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
            }
            else {
                globals.gid++;
                this.name = globals.gid.toString();
            }
            this.parent.elements[this.name] = this;
            this.g.globalNodes[this.gid] = this;
        }
        pxToInt(px) {
            return parseInt(px.substring(0, px.length - 2));
        }
        updateDOMproperties() {
            const container_offset_x = this.parent.nodeContainerOffsetLeft;
            const container_offset_y = this.parent.nodeContainerOffsetTop;
            const content_offset_x = 0;
            this.pxToInt(window.getComputedStyle(this.parentContent).marginLeft)
                + this.pxToInt(window.getComputedStyle(this.parentContent).paddingLeft)
                + this.pxToInt(window.getComputedStyle(this.parentContent).borderLeftWidth)
                + this.parentContent.offsetLeft;
            const content_offset_y = this.parentContent.offsetTop;
            const connector_offset_x = this.pxToInt(window.getComputedStyle(this.connector).marginLeft)
                + this.pxToInt(window.getComputedStyle(this.connector).paddingLeft)
                + this.pxToInt(window.getComputedStyle(this.connector).borderLeftWidth)
                + this.connector.offsetLeft;
            const connector_offset_y = this.pxToInt(window.getComputedStyle(this.connector).marginTop)
                + this.pxToInt(window.getComputedStyle(this.connector).paddingTop)
                + this.pxToInt(window.getComputedStyle(this.connector).borderTopWidth)
                + this.connector.offsetTop;
            console.debug(`connector_offset_x: ${connector_offset_x} connector_offset_y: ${connector_offset_y}`);
            const connectorWidth = this.connector.getBoundingClientRect().width;
            const connectorHeight = this.connector.getBoundingClientRect().height;
            this.c_total_offset_x = container_offset_x + content_offset_x + connector_offset_x + connectorWidth / 2;
            this.c_total_offset_y = container_offset_y + content_offset_y + connector_offset_y + connectorHeight / 2;
        }
        setLineXY(line, x, y) {
            line.setAttribute('x1', '' + 0);
            line.setAttribute('y1', '' + 0);
            line.setAttribute('x2', '' + x);
            line.setAttribute('y2', '' + y);
            line.setAttribute('stroke-width', `${4 * this.g.zoom}`);
        }
    }
    class InputComponent extends ConnectorComponent {
        inputDOM; // Reference to the UI element where the user enters the value
        inputValue; // Function to get the value from inputDOM
        peerOutput;
        constructor(config, parent, globals, content) {
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
            this.inputValue = () => { };
            switch (config.type) {
                case 'input-text':
                    {
                        addLabel(input, config);
                        const inp = document.createElement('input');
                        inp.classList.add('sl-input-text');
                        inp.type = 'text';
                        input.appendChild(inp);
                        this.inputDOM = inp;
                        inp.onkeyup = () => {
                            this.parent?.findLeaf();
                        };
                        this.inputValue = () => { return this.inputDOM.value; };
                    }
                    break;
                case 'input-bool':
                    {
                        addLabel(input, config);
                        const inp = document.createElement('input');
                        inp.classList.add('sl-input-bool');
                        inp.type = 'checkbox';
                        input.appendChild(inp);
                        this.inputDOM = inp;
                        inp.onchange = () => {
                            this.parent?.findLeaf();
                        };
                        this.inputValue = () => { return this.inputDOM.checked; };
                    }
                    break;
            }
            this.connector = connector;
            this.dom = input;
        }
        domMouseDown(e) {
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
            this.connector_x = this.parent.position_x + this.c_total_offset_x;
            this.connector_y = this.parent.position_y + this.c_total_offset_y;
        }
        disconnectFromOutput() {
            this.peerOutput = null;
            this.dom?.classList.remove("connected");
        }
        connectToOutput(output) {
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
            }
            else if (this.inputDOM) {
                return this.inputValue();
            }
            return null;
        }
    }
    class OutputComponent extends ConnectorComponent {
        val;
        svgTmp;
        svgs;
        constructor(config, parent, globals, content) {
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
            this.g.canvas.appendChild(svg);
            this.setLineXY(line, input.connector_x - this.connector_x, input.connector_y - this.connector_y);
            this.parent.outputCount++;
            input.parent.inputCount++;
        }
        disconnectFromInput(input) {
            console.debug("Disconnecting from input: ", input);
            for (const svg of this.svgs) {
                if (svg.to == input) {
                    this.g.canvas.removeChild(svg.svg);
                    this.svgs = this.svgs.filter(s => s != svg);
                    this.g.globalLines = this.g.globalLines.filter(s => s != svg);
                    console.debug("Deleted line: ", svg);
                    break;
                }
            }
            input.disconnectFromOutput();
            this.parent.outputCount--;
            input.parent.inputCount--;
        }
        updateConnectorPosition() {
            // Update the position of the output connector
            this.connector_x = this.parent.position_x + this.c_total_offset_x;
            this.connector_y = this.parent.position_y + this.c_total_offset_y;
        }
        getValue() {
            this.parent.exec();
            return this.val;
        }
        setValue(val) {
            this.val = val;
        }
        moveToParent() {
            /* Called when lines need to be updated */
            this.updateConnectorPosition();
            if (this.svgTmp.line) {
                this.svgTmp.svg.style.transform = `translate3d(${this.connector_x}px, ${this.connector_y}px, 0)`;
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
            line.setAttribute('stroke-width', `${4 * this.g.zoom}`);
            svg.appendChild(line);
            this.updateConnectorPosition();
            svg.style.transform = `translate3d(${this.connector_x}px, ${this.connector_y}px, 0)`;
            this.g.canvas.appendChild(svg);
            return [svg, line];
        }
        customMouseDown(_) {
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
            const hn = this.g.hoverDOM;
            if (hn && hn.id && hn.id.startsWith('input-')) {
                const gid = hn.id.split('-')[1];
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
        domMouseUp() {
            const hn = this.g.hoverDOM;
            if (hn && hn.id && hn.id.startsWith('input-')) {
                console.debug("Connecting to input: ", hn.id);
                const input = this.g.globalNodes[hn.id.split('-')[1]];
                this.connectToInput(input);
                input.parent.findLeaf();
            }
            this.g.canvas.removeChild(this.svgTmp.svg);
            this.svgTmp = {
                svg: null,
                line: null
            };
        }
    }
    class uiComponent extends ComponentBase {
        parentContent;
        getUIvalue;
        setUIvalue;
        name;
        constructor(config, parent, globals, content) {
            super(config, parent, globals);
            this.parentContent = content;
            this.name = config.name;
            this.getUIvalue = () => { return null; };
            this.setUIvalue = (v) => { console.debug(v); };
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
                    this.setSetFunction((v) => { display.innerText = v; });
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
                    this.setGetFunction(() => { return dropdown.value; });
                    this.setExecTrigger(dropdown, 'change');
                    break;
            }
            this.dom = cont;
            if (this.name) {
                this.parent.elements[this.name] = this;
            }
        }
        setExecTrigger(dom, event) {
            dom.addEventListener(event, () => {
                this.parent?.findLeaf();
            });
            console.debug(dom, event);
        }
        setGetFunction(f) {
            this.getUIvalue = f;
        }
        setSetFunction(f) {
            this.setUIvalue = f;
        }
        getValue() {
            return this.getUIvalue();
        }
        setValue(val) {
            return this.setUIvalue(val);
        }
    }
    class customComponent extends ComponentBase {
        parentContent;
        getUIvalue;
        setUIvalue;
        constructor(config, parent, globals, content) {
            super(config, parent, globals);
            this.parentContent = content;
            this.getUIvalue = () => { return null; };
            this.setUIvalue = (v) => { console.debug(v); };
            const template = document.createElement('template');
            template.innerHTML = config.html.trim();
            this.dom = template.content.firstChild;
        }
        setExecTrigger(dom, event) {
            console.debug(dom, event);
        }
        setGetFunction(f) {
            this.getUIvalue = f;
        }
        setSetFunction(f) {
            this.setUIvalue = f;
        }
        getValue() {
            return this.getUIvalue();
        }
        setValue(val) {
            return this.setUIvalue(val);
        }
    }

    class NodeUI extends Base {
        config;
        inputs; // List of NodeInput classes for each input connector
        outputs; // List of NodeOutput classes for each output connector
        inputCount;
        outputCount;
        elements;
        dom;
        hasIandO;
        nodeWidth;
        nodeHeight;
        nodeContainerWidth;
        nodeContainerHeight;
        nodeContainerOffsetLeft;
        nodeContainerOffsetTop;
        functions;
        pan_start_x;
        pan_start_y;
        overlapping;
        constructor(config, globals, x = 0, y = 0) {
            super(globals);
            this.config = config;
            this.position_x = x;
            this.position_y = y;
            this.inputs = [];
            this.outputs = [];
            this.inputCount = 0;
            this.outputCount = 0;
            this.elements = {};
            this.pan_start_x = 0;
            this.pan_start_y = 0;
            this.overlapping = null;
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
                        if (element)
                            nodeContent.appendChild(element.dom);
                    }
                }
                else {
                    const element = this._initParseComponent(row, nodeContent);
                    if (element)
                        nodeContent.appendChild(element.dom);
                }
                nodeContainer.appendChild(nodeContent);
            }
            node.appendChild(nodeContainer);
            node.id = this.gid;
            node.onmousedown = this.domMouseDown.bind(this);
            this.dom = node;
            if (this.inputs.length > 0 && this.outputs.length > 0) {
                this.hasIandO = true;
            }
            else {
                this.hasIandO = false;
            }
            this.g.canvas.appendChild(node);
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
                    if (dict.functionInit !== undefined) {
                        dict.functionInit(this);
                    }
                }
            }
        }
        _initParseComponent(ui, content) {
            let u = null;
            switch (ui.type) {
                case 'input-text':
                case 'input-bool':
                    u = new InputComponent(ui, this, this.g, content);
                    u.parent = this;
                    this.g.globalNodes[u.gid] = u;
                    this.inputs.push(u);
                    break;
                case 'output-text':
                    u = new OutputComponent(ui, this, this.g, content);
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
        customMouseDown(e) {
            console.debug(e);
            this.pan_start_x = this.position_x;
            this.pan_start_y = this.position_y;
        }
        domMouseUp() {
            this.position_x = this.pan_start_x + this.g.dx / this.g.zoom;
            this.position_y = this.pan_start_y + this.g.dy / this.g.zoom;
            if (this.overlapping == null) {
                return;
            }
            const from = this.overlapping.from;
            const to = this.overlapping.to;
            const firstInput = this.inputs[0];
            const firstOutput = this.outputs[0];
            from.disconnectFromInput(to);
            from.connectToInput(firstInput);
            firstOutput.connectToInput(to);
        }
        onPan() {
            this.dom.style.transform = `translate3d(${this.position_x}px, ${this.position_y}px, 0)`;
            for (const input of this.inputs) {
                input.onPan();
            }
            for (const output of this.outputs) {
                output.onPan();
            }
        }
        onDrag() {
            this.position_x = this.pan_start_x + this.g.dx / this.g.zoom;
            this.position_y = this.pan_start_y + this.g.dy / this.g.zoom;
            this.dom.style.transform = `translate3d(${this.position_x}px, ${this.position_y}px, 0)`;
            for (const input of this.inputs) {
                input.nodeDrag();
            }
            for (const output of this.outputs) {
                output.nodeDrag();
            }
            this.overlapping = null;
            if (!this.hasIandO)
                return;
            if (this.outputCount > 0 || this.inputCount > 0)
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
            for (const n of this.g.nodeArray) {
                n.dom.classList.remove('focused');
                n.dom.style.zIndex = "10";
            }
            this.dom.classList.add('focused');
            this.dom.style.zIndex = "20";
        }
        offFocus() {
            this.dom.classList.remove('focused');
            this.dom.style.zIndex = "10";
        }
        updateDOMproperties() {
            this.nodeHeight = this.dom.offsetHeight;
            this.nodeWidth = this.dom.offsetWidth;
            for (const input of this.inputs) {
                input.updateDOMproperties();
            }
            for (const output of this.outputs) {
                output.updateDOMproperties();
            }
        }
        findLeaf() {
            let outputCount = 0;
            for (const [_, fData] of Object.entries(this.functions)) {
                for (const x of fData.outputs) {
                    const o = this.elements[x];
                    if (o == undefined) {
                        console.warn(`Output '${x}' was not found in elements. Double check '${x}' is defined.`);
                        return;
                    }
                    if (!o.svgs || o.svgs.length < 1) {
                        continue;
                    }
                    outputCount++;
                    for (const line of o.svgs) {
                        line.to.parent?.findLeaf();
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
                        const i = this.elements[x];
                        inputs.push(i.getValue());
                    }
                }
                const result = fData.functionUpdate(...inputs);
                for (const x of fData.outputs) {
                    const o = this.elements[x];
                    if (o == undefined) {
                        console.warn(`Output '${x}' was not found in elements. Double check '${x}' is defined.`);
                        return;
                    }
                    o.setValue(result);
                }
            }
        }
    }

    class SnapLine {
        g;
        constructor(canvasContainerID) {
            this.g = {
                canvas: null,
                canvasContainer: null,
                isMouseDown: false,
                mousedown_x: 0,
                mousedown_y: 0,
                mouse_x: 0,
                mouse_y: 0,
                camera_pan_start_x: 0,
                camera_pan_start_y: 0,
                dx: 0,
                dy: 0,
                dx_offset: 0,
                dy_offset: 0,
                camera_x: 0,
                camera_y: 0,
                zoom: 1,
                cameraWidth: 0,
                cameraHeight: 0,
                targetNode: null,
                hoverDOM: null,
                gid: 0,
                nodeArray: [],
                globalLines: [],
                globalNodes: {},
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
            const c = document.createElement('div');
            c.style.position = 'absolute';
            c.style.top = '0px';
            c.style.left = '0px';
            c.className = 'canvas';
            g.canvasContainer.appendChild(c);
            g.canvas = c;
            g.canvas.style.transform = `translate(${g.cameraWidth / 2}px, ${g.cameraHeight / 2}px)`;
            g.canvasContainer.addEventListener('mousedown', function (e) {
                g.isMouseDown = true;
                g.mousedown_x = e.clientX;
                g.mousedown_y = e.clientY;
                g.camera_pan_start_x = g.camera_x;
                g.camera_pan_start_y = g.camera_y;
                for (const node of g.nodeArray) {
                    node.offFocus();
                }
            });
            g.canvasContainer.addEventListener('mousemove', function (e) {
                g.hoverDOM = e.target;
                // get mouse position relative to canvas
                g.mouse_x = e.clientX - g.canvasContainer.offsetLeft;
                g.mouse_y = e.clientY - g.canvasContainer.offsetTop;
                if (g.isMouseDown) {
                    g.dx = e.clientX - g.mousedown_x + g.dx_offset;
                    g.dy = e.clientY - g.mousedown_y + g.dy_offset;
                    if (g.targetNode == null) {
                        g.camera_x = g.camera_pan_start_x - g.dx / g.zoom;
                        g.camera_y = g.camera_pan_start_y - g.dy / g.zoom;
                        g.canvas.style.transform = `matrix3d(${worldToCamera(g.camera_x, g.camera_y, g)})`;
                        //g.canvasContainer.style.backgroundPosition = -g.camera_x* g.zoom + "px " + -g.camera_y* g.zoom + "px";
                        g.canvas.style.cursor = "grabbing";
                    }
                }
            });
            g.canvasContainer.addEventListener('wheel', function (e) {
                const d_zoom = (1 * g.zoom) * (-e.deltaY / 600);
                e.preventDefault();
                if (g.zoom + d_zoom < 0.2) {
                    g.zoom = 0.2;
                    return;
                }
                else if (g.zoom + d_zoom > 3) {
                    g.zoom = 3;
                    return;
                }
                // Move the camera closer to the mouse while zooming 
                const d_zoom_x = (g.mouse_x - g.cameraWidth / 2) * d_zoom;
                const d_zoom_y = (g.mouse_y - g.cameraHeight / 2) * d_zoom;
                g.zoom += d_zoom;
                // Needs to be divided by g.zoom twice, 
                // once to account for the zoom itself, and once more because this value will be 
                // multiplied by g.zoom during worldToCamera()
                g.camera_x += d_zoom_x / g.zoom / g.zoom;
                g.camera_y += d_zoom_y / g.zoom / g.zoom;
                g.canvas.style.transform = `matrix3d(${worldToCamera(g.camera_x, g.camera_y, g)})`;
                // scale background image
                //g.canvasContainer.style.backgroundSize = g.zoom * 40 + "px " + g.zoom * 40 + "px";
                e.preventDefault();
            });
            g.canvasContainer.addEventListener('mouseup', function (_) {
                g.isMouseDown = false;
                g.canvas.style.cursor = "default";
                if (g.targetNode == null) ;
                else {
                    g.targetNode.domMouseUp();
                }
                g.targetNode = null;
                g.dx = 0;
                g.dy = 0;
                g.dx_offset = 0;
                g.dy_offset = 0;
            });
            console.info('Initialized SnapLine...');
            window.requestAnimationFrame(this.step.bind(this));
        }
        step() {
            if (this.g.targetNode) {
                this.g.targetNode.onDrag();
            }
            window.requestAnimationFrame(this.step.bind(this));
        }
        addNode(config, x, y) {
            const n = new NodeUI(config, this.g, x, y);
            this.g.globalNodes[n.gid] = n;
            return n;
        }
        deleteNode(id) {
            console.debug(id);
        }
        connectNodes(node0, outputID, node1, inputID) {
            console.debug(node0, outputID, node1, inputID);
        }
    }

    return SnapLine;

})();
//# sourceMappingURL=snapline.js.map
