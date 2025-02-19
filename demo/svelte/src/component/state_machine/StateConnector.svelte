<script lang="ts">
    import { NodeComponent, ConnectorComponent, LineComponent } from "../../lib/snapline.mjs";
    import { onMount } from "svelte";
    let { 
        nodeObject, 
        name, 
        maxConnectors = 1, 
        allowDragOut = true,
        radius = 40
    }: { 
        nodeObject: NodeComponent,
        name: string, 
        maxConnectors?: number, 
        allowDragOut?: boolean,
        radius?: number
    } = $props();
    let connectorDOM: HTMLSpanElement | null = null;

    class CustomLine extends LineComponent {

        connectedToSelf: boolean = false;

        setLineEnd(x: number, y: number) {

            this.connectedToSelf = false;

            let hover = this.getClassFromDOM(this.g.hoverDOM);
            let targetConnector = null;
            // Check if hover is a CustomConnector class
            if (this.target != null) {
                targetConnector = this.target;
            } else if (hover && hover instanceof ConnectorComponent) {
                targetConnector = hover;
            } 

            if (targetConnector == null) { 
                super.setLineEnd(x, y);
                return;
            }
            const targetCenterX = targetConnector.connectorX;
            const targetCenterY = targetConnector.connectorY;
            const angle = Math.atan((this.parent.connectorY - targetCenterY)/(this.parent.connectorX - targetCenterX));
            const distance = Math.sqrt((this.parent.connectorX - targetCenterX)**2 + (this.parent.connectorY - targetCenterY)**2);
            if (distance <= radius) {
                super.setLineEnd(x, y);
                this.connectedToSelf = true;
                return;
            }
            let dx = this.x_start - this.x_end;
            let offsetX = Math.cos(angle - (dx < 0 ? Math.PI : 0)) * (radius - 19);
            let offsetY = Math.sin(angle - (dx < 0 ? Math.PI : 0)) * (radius - 19);
            const newX = targetCenterX + offsetX;
            const newY = targetCenterY + offsetY;
            super.setLineEnd(newX, newY);
        }
    }

    class CustomConnector extends ConnectorComponent {
        createLine(dom: HTMLElement | null): LineComponent {
            console.debug(`Creating line from connector ${this.gid}`);
            const line = new CustomLine(
                this.connectorX,
                this.connectorY,
                0,
                0,
                dom,
                this,
                this.g,
                );
            return line;
        }

        _onConnectorCursorDown(currentIncomingLines: LineComponent[]): void {
            if (this.config.allowDragOut) {
                this.startDragOutLine();
            }
        }
    }


    onMount(() => {
        let connector = new CustomConnector(connectorDOM as any, nodeObject.g, {
            name: name,
            maxConnectors: maxConnectors,
            allowDragOut: allowDragOut,
        });
        // connector.endLineDrag = snapToStateConnector.bind(connector);
        nodeObject.addConnectorObject(connector);
    });
    
</script>

<div class="connector" style="--var-handle-radius: {radius}px;" bind:this={connectorDOM}></div>

<style>

.connector {
    user-select: none;
    cursor:grab;
    z-index: -1;
    width: calc(var(--var-handle-radius) + 20px);
    height: calc(var(--var-handle-radius) + 20px);
    border-radius: calc(var(--var-handle-radius) + 20px / 2);
    position: relative;

    background-color: #dfdfdf00;
    grid-column: 1 / 2;
    grid-row: 1 / 2;

    &:hover {
        background-color: #dfdfdf5b;
  
    }
}

</style>