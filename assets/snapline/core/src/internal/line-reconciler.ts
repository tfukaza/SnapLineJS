import type { LineMirror } from "../line";
import type {
  CanonicalGraphSnapshot,
  ControlledGraphCallbacks,
  LineChangeRequest,
  LineId,
  LineRecord,
  ReconciliationError,
} from "../types";
import type { GraphRegistry } from "./graph-registry";

// Converges the engine's line mirrors onto the cached canonical snapshot.
// Read-only with respect to canonical state: reconciliation never emits a
// change request, and it never rewrites, reorders, or deletes canonical
// records — a record the mirror cannot represent stays latent (both
// endpoints not mounted; silent) or errored (rules violation; structured
// diagnostic), and is retried when relevant state changes.
export class LineReconciler {
  #mirror: GraphRegistry;
  #callbacks: ControlledGraphCallbacks;
  #snapshot: CanonicalGraphSnapshot = { lines: [] };
  #reconciling = false;
  #disposed = false;

  constructor(mirror: GraphRegistry, callbacks: ControlledGraphCallbacks) {
    this.#mirror = mirror;
    this.#callbacks = callbacks;
  }

  /** Cache the application's latest canonical snapshot and schedule one
   * coalesced reconciliation pass. The only inbound canonical channel. */
  setCanonicalGraph(snapshot: CanonicalGraphSnapshot): void {
    this.#snapshot = snapshot;
    this.#mirror.scheduleReconciliation();
  }

  dispose(): void {
    this.#disposed = true;
    if (this.#mirror.reconciler === this) this.#mirror.reconciler = null;
  }

  /** Forward a gesture's atomic proposal to the application. */
  dispatchLineChangeRequest(request: LineChangeRequest): void {
    this.#callbacks.onLineChangeRequest(request);
  }

  /** One pass: prune, preserve/retarget by stable id, create, report. */
  reconcile(): void {
    if (this.#reconciling || this.#disposed) return;
    this.#reconciling = true;
    const mirror = this.#mirror;
    const errors: ReconciliationError[] = [];
    try {
      // Canonical records by id — duplicates never silently collapse.
      const recordById = new Map<LineId, LineRecord>();
      for (const record of this.#snapshot.lines) {
        if (recordById.has(record.id)) {
          errors.push({
            code: "duplicate-id",
            lineId: record.id,
            message: `SnapLine: canonical snapshot contains line id "${record.id}" more than once; the first record wins.`,
          });
          continue;
        }
        recordById.set(record.id, record);
      }

      // Prune settled mirrors whose record is gone, or whose source moved
      // (a line's start connector is fixed at construction, so a
      // fromConnectorId change recreates the mirror below).
      for (const line of mirror.lines) {
        const record = recordById.get(line.lineId);
        if (!record || line.start.connectorId !== record.fromConnectorId) {
          line.start.deleteLine(line, "programmatic");
        }
      }

      // Preview lines by stable id: staged lines await this pass's decision;
      // a mid-drag line leaves its record latent.
      const previewById = new Map<LineId, LineMirror>();
      for (const preview of mirror.previewLines) {
        previewById.set(preview.lineId, preview);
      }

      // Converge every record.
      for (const record of recordById.values()) {
        const existing = mirror.line(record.id);
        if (existing) {
          if (existing.target?.connectorId === record.toConnectorId) {
            existing.setPayload(record.payload);
            continue;
          }
          const nextTarget = mirror.connector(record.toConnectorId);
          if (!nextTarget) {
            // Latent until the new endpoint mounts.
            existing.start.deleteLine(existing, "programmatic");
            continue;
          }
          const retargeted = existing.start.retargetSettledLineFromRecord(
            existing,
            nextTarget,
          );
          if (retargeted !== true) {
            existing.start.deleteLine(existing, "programmatic");
            errors.push(this.#ruleError(retargeted, record));
          }
          continue;
        }

        const preview = previewById.get(record.id);
        if (preview) {
          if (preview.phase !== "staged") continue; // mid-drag: latent
          const stagedTarget = mirror.connector(record.toConnectorId);
          if (
            preview.start.connectorId === record.fromConnectorId &&
            stagedTarget
          ) {
            // The canonical owner adopted the proposed id: settle the staged
            // mirror in place (capacity/predicates recheck strictly).
            const settled = preview.start.settleStagedLineFromRecord(
              preview,
              stagedTarget,
            );
            if (settled !== true) {
              preview.start.discardStagedLine(preview);
              errors.push(this.#ruleError(settled, record));
            } else {
              preview.setPayload(record.payload);
            }
            continue;
          }
          // Normalized away from the staged shape: discard, then converge
          // the record like any other below.
          preview.start.discardStagedLine(preview);
        }

        const source = mirror.connector(record.fromConnectorId);
        const target = mirror.connector(record.toConnectorId);
        // A soft link whose mirror has not mounted yet is latent, not an
        // error; registration schedules the retry.
        if (!source || !target) continue;

        const created = source.createSettledLineFromRecord(target, record);
        if (typeof created === "string") {
          errors.push(this.#ruleError(created, record));
        }
      }

      // A staged line whose id the canonical owner declined (or ignored —
      // the adapter's post-request push still delivered a snapshot without
      // it) is discarded; nothing was ever committed locally.
      for (const line of mirror.previewLines) {
        if (line.phase === "staged" && !recordById.has(line.lineId)) {
          line.start.discardStagedLine(line);
        }
      }
    } finally {
      this.#reconciling = false;
      mirror.pendingGestureRequest = false;
    }

    if (mirror.setReconciliationErrors(errors)) {
      this.#callbacks.onDiagnosticsChanged?.(mirror.diagnostics());
    }
  }

  #ruleError(
    code: "capacity-exceeded" | "connection-rejected",
    record: LineRecord,
  ): ReconciliationError {
    return {
      code,
      lineId: record.id,
      connectorId:
        code === "capacity-exceeded" ? record.toConnectorId : undefined,
      message:
        code === "capacity-exceeded"
          ? `SnapLine: canonical line "${record.id}" exceeds a connector's capacity; the record is preserved but unrepresented.`
          : `SnapLine: canonical line "${record.id}" was refused by connector rules; the record is preserved but unrepresented.`,
    };
  }
}
