
import { worldToCamera } from './helper.js';
import { GlobalStats, ObjectTypes, SnapLineDomType, mouseDownButton } from './types';
import { NodeComponent } from './components/node.js';
import { ConnectorComponent, OutputConnector } from './components/connector.js';

import './theme/standard_light.scss';
import './theme/standard_dark.scss';
import './theme/retro.scss';


export default class SnapLine {


    g: GlobalStats;
    containerStyle: { [key: string]: string } = {};
    canvasStyle: { [key: string]: string } = {};
    selectionBoxStyle: { [key: string]: string } = {};
    backgroundStyle: { [key: string]: string } = {};

    requestLineRender: OutputConnector | null = null;


    constructor() {

        this.g = null as any;

        this.containerStyle = {
            position: 'relative',
            overflow: 'hidden',
        };
        this.selectionBoxStyle = {
            position: 'absolute',
            pointerEvents: "none",
        };

        /* Public methods */
        this.initSnapLine = this.initSnapLine.bind(this);

    }


    initSnapLine(
        containerDom: HTMLElement,
        canvasDom: HTMLElement,
        backgroundDom: HTMLElement,
        selectionBoxDom: HTMLElement
    ) {

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
        }

        const g = this.g;

        g.cameraWidth = g.canvasContainer.clientWidth;
        g.cameraHeight = g.canvasContainer.clientHeight;

        console.debug(`Canvas size: ${g.cameraWidth}x${g.cameraHeight}`);

        this.setCanvasElementStyle(SnapLineDomType.canvas, {
            position: 'relative',
            top: '0px',
            left: '0px',
            transform: `translate(${g.cameraWidth / 2}px, ${g.cameraHeight / 2}px)`,
            width: '0px',
            height: '0px',
        });
        this.setCanvasElementStyle(SnapLineDomType.background, {
            width: (g.cameraWidth * 10) + 'px',
            height: (g.cameraHeight * 10) + 'px',
            transform: `translate(${-g.cameraWidth * 5}px, ${-g.cameraHeight * 5}px)`,
            transformOrigin: "center",
            zIndex: "0",
            position: "absolute",
        });

        this.renderCanvasElement(SnapLineDomType.container, this.containerStyle);
        this.renderCanvasElement(SnapLineDomType.canvas, this.canvasStyle);
        this.renderCanvasElement(SnapLineDomType.background, this.backgroundStyle);
        this.renderCanvasElement(SnapLineDomType.selectionBox, this.selectionBoxStyle);

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


    setCanvasElementStyle(domType: SnapLineDomType, newStyle: { [key: string]: string }) {

        switch (domType) {
            case SnapLineDomType.canvas:
                this.canvasStyle = Object.assign({}, this.canvasStyle, newStyle);
                this.canvasStyle._requestUpdate = "true";
                break;
            case SnapLineDomType.container:
                this.containerStyle = Object.assign({}, this.containerStyle, newStyle);
                this.containerStyle._requestUpdate = "true";
                break;
            case SnapLineDomType.background:
                this.backgroundStyle = Object.assign({}, this.backgroundStyle, newStyle);
                this.backgroundStyle._requestUpdate = "true";
                break;
            case SnapLineDomType.selectionBox:
                this.selectionBoxStyle = Object.assign({}, this.selectionBoxStyle, newStyle);
                this.selectionBoxStyle._requestUpdate = "true";
                break;
            default:
                console.error("Invalid dom type: " + domType);
                return;
        }
    }


    renderCanvasElement(domType: SnapLineDomType, style: { [key: string]: string }) {

        let dom: HTMLElement | null = null;
        if (this.g == null) {
            return;
        }
        switch (domType) {
            case SnapLineDomType.canvas:
                dom = this.g.canvas;
                break;
            case SnapLineDomType.container:
                dom = this.g.canvasContainer;
                break;
            case SnapLineDomType.background:
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

        if (style._requestUpdate != "true") {
            return;
        }

        for (const key in style) {
            dom.style[<any>key] = style[key];
        }

        style._requestUpdate = "false";
    }

    /* Event handlers */

    onTouchStart(e: TouchEvent) {

        /* If multiple touches are detected, treat it as a middle mouse button press (pan camera) */
        if (e.touches.length > 1) {

            /* If there was only one touch previously, it means up until now it has been handled as a mouse press or drag.
             * Call the cursor up handler to reset the state */
            if (this.g.prevTouches!.length == 1) {
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


    onMouseDown(e: MouseEvent) {
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
    onCursorDown(button: mouseDownButton, clientX: number, clientY: number) {

        this.g.currentMouseDown = button;

        console.debug("Cursor down: " + button);

        /*  If the user is dragging a line when another cursor down event is detected, then the line should be deleted. */
        if (this.g.targetObject && this.g.targetObject.type == ObjectTypes.outputConnector) {
            console.debug("Cursor down with tmp line");
            // const output_gid = tmpLine.getAttribute('output-gid');
            // if (output_gid != null) {
            //     console.debug("Cursor down with tmp line and output gid: " + output_gid);
            //     const output = this.g.globalNodeTable[output_gid!];
            //     if (output) {
            //         output.domCursorUp();
            //         this.onCursorUp();
            //     }
            // }
            const output = <OutputConnector>this.g.targetObject;
            output.domCursorUp();

        }

        const g = this.g;

        if (g.overrideDrag) {
            return;
        }

        console.debug("Cursor ddown");

        /* Reset the selection box */
        if (g.currentMouseDown != mouseDownButton.none) {
            this.setCanvasElementStyle(SnapLineDomType.selectionBox, {
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



    onTouchMove(e: TouchEvent) {

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
            if (cur1.identifier == this.g.prevTouches![i].identifier) {
                prev1 = this.g.prevTouches![i];
            } else if (cur2.identifier == this.g.prevTouches![i].identifier) {
                prev2 = this.g.prevTouches![i];
            }
        }

        let curDistance = Math.sqrt(Math.pow(cur1.clientX - cur2.clientX, 2) + Math.pow(cur1.clientY - cur2.clientY, 2));
        let prevDistance = Math.sqrt(Math.pow(prev1!.clientX - prev2!.clientX, 2) + Math.pow(prev1!.clientY - prev2!.clientY, 2));
        let d_zoom = -2 * (curDistance - prevDistance);

        let middle_x = (cur1.clientX + cur2.clientX) / 2;
        let middle_y = (cur1.clientY + cur2.clientY) / 2;

        let newMouseX = middle_x - this.g.canvasContainer!.offsetLeft;
        let newMouseY = middle_y - this.g.canvasContainer!.offsetTop;

        this.onCursorMove(document.elementFromPoint(newMouseX, newMouseY), newMouseX, newMouseY);

        this.g.mouse_x = newMouseX;
        this.g.mouse_y = newMouseY;

        this.onZoom(d_zoom);
        this.g.prevTouches = e.touches;

        return;
    }

    onMouseMove(e: MouseEvent) {
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
    onCursorMove(target: EventTarget | null, clientX: number, clientY: number) {

        const g = this.g;

        console.debug("Cursor move");

        g.hoverDOM = target;
        g.mouse_x = clientX - g.canvasContainer!.offsetLeft;
        g.mouse_y = clientY - g.canvasContainer!.offsetTop;

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

                this.setCanvasElementStyle(SnapLineDomType.canvas, {
                    transform: `matrix3d(${worldToCamera(g.camera_x, g.camera_y, g)})`,
                    cursor: "grabbing",
                });
                this.setCanvasElementStyle(SnapLineDomType.background, {
                    transform: `translate(${g.camera_x + -g.cameraWidth * 5}px, ${g.camera_y + -g.cameraHeight * 5}px)`,
                    backgroundPosition: `${-g.camera_x}px ${-g.camera_y}px`,
                });
            } else if (g.currentMouseDown == mouseDownButton.left) {
                // Select multiple boxes if left mouse button is pressed
                this.setCanvasElementStyle(SnapLineDomType.selectionBox, {
                    width: Math.abs(g.dx) + 'px',
                    height: Math.abs(g.dy) + 'px',
                    left: Math.min(g.mousedown_x, g.mouse_x) + 'px',
                    top: Math.min(g.mousedown_y, g.mouse_y) + 'px',
                    opacity: "1",
                });
                // Check if any nodes are inside the selection box
                let w_x_start = (Math.min(g.mousedown_x, g.mouse_x) - g.cameraWidth / 2) / g.zoom + g.camera_x;
                let w_y_start = (Math.min(g.mousedown_y, g.mouse_y) - g.cameraHeight / 2) / g.zoom + g.camera_y;

                let w_x_end = (Math.max(w_x, g.mousedown_x, g.mouse_x) - g.cameraWidth / 2) / g.zoom + g.camera_x;
                let w_y_end = (Math.max(w_y, g.mousedown_y, g.mouse_y) - g.cameraHeight / 2) / g.zoom + g.camera_y;

                let selectedNodes = [];

                /* Focus on nodes that are inside the selection box */
                for (const node of g.globalNodeList) {
                    if (node.positionX + node.nodeWidth > w_x_start && node.positionX < w_x_end && node.positionY + node.nodeHeight > w_y_start && node.positionY < w_y_end) {
                        node.onFocus();
                        selectedNodes.push(node);
                    } else {
                        node.offFocus();
                    }
                }
                g.focusNodes = selectedNodes;
            }
        } else {
            /* If an object is selected, then this drag is for that object */
            if (g.targetObject.type == ObjectTypes.node) {
                /* If the object being dragged is a node, then handle mouse move for all selected nodes */
                for (const node of g.focusNodes) {
                    node.onDrag();
                }
            } else {
                /* Otherwise, just handle mouse move for the selected object */
                g.targetObject.onDrag();
            }

        }

    }

    onMouseUp(_: MouseEvent) {
        this.onCursorUp();
    }

    onTouchEnd(_: TouchEvent) {
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
                this.setCanvasElementStyle(SnapLineDomType.selectionBox, {
                    width: '0px',
                    height: '0px',
                    left: '0px',
                    top: '0px',
                });
            } else if (g.targetObject.type == ObjectTypes.node) {
                /* If the object being dragged is a node, then handle mouse up for all selected nodes */
                for (const node of g.focusNodes) {
                    console.debug("Mouse up with target node: " + node.gid);
                    node.domCursorUp();
                }
            } else {
                /* Otherwise, just handle mouse up for the selected object */
                g.targetObject.domCursorUp();
            }

            if (g.targetObject?.type == ObjectTypes.outputConnector) {
                this.requestLineRender = <OutputConnector>g.targetObject;
            }
        }

        g.currentMouseDown = mouseDownButton.none;

        if (g.overrideDrag) {
            this.setCanvasElementStyle(SnapLineDomType.canvas, {
                cursor: "default",
            });
        }

        g.overrideDrag = false;
        this.setCanvasElementStyle(SnapLineDomType.background, {
            cursor: "default",
        });

        g.targetObject = null;
        g.dx = 0;
        g.dy = 0;
        g.dx_offset = 0;
        g.dy_offset = 0;

        g.mouseHasMoved = false;

    }


    onWheel(e: WheelEvent) {
        this.onZoom(e.deltaY);
        e.preventDefault();
    }


    onZoom(deltaY: number = 0) {
        const g = this.g;

        let d_zoom = (1 * g.zoom) * (-deltaY / 1000);

        if (g.zoom + d_zoom < 0.2) {
            d_zoom = 0.2 - g.zoom;
        } else if (g.zoom + d_zoom > 1) {
            d_zoom = 1 - g.zoom;
        }

        let dz = g.zoom / (g.zoom + d_zoom);

        let camera_dx = (g.cameraWidth / g.zoom * (dz - 1)) * (1 - (g.cameraWidth * 1.5 - g.mouse_x) / g.cameraWidth);
        let camera_dy = (g.cameraHeight / g.zoom * (dz - 1)) * (1 - (g.cameraHeight * 1.5 - g.mouse_y) / g.cameraHeight);
        g.zoom += d_zoom;

        g.camera_x -= camera_dx;
        g.camera_y -= camera_dy;

        this.setCanvasElementStyle(SnapLineDomType.canvas, {
            transform: `matrix3d(${worldToCamera(g.camera_x, g.camera_y, g)})`,
        });

    }


    onKeyDown(e: KeyboardEvent) {
        console.debug("Keydown: " + e.key);
        switch (e.key) {
            case 'Backspace':
            case 'Delete':

                if (this.g.targetObject?.type != ObjectTypes.node) {
                    return;
                }

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

    renderElements() {
        const target: any = this.g.targetObject;

        if (!this.requestLineRender && target?.type == ObjectTypes.outputConnector) {
            this.requestLineRender = <OutputConnector>target;
        }

        if (target?.type == ObjectTypes.node) {
            for (const node of this.g.focusNodes) {
                node.renderNode(node.nodeStyle);
            }
        } else if (this.requestLineRender) {
            let output: OutputConnector = this.requestLineRender;
            output.renderAllLines(output.svgLines);
            output.svgLines = output.svgLines.filter((line) => !line.requestDelete);

        }
    }


    step() {
        this.renderElements();
        this.renderCanvasElement(SnapLineDomType.container, this.containerStyle);
        this.renderCanvasElement(SnapLineDomType.canvas, this.canvasStyle);
        this.renderCanvasElement(SnapLineDomType.background, this.backgroundStyle);
        this.renderCanvasElement(SnapLineDomType.selectionBox, this.selectionBoxStyle);

        window.requestAnimationFrame(this.step.bind(this));
    }


    addNodeObject(): [NodeComponent, { [key: string]: NodeComponent | ConnectorComponent }] {
        const n: NodeComponent = new NodeComponent(null, this.g);
        this.g.globalNodeTable[n.gid] = n;
        return [n, this.g.globalNodeTable];
    }


    createNode(dom: HTMLElement) {
        const n: NodeComponent = new NodeComponent(dom, this.g);
        this.g.globalNodeTable[n.gid] = n;

        // n.domMouseDown();
        // n.onDrag();
        // n.domMouseUp();
        return n;
    }


    createNodeAuto(dom: HTMLElement) {
        const n: NodeComponent = new NodeComponent(dom, this.g);
        this.g.globalNodeTable[n.gid] = n;

        // Get all 'sl-input' elements
        const inputs = dom.querySelectorAll('.sl-input');
        for (let i = 0; i < inputs.length; i++) {
            const inputDom = inputs[i];
            const inputName = inputDom.getAttribute('sl-name');
            const input = n.addInputForm(<HTMLElement>inputDom, inputName!);


            // Loop through all attributes for ones that start with 'sl-event:<event>'
            // If the attribute is found, add an event listener to the input connector
            for (let j = 0; j < inputDom.attributes.length; j++) {
                const attr = inputDom.attributes[j];
                if (attr.name.startsWith('sl-event:')) {
                    const event = attr.name.split(':')[1];
                    const func = window[attr.value as keyof Window];
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
            const input = n.addInputConnector(<HTMLElement>connector, connectorName!);

            const updateFuncName = connector.getAttribute('sl-update');
            console.debug("Update function: " + updateFuncName);
            if (updateFuncName != null || updateFuncName != undefined) {
                console.debug("Update function: " + updateFuncName, input);

                const updateFunc = window[updateFuncName! as keyof Window];
                input.updateFunction = updateFunc.bind(input);
            }


        }

        // Get all 'sl-output-connector' elements
        const outputs = dom.querySelectorAll('.sl-output-connector');
        for (let i = 0; i < outputs.length; i++) {
            const output = outputs[i];
            const outputName = output.getAttribute('sl-name');
            n.addOutputConnector(<HTMLElement>output, outputName!);
        }

        for (let j = 0; j < dom.attributes.length; j++) {
            const attr = dom.attributes[j];
            if (attr.name.startsWith('sl-init')) {
                const func = window[attr.value as keyof Window];
                console.debug("Calling init func: " + func);
                func.bind(n)();
            }
        }



        return n;
    }

    addNode(node: NodeComponent, x: number, y: number) {

        node.addNodeToCanvas(x, y);
        // n.domMouseDown();
        // n.onDrag();
        // n.domMouseUp();

    }

    addNodeAtMouse(node: NodeComponent, e: MouseEvent) {

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

    deleteNode(id: string) {
        if (!(id in this.g.globalNodeTable)) {
            console.error("Node not found: " + id);
            return null;
        }
        this.g.globalNodeTable[id].destroy();
        delete this.g.globalNodeTable[id];
        return id;
    }

    focusNode(id: string) {
        if (!(id in this.g.globalNodeTable)) return null;
        const node = this.g.globalNodeTable[id];
        node.onFocus();
        return id;
    }

    connectNodes(node0: string, outputID: string, node1: string, inputID: string) {
        const n0 = this.g.globalNodeTable[node0];
        const n1 = this.g.globalNodeTable[node1];
        if (!n0 || !n1 || !(n0 instanceof NodeComponent) || !(n1 instanceof NodeComponent)) {
            return null;
        }
        const o = n0.findOutput(outputID);
        const i = n1.findInput(inputID);

        if (!o || !i) return null;

        o.connectToInput(i);

        return 0;
    }


}
