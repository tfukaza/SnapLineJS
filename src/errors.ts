/**
 * Reporting policy for exceptions thrown by consumer code the engine invokes
 * (scheduled frame tasks, input event callbacks).
 *
 * The engine must not let a consumer throw unwind its own bookkeeping — a
 * throw escaping an input dispatch, for example, strands the pointer record
 * and its claim, which silently disables every later gesture. Reporting rather
 * than propagating keeps the state machine coherent without hiding the error:
 * `reportError` surfaces as an uncaught error to the console, to
 * `window.onerror` handlers, and to test harnesses such as Playwright's
 * `page.on("pageerror")`.
 */
export function reportConsumerError(error: unknown): void {
  const reportedError =
    error instanceof Error ? error : new Error(String(error));
  if (typeof globalThis.reportError === "function") {
    globalThis.reportError(reportedError);
    return;
  }
  console.error(reportedError);
}
