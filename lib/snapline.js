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
        //label.style.position = "relative";
        label.style.zIndex = "99";
        dom.appendChild(label);
        return label;
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
     * Connector components are the elements that are used to connect nodes.
     */
    class ConnectorComponent extends ComponentBase {
        connector_x; // Location of the connector on canvas
        connector_y;
        c_total_offset_x; // Location of the connector relative to the location of parent Node
        c_total_offset_y;
        name;
        constructor(config, parent, globals) {
            super(config, parent, globals);
            this.connector_x = 0;
            this.connector_y = 0;
            this.c_total_offset_x = 0;
            this.c_total_offset_y = 0;
            this.dom = null;
            //this.parentContent = parentContent;
            if (config.name) {
                this.name = config.name;
            }
            else {
                globals.gid++;
                this.name = globals.gid.toString();
            }
            this.g.globalNodes[this.gid] = this;
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
        inputDOM; // Reference to the UI element where the user enters the value
        inter;
        peerOutput;
        constructor(config, parent, globals, inter) {
            super(config, parent, globals);
            this.inter = inter;
            this.inputDOM = null;
            this.peerOutput = null;
            const connector = document.createElement('span');
            connector.classList.add('sl-input-connector');
            connector.id = `input-${this.gid}`;
            connector.onmousedown = this.domMouseDown.bind(this);
            connector.ontouchstart = this.domTouchStart.bind(this);
            this.dom = connector;
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
            this.inter.dom.classList.remove("connected");
            this.inter.inputUI?.inputDOM?.setAttribute('disabled', 'false');
        }
        connectToOutput(output) {
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
        destroy() {
            if (this.peerOutput) {
                this.peerOutput.disconnectFromInput(this);
            }
        }
    }
    class OutputConnector extends ConnectorComponent {
        val;
        svgTmp;
        svgs;
        peerInputs = [];
        constructor(config, parent, globals) {
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
            this.bindFunction(connector);
            this.dom = connector;
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
        createNewSVG(isTmp = false) {
            console.debug("Creating new SVG");
            // create a new svg path
            const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
            svg.classList.add('sl-connector-svg');
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
            console.debug("Dragging connector", this.g.hoverDOM);
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
        domCursorUp() {
            console.debug(`connector domMouseUp`);
            const hn = this.g.hoverDOM;
            if (hn && hn.id && hn.id.startsWith('input-')) {
                console.debug("Connecting to input: ", hn.id);
                const input = this.g.globalNodes[hn.id.split('-')[1]];
                this.connectToInput(input);
                input.parent.run();
            }
            console.debug(this.svgTmp.svg.classList);
            this.g.canvas.removeChild(document.querySelector('.sl-connector-svg.tmp'));
            this.svgTmp = {
                svg: null,
                line: null
            };
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
            for (const svg of this.svgs) {
                console.debug("Removing svg: ", svg);
                this.g.canvas.removeChild(svg.svg);
            }
            //this.g.canvas?.removeChild(this.dom!);
        }
    }

    class InputUI extends ComponentBase {
        inputDOM;
        inputItf;
        constructor(config, parent, globals, inputItf) {
            super(config, parent, globals);
            this.inputDOM = null;
            this.inputItf = inputItf;
        }
        triggerExec(_) {
            this.inputItf.parent?.run();
        }
    }
    class InputUiText extends InputUI {
        constructor(config, parent, globals, inputItf) {
            super(config, parent, globals, inputItf);
            addLabel(inputItf.dom, config);
            const inp = document.createElement('input');
            inp.classList.add('sl-input-text');
            inp.type = 'text';
            inputItf.dom.appendChild(inp);
            this.inputDOM = inp;
            inp.onkeyup = this.triggerExec.bind(this);
        }
        getInputValue() {
            return this.inputDOM.value;
        }
    }
    class InputUiBool extends InputUI {
        constructor(config, parent, globals, inputItf) {
            super(config, parent, globals, inputItf);
            addLabel(inputItf.dom, config);
            const inp = document.createElement('input');
            inp.classList.add('sl-input-bool');
            inp.type = 'checkbox';
            inputItf.dom.appendChild(inp);
            this.inputDOM = inp;
            inp.onkeyup = this.triggerExec.bind(this);
        }
        getInputValue() {
            return this.inputDOM.checked;
        }
    }
    class InputUiFloat extends InputUI {
        cur_w;
        x_cur;
        x_min;
        x_max;
        slider_w;
        floatSliderContainer;
        floatSlider;
        floatEditor;
        floatContainer;
        constructor(config, parent, globals, inputItf) {
            super(config, parent, globals, inputItf);
            this.x_cur = 0;
            this.x_min = ('x_min' in config) ? config.x_min : 0;
            this.x_max = ('x_max' in config) ? config.x_max : this.x_min + 1;
            this.slider_w = 0;
            this.cur_w = 0;
            const floatContainer = document.createElement('div');
            const floatEditor = document.createElement('input');
            const floatSliderContainer = document.createElement('div');
            const floatSlider = document.createElement('div');
            floatContainer.classList.add('sl-input-float-container');
            floatContainer.style.position = "relative";
            floatContainer.style.overflow = "hidden";
            floatContainer.style.flexGrow = "1";
            floatContainer.style.display = "flex";
            floatEditor.classList.add('sl-input-float-editor');
            floatEditor.style.backgroundColor = "transparent";
            floatEditor.style.position = "relative";
            floatEditor.style.width = "100%";
            //floatEditor.style.height = "100%";
            floatEditor.type = 'text';
            floatEditor.style.textAlign = "right";
            floatEditor.style.zIndex = "10";
            floatSliderContainer.classList.add('sl-input-float-slider-container');
            floatSliderContainer.style.position = "relative";
            floatSliderContainer.style.zIndex = "1";
            //floatSliderContainer.style.height = "100%";
            floatSliderContainer.style.overflow = "hidden";
            //floatSliderContainer.style.width = "100%";
            //floatSliderContainer.style.top = '0px';
            floatSlider.classList.add('sl-input-float-slider');
            floatSlider.style.width = "10px";
            floatSlider.style.height = "100%";
            floatSlider.style.top = "0px";
            floatSlider.style.left = "0";
            floatSlider.style.position = "absolute";
            floatSlider.style.zIndex = "10";
            floatSliderContainer.appendChild(floatSlider);
            addLabel(floatContainer, config);
            floatContainer.appendChild(floatSliderContainer);
            floatSliderContainer.appendChild(floatEditor);
            inputItf.dom.appendChild(floatContainer);
            this.inputDOM = floatEditor;
            floatEditor.onchange = this.triggerExec.bind(this);
            floatSlider.onmousedown = this.triggerExec.bind(this);
            this.floatSlider = floatSlider;
            this.floatEditor = floatEditor;
            this.floatContainer = floatContainer;
            this.floatSliderContainer = floatSliderContainer;
            this.bindFunction(floatContainer);
        }
        customMouseDown() {
            this.cur_w = parseInt(this.floatSlider.style.width, 10);
            this.slider_w = this.floatSliderContainer.getBoundingClientRect().width / this.g.zoom;
            console.log(this.slider_w);
            this.floatEditor.blur();
        }
        onDrag() {
            this.floatEditor.blur();
            //const diff = (this.x_max - this.x_min)/this.slider_w;
            const inc = 50;
            const v_inc = (this.x_max - this.x_min) / inc;
            const s_inc = this.slider_w / inc;
            let slider_cur = this.cur_w + this.g.dx / this.g.zoom;
            slider_cur = Math.ceil(slider_cur / s_inc) * s_inc;
            slider_cur = Math.min(Math.max(slider_cur, 0), this.slider_w);
            this.floatSlider.style.width = slider_cur + 'px';
            this.x_cur = Math.min(Math.max(this.x_min + slider_cur / this.slider_w, this.x_min), this.x_max);
            this.x_cur = Math.ceil(this.x_cur / v_inc) * v_inc;
            this.floatEditor.value = this.x_cur.toFixed(3);
            this.inputItf.parent?.run();
        }
        domMouseUp() {
            this.floatEditor.focus();
        }
        getInputValue() {
            return parseFloat(this.inputDOM.value);
        }
    }
    class InputUiFloatInfinite extends InputUI {
        x_cur;
        floatSliderContainer;
        floatEditor;
        floatContainer;
        constructor(config, parent, globals, inputItf) {
            super(config, parent, globals, inputItf);
            this.x_cur = 0;
            const floatContainer = document.createElement('div');
            const floatEditor = document.createElement('input');
            const floatSliderContainer = document.createElement('div');
            floatContainer.classList.add('sl-input-float-container');
            floatContainer.style.position = "relative";
            floatContainer.style.overflow = "hidden";
            floatContainer.style.flexGrow = "1";
            floatContainer.style.display = "flex";
            floatEditor.classList.add('sl-input-float-editor');
            floatEditor.style.backgroundColor = "transparent";
            floatEditor.style.position = "relative";
            floatEditor.style.width = "100%";
            //floatEditor.style.height = "100%";
            floatEditor.type = 'text';
            floatEditor.style.textAlign = "right";
            floatEditor.style.zIndex = "10";
            floatSliderContainer.classList.add('sl-input-float-slider-container');
            floatSliderContainer.style.position = "relative";
            floatSliderContainer.style.zIndex = "1";
            //floatSliderContainer.style.height = "100%";
            floatSliderContainer.style.overflow = "hidden";
            //floatSliderContainer.style.width = "100%";
            //floatSliderContainer.style.top = '0px';
            addLabel(floatContainer, config);
            floatContainer.appendChild(floatSliderContainer);
            floatSliderContainer.appendChild(floatEditor);
            inputItf.dom.appendChild(floatContainer);
            this.inputDOM = floatEditor;
            floatEditor.onchange = this.triggerExec.bind(this);
            this.floatEditor = floatEditor;
            this.floatContainer = floatContainer;
            this.floatSliderContainer = floatSliderContainer;
            this.bindFunction(floatContainer);
        }
        customMouseDown() {
            this.x_cur = parseFloat(this.floatEditor.value) || 0;
            this.floatEditor.blur();
        }
        onDrag() {
            this.floatEditor.blur();
            const inc = 0.1;
            let cur = Math.ceil((this.x_cur + this.g.dx * 0.1) / inc) * inc;
            this.floatEditor.value = cur.toFixed(3);
            this.inputItf.parent?.run();
        }
        domMouseUp() {
            this.floatEditor.focus();
        }
        getInputValue() {
            return parseFloat(this.inputDOM.value);
        }
    }

    /**
     * Each UX element in a node, such as a text input or a button, is an interface.
     */
    class Interface extends ComponentBase {
        name;
        constructor(config, parent, globals) {
            super(config, parent, globals);
            this.name = config.name;
            this.parent.elements[this.name] = this;
        }
    }
    class InputInterface extends Interface {
        input;
        inputUI;
        name;
        constructor(config, parent, globals) {
            super(config, parent, globals);
            const input = document.createElement('div');
            input.classList.add('sl-input');
            input.style.position = 'relative';
            this.input = new InputConnector(config, parent, globals, this);
            input.appendChild(this.input.dom);
            this.dom = input;
            this.name = config.name;
            this.parent.elements[this.name] = this;
            switch (config.type) {
                case 'input-text':
                    this.inputUI = new InputUiText(config, parent, globals, this);
                    break;
                case 'input-bool':
                    this.inputUI = new InputUiBool(config, parent, globals, this);
                    break;
                case 'input-float':
                    this.inputUI = new InputUiFloat(config, parent, globals, this);
                    break;
                case 'input-float-infinite':
                    this.inputUI = new InputUiFloatInfinite(config, parent, globals, this);
                    break;
                default:
                    this.inputUI = null;
            }
            this.bindFunction(this.dom);
        }
        // updateConnectorPosition() {
        //     this.connector_x = this.parent!.position_x + this.c_total_offset_x;
        //     this.connector_y = this.parent!.position_y + this.c_total_offset_y;
        // }
        // disconnectFromOutput() {
        //     this.peerOutput = null;
        //     this.dom?.classList.remove("connected");
        // }
        // connectToOutput(output: OutputComponent) {
        //     this.peerOutput = output;
        //     this.dom?.classList.add("connected");
        // }
        // nodeDrag() {
        //     this.updateConnectorPosition();
        //     if (!this.peerOutput) {
        //         return;
        //     }
        //     this.peerOutput.nodeDrag();
        // }
        getValue() {
            if (this.input.peerOutput) {
                return this.input.peerOutput.getValue();
            }
            else if (this.inputUI) {
                return this.inputUI.getInputValue();
            }
            return null;
        }
        destroy() {
            this.input.destroy();
        }
    }
    class OutputInterface extends Interface {
        output;
        name;
        constructor(config, parent, globals) {
            super(config, parent, globals);
            const out = document.createElement('div');
            out.classList.add('sl-output');
            out.style.position = 'relative';
            addLabel(out, config);
            this.output = new OutputConnector(config, parent, globals);
            out.appendChild(this.output.dom);
            this.dom = out;
            this.name = config.name;
            this.parent.elements[this.name] = this;
        }
        getValue() {
            this.parent.exec();
            return this.output.val;
        }
        setValue(val) {
            this.output.val = val;
        }
        destroy() {
            this.output.destroy();
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
                this.parent?.run();
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
        freeze;
        type;
        constructor(config, globals, x = 0, y = 0) {
            super(globals);
            this.config = config;
            this.position_x = x; // - this.g.cameraWidth / 2;
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
            this.type = ObjectTypes.node;
            //this.g.mouseHasMoved = false;
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
            this.bindFunction(node);
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
            this.dom.style.transform = `translate3d(${this.position_x}px, ${this.position_y}px, 0)`;
        }
        findInput(id) {
            for (const o of this.inputs) {
                if (o.gid === id)
                    return o;
            }
            return null;
        }
        findOutput(id) {
            for (const o of this.outputs) {
                if (o.gid === id)
                    return o;
            }
            return null;
        }
        _initParseComponent(ui, content) {
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
        setStartPositions() {
            this.pan_start_x = this.position_x;
            this.pan_start_y = this.position_y;
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
            //this.g.focusNodes.push(this);
        }
        domCursorUp() {
            //console.debug("Node domMouseUp: " + this.gid + ", targetObject: " + this.g.targetObject.gid + ", focusNodes: " + this.g.focusNodes);
            if (this.freeze)
                return;
            this.position_x = this.pan_start_x + this.g.dx / this.g.zoom;
            this.position_y = this.pan_start_y + this.g.dy / this.g.zoom;
            // If the mouse has not moved since being pressed, then it is a regular click
            // Unselect other nodes in focusNodes
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
            // this.g.mouseHasMoved = false;
            if (this.overlapping == null) {
                return;
            }
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
            this.position_x = this.pan_start_x + this.g.dx / this.g.zoom;
            this.position_y = this.pan_start_y + this.g.dy / this.g.zoom;
            // console.debug(`onDrag ${this.position_x} ${this.position_y} ${this.pan_start_x} ${this.pan_start_y} `);
            // console.debug(`onDrag ${this.g.dx} ${this.g.dy} ${this.g.zoom} `);
            // console.debug(`onDrag ${this.position_x} ${this.position_y}`);
            this.dom.style.transform = `translate3d(${this.position_x}px, ${this.position_y}px, 0)`;
            for (const input of this.inputs) {
                input.input.nodeDrag();
            }
            for (const output of this.outputs) {
                output.output.nodeDrag();
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
            // for (const n of this.g.nodeArray) {
            //     n.dom.classList.remove('focused');
            //     n.dom.style.zIndex = "10";
            // }
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
        run() {
            let outputCount = 0;
            for (const [_, fData] of Object.entries(this.functions)) {
                for (const x of fData.outputs) {
                    const o = this.elements[x];
                    if (o == undefined) {
                        console.warn(`Output '${x}' was not found in elements. Double check '${x}' is defined.`);
                        return;
                    }
                    if (!o.output.svgs || o.output.svgs.length < 1) {
                        continue;
                    }
                    outputCount++;
                    for (const line of o.output.svgs) {
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
                        const i = this.elements[x];
                        inputs.push(i.getValue());
                    }
                }
                const result = fData.functionUpdate(...inputs);
                let i = 0;
                for (const x of fData.outputs) {
                    const o = this.elements[x];
                    if (o == undefined) {
                        console.warn(`Output '${x}' was not found in elements. Double check '${x}' is defined.`);
                        return;
                    }
                    if (result instanceof Array) {
                        o.setValue(result[i++]);
                    }
                    else {
                        o.setValue(result);
                    }
                }
            }
        }
        destroy() {
            this.g.canvas?.removeChild(this.dom);
            for (const input of this.inputs) {
                input.destroy();
            }
            for (const output of this.outputs) {
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
            let element = document.elementFromPoint(e.touches[0].clientX, e.touches[0].clientY);
            this.onCursorMove(element, e.touches[0].clientX, e.touches[0].clientY);
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
                    // Pan camera id middle mouse button is pressed
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
            const g = this.g;
            e.preventDefault();
            let d_zoom = (1 * g.zoom) * (-e.deltaY / 1000);
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
        addNode(config, x, y) {
            const n = new NodeUI(config, this.g, x, y);
            this.g.globalNodes[n.gid] = n;
            this.focusNode(n.gid);
            // n.domMouseDown();
            // n.onDrag();
            // n.domMouseUp();
            return n;
        }
        addNodeAtMouse(config, e) {
            this.g.ignoreMouseUp = true;
            let x = this.g.mouse_x_world;
            let y = this.g.mouse_y_world;
            console.debug("Adding node at " + x + ", " + y);
            let n = this.addNode(config, x, y);
            this.g.currentMouseDown = mouseDownButton.left;
            this.g.mousedown_x = this.g.mouse_x;
            this.g.mousedown_y = this.g.mouse_y;
            this.g.camera_pan_start_x = this.g.camera_x;
            this.g.camera_pan_start_y = this.g.camera_y;
            this.g.overrideDrag = true;
            this.g.focusNodes = [n];
            this.g.targetObject = n;
            for (const node of this.g.nodeArray) {
                node.offFocus();
            }
            this.onMouseMove(e);
            this.g.canvasBackground.style.cursor = "none";
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
            if (!n0 || !n1 || !(n0 instanceof NodeUI) || !(n1 instanceof NodeUI)) {
                return null;
            }
            const o = n0.findOutput(outputID);
            const i = n1.findInput(inputID);
            if (!o || !i)
                return null;
            o.output.connectToInput(i.input);
            return 0;
        }
    }

    return SnapLine;

})();
