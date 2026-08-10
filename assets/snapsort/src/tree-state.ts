// Internal symbol used to reconcile SnapSort's logical tree with committed
// framework DOM without adding a string-named method to Item's public API.
export const reconcileTreeState = Symbol("SnapSort.reconcileTreeState");
