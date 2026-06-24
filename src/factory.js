import { WorkflowBuilder } from "./core/WorkflowBuilder.js";

/**
 * Framework-neutral factory around `WorkflowBuilder`.
 *
 * Returns an object with a stable lifecycle API that is easy to wrap from Vue,
 * Angular, Svelte, or plain JavaScript:
 *
 *   const builder = createWorkflowBuilder({
 *     target: document.getElementById("builder"),
 *     initialValue: workflow,
 *     onChange(value) { ... },
 *   });
 *   await builder.ready;           // mounting is async (registries are built)
 *   builder.getValue();
 *   builder.destroy();
 *
 * Accepts the same options as `WorkflowBuilder`, plus the framework-neutral
 * aliases `target` (for `container`) and `initialValue` (for `workflow`).
 */
export function createWorkflowBuilder(options = {}) {
  const { target, container, initialValue, workflow, ...rest } = options;
  const instance = new WorkflowBuilder({
    container: target ?? container,
    workflow: initialValue ?? workflow ?? null,
    ...rest,
  });

  let isMounted = false;

  const api = {
    /** The underlying WorkflowBuilder instance. */
    instance,
    /** Mount into the target. Safe to call once; resolves when ready. */
    async mount() {
      if (!isMounted) {
        await instance.mount();
        isMounted = true;
      }
      return api;
    },
    /** Replace the current workflow document. */
    update(value) {
      instance.setWorkflow(value);
      return api;
    },
    /** Read the current workflow document. */
    getValue() {
      return instance.getWorkflow();
    },
    /** Replace the current workflow document. */
    setValue(value) {
      instance.setWorkflow(value);
      return api;
    },
    /** Validate the current workflow; returns `{ valid, errors, warnings }`. */
    validate() {
      return instance.validate();
    },
    /** Subscribe to a builder event; returns an unsubscribe function. */
    on(event, handler) {
      return instance.on(event, handler);
    },
    /** Unmount and release the DOM. */
    destroy() {
      instance.unmount();
      isMounted = false;
    },
  };

  // Auto-mount for convenience. Await `builder.ready` before reading values.
  api.ready = api.mount();

  return api;
}
