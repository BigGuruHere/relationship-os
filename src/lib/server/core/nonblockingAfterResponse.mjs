// Schedule nonessential work without awaiting it in an HTTP initiation handler.
// Durable recovery must be implemented separately by the task's outbox/worker.
/**
 * Run optional work on the next event-loop turn without delaying the initiation response.
 * The caller must have a durable outbox/worker if the task must survive process exit.
 * @param {() => unknown | Promise<unknown>} task
 * @param {(error: unknown) => void} [onError]
 * @returns {void}
 */
export function scheduleNonblockingTask(task, onError = () => {}) {
  setImmediate(() => {
    Promise.resolve().then(task).catch(onError);
  });
}
