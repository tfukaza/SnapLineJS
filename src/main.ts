
import { worldToCamera } from './helper.js';
import { GlobalStats, NodeConfig } from './types';
import { NodeUI } from './node.js';

export default class SnapLine {

    g: GlobalStats;

    onMouseMove(e: MouseEvent) {

        const g = this.g;

        g.hoverDOM = e.target;
        // get mouse position relative to canvas
        g.mouse_x = e.clientX - g.canvasContainer!.offsetLeft;
        g.mouse_y = e.clientY - g.canvasContainer!.offsetTop;

        // console.debug(`Mouse position: ${g.mouse_x}, ${g.mouse_y}`);

        // Adjust mouse position to world coordinates
        let w_x = (g.mouse_x - g.cameraWidth / 2) / g.zoom + g.camera_x;
        let w_y = (g.mouse_y - g.cameraHeight / 2) / g.zoom + g.camera_y;

        // console.debug(`World position: ${w_x}, ${w_y}`);

        g.mouse_x_world = w_x;
        g.mouse_y_world = w_y;

        if (g.isMouseDown || g.overrideDrag) {
            g.dx = e.clientX - g.mousedown_x + g.dx_offset;
            g.dy = e.clientY - g.mousedown_y + g.dy_offset;

            if (g.targetNode == null) {
                g.camera_x = g.camera_pan_start_x - g.dx / g.zoom;
                g.camera_y = g.camera_pan_start_y - g.dy / g.zoom;
                g.canvas!.style.transform = `matrix3d(${worldToCamera(g.camera_x, g.camera_y, g)})`;
                g.canvasBackground!.style.transform = `translate(${g.camera_x + -g.cameraWidth * 5}px, ${g.camera_y + -g.cameraHeight * 5}px)`;
                g.canvasBackground!.style.backgroundPosition = `${-g.camera_x}px ${-g.camera_y}px`;
                g.canvas!.style.cursor = "grabbing";
            }
        }
    }

    constructor(canvasContainerID: string) {

        this.g = {
            canvas: null,
            canvasContainer: null,
            canvasBackground: null,

            isMouseDown: false,     // If mouse is being pressed
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

            targetNode: null,
            focusNode: null,
            hoverDOM: null,
            gid: 0,

            nodeArray: [],
            globalLines: [],
            globalNodes: {},
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
        c.style.position = 'absolute';
        c.style.top = '0px';
        c.style.left = '0px';
        c.className = 'canvas';
        g.canvasContainer.appendChild(c);
        g.canvas = c;

        g.canvas.style.transform = `translate(${g.cameraWidth / 2}px, ${g.cameraHeight / 2}px)`;

        g.canvasContainer.tabIndex = 0;

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


        g.canvasContainer.addEventListener('mousedown', function (e) {
            if (g.overrideDrag) {
                return;
            }

            g.isMouseDown = true;
            g.mousedown_x = e.clientX;
            g.mousedown_y = e.clientY;
            g.camera_pan_start_x = g.camera_x;
            g.camera_pan_start_y = g.camera_y;


            for (const node of g.nodeArray) {
                node.offFocus();
            }
        });

        g.canvasContainer.addEventListener('mousemove', this.onMouseMove.bind(this));

        g.canvasContainer.addEventListener('wheel', function (e) {
            e.preventDefault();
            let d_zoom = (1 * g.zoom) * (-e.deltaY / 1000);

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

        });

        g.canvasContainer.addEventListener('mouseup', function (_) {

            if (g.overrideDrag) {
                g.canvasBackground!.style.cursor = "default";
            }

            g.overrideDrag = false;
            g.isMouseDown = false;
            g.canvas!.style.cursor = "default";
            if (g.targetNode == null) {
            } else {
                g.targetNode.domMouseUp();
            }
            g.targetNode = null;
            g.dx = 0;
            g.dy = 0;
            g.dx_offset = 0;
            g.dy_offset = 0;

            // if (g.overrideDrag) {
            //     g.canvasContainer.style.cursor = "grab";
            // }

        });

        g.canvasContainer.addEventListener('keydown', (e: KeyboardEvent) => {
            console.debug("Keydown: " + e.key);
            switch (e.key) {
                case 'Backspace':
                case 'Delete':
                    if (g.focusNode) {
                        console.debug("Delete Node " + g.focusNode.gid);
                        this.deleteNode(g.focusNode.gid);
                    }
                    break;
            }
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

    addNode(config: NodeConfig, x: number, y: number) {
        const n: NodeUI = new NodeUI(config, this.g, x, y);
        this.g.globalNodes[n.gid] = n;
        this.focusNode(n.gid);
        return n;
    }

    addNodeAtMouse(config: NodeConfig, e: MouseEvent) {

        let x = this.g.mouse_x_world;
        let y = this.g.mouse_y_world;

        let n = this.addNode(config, x, y);

        this.g.isMouseDown = true;
        this.g.mousedown_x = this.g.mouse_x;
        this.g.mousedown_y = this.g.mouse_y;
        this.g.camera_pan_start_x = this.g.camera_x;
        this.g.camera_pan_start_y = this.g.camera_y;
        this.g.overrideDrag = true;

        this.g.focusNode = n;
        this.g.targetNode = n;

        for (const node of this.g.nodeArray) {
            node.offFocus();
        }

        this.onMouseMove(e);

        this.g.canvasBackground!.style.cursor = "none";
    }

    deleteNode(id: string) {
        if (!(id in this.g.globalNodes)) return null;
        const node = this.g.globalNodes[id];
        this.g.canvas?.removeChild((<NodeUI>node).dom);
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
