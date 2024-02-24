
import { worldToCamera } from './helper.js';
import { GlobalStats, NodeConfig, ObjectTypes, mouseDownButton } from './types';
import { NodeUI } from './components/node.js';

export default class SnapLine {

    g: GlobalStats;

    constructor(canvasContainerID: string) {

        this.g = {
            canvas: null,
            canvasContainer: null,
            canvasBackground: null,
            currentMouseDown: mouseDownButton.none,
            mousedown_x: 0,         // Initial mouse  position when mouse is pressed
            mousedown_y: 0,
            mouse_x: 0,             // Current mouse position
            mouse_y: 0,
            mouse_x_world: 0,       // Current mouse position, in world space
            mouse_y_world: 0,
            camera_pan_start_x: 0,  // Initial camera position when camera is being panned
            camera_pan_start_y: 0,
            dx: 0,                  // How much the mouse has moved since being pressed
            dy: 0,
            dx_offset: 0,           // Offset for dx and dy
            dy_offset: 0,

            overrideDrag: false,

            camera_x: 0,
            camera_y: 0,
            zoom: 1,
            cameraWidth: 0,
            cameraHeight: 0,

            targetObject: null,      // Node that is currently being dragged
            focusNodes: [],      // Node that is currently focused
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
        }
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

    onTouchStart(e: TouchEvent) {

        // else if (Date.now() - this.g.prevSingleTouchTime > 300) {
        //     this.g.prevSingleTouchTime = 0;
        //     this.onCursorDown(1, e.touches[0].clientX, e.touches[0].clientY);
        //     return;
        // }

        if (e.touches.length > 1) {
            if (this.g.prevTouches!.length == 1) {
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

    onMouseDown(e: MouseEvent) {
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
    onCursorDown(button: number, clientX: number, clientY: number) {

        console.debug("Cursor down: " + button);

        const g = this.g;

        if (g.overrideDrag) {
            return;
        }

        // Handle cases where a mouse button is already pressed
        if (g.currentMouseDown != mouseDownButton.none) {
            g.selectionBox!.style.width = '0px';
            g.selectionBox!.style.height = '0px';
            g.selectionBox!.style.left = '0px';
            g.selectionBox!.style.top = '0px';
        }

        if (button == 1) {
            g.currentMouseDown = mouseDownButton.middle;
        } else if (button == 0) {
            g.currentMouseDown = mouseDownButton.left;
        } else {
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

    onMouseMove(e: MouseEvent) {
        this.onCursorMove(e.target, e.clientX, e.clientY);
    }

    onTouchMove(e: TouchEvent) {

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
                if (cur1.identifier == this.g.prevTouches![i].identifier) {
                    prev1 = this.g.prevTouches![i];
                } else if (cur2.identifier == this.g.prevTouches![i].identifier) {
                    prev2 = this.g.prevTouches![i];
                }
            }

            let curDistance = Math.sqrt(Math.pow(cur1.clientX - cur2.clientX, 2) + Math.pow(cur1.clientY - cur2.clientY, 2));
            let prevDistance = Math.sqrt(Math.pow(prev1!.clientX - prev2!.clientX, 2) + Math.pow(prev1!.clientY - prev2!.clientY, 2));
            let d_zoom = -2 * (curDistance - prevDistance);



            // Set mouse position to the middle of the two touches
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
        let element = document.elementFromPoint(e.touches[0].clientX, e.touches[0].clientY);
        this.onCursorMove(element, e.touches[0].clientX, e.touches[0].clientY);
        this.g.prevTouches = e.touches;
    }

    /**
     * Handle cursor movement.
        * This can be called by mousemove or touchmove.
        */
    onCursorMove(target: EventTarget | null, clientX: number, clientY: number) {

        console.debug("Cursor move");

        const g = this.g;

        g.hoverDOM = target;
        // Get mouse position relative to canvas
        g.mouse_x = clientX - g.canvasContainer!.offsetLeft;
        g.mouse_y = clientY - g.canvasContainer!.offsetTop;
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
                g.canvas!.style.transform = `matrix3d(${worldToCamera(g.camera_x, g.camera_y, g)})`;
                g.canvasBackground!.style.transform = `translate(${g.camera_x + -g.cameraWidth * 5}px, ${g.camera_y + -g.cameraHeight * 5}px)`;
                g.canvasBackground!.style.backgroundPosition = `${-g.camera_x}px ${-g.camera_y}px`;
                g.canvas!.style.cursor = "grabbing";
            } else if (g.currentMouseDown == mouseDownButton.left) {
                // Select multiple boxes if left mouse button is pressed
                g.selectionBox!.style.width = Math.abs(g.dx) + 'px';
                g.selectionBox!.style.height = Math.abs(g.dy) + 'px';
                g.selectionBox!.style.left = Math.min(g.mousedown_x, g.mouse_x) + 'px';
                g.selectionBox!.style.top = Math.min(g.mousedown_y, g.mouse_y) + 'px';

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
                    } else {
                        node.offFocus();
                    }
                }
                g.focusNodes = selectedNodes;
            }
        } else {
            // if (g.targetObject.type == ObjectTypes.node) {
            //     /* If the object being dragged is a node, then drag all selected nodes */
            //     for (const node of g.focusNodes) {
            //         node.onDrag();
            //     }
            // } else {
            //     /* Otherwise, just drag the selected object */
            //     g.targetObject.onDrag();
            // }
        }

    }

    onMouseUp(_: MouseEvent) {
        this.onCursorUp();
    }

    onTouchEnd(_: TouchEvent) {
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
                g.selectionBox!.style.width = '0px';
                g.selectionBox!.style.height = '0px';
                g.selectionBox!.style.left = '0px';
                g.selectionBox!.style.top = '0px';
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

            // g.noNewSVG = true;
            // for (const node of g.focusNodes) {
            //     node.domMouseDown(e);
            // }
            // g.noNewSVG = false;
        }

        g.currentMouseDown = mouseDownButton.none;

        if (g.overrideDrag) {
            g.canvasBackground!.style.cursor = "default";
        }

        g.overrideDrag = false;
        g.canvas!.style.cursor = "default";
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

        g.canvas!.style.transform = `matrix3d(${worldToCamera(g.camera_x, g.camera_y, g)})`;

    }


    onKeyDown(e: KeyboardEvent) {
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
        } else {
            this.g.targetObject?.onDrag();
        }
        window.requestAnimationFrame(this.step.bind(this));
    }

    addNode(config: NodeConfig, x: number, y: number) {
        const n: NodeUI = new NodeUI(config, this.g, x, y);
        this.g.globalNodes[n.gid] = n;
        this.focusNode(n.gid);
        // n.domMouseDown();
        // n.onDrag();
        // n.domMouseUp();
        return n;
    }

    addNodeAtMouse(config: NodeConfig, e: MouseEvent) {

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

        this.g.canvasBackground!.style.cursor = "none";
    }

    deleteNode(id: string) {
        if (!(id in this.g.globalNodes)) {
            console.error("Node not found: " + id);
            return null;
        }
        this.g.globalNodes[id].destroy();
        delete this.g.globalNodes[id];
        return id;
    }

    focusNode(id: string) {
        if (!(id in this.g.globalNodes)) return null;
        const node = this.g.globalNodes[id];
        node.onFocus();
        return id;
    }

    connectNodes(node0: string, outputID: string, node1: string, inputID: string) {
        const n0 = this.g.globalNodes[node0];
        const n1 = this.g.globalNodes[node1];
        if (!n0 || !n1 || !(n0 instanceof NodeUI) || !(n1 instanceof NodeUI)) {
            return null;
        }
        const o = n0.findOutput(outputID);
        const i = n1.findInput(inputID);

        if (!o || !i) return null;

        o.output.connectToInput(i.input);

        return 0;
    }


}
