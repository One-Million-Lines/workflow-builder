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
  const { target, container, initialValue, workflow, locale, theme, ...rest } = options;
  const instance = new WorkflowBuilder({
    container: target ?? container,
    workflow: initialValue ?? workflow ?? null,
    locale,
    theme,
    ...rest,
  });

  let isMounted = false;
  let mountPromise = null;
  let lifecycleGeneration = 0;

  const api = {
    /** The underlying WorkflowBuilder instance. */
    instance,
    /** Mount into the target. Safe to call once; resolves when ready. */
    async mount() {
      if (isMounted) return api;
      if (!mountPromise) {
        const generation = lifecycleGeneration;
        mountPromise = instance.mount()
          .then(() => {
            if (generation === lifecycleGeneration) {
              isMounted = !!instance._root?.isConnected;
            }
          })
          .finally(() => {
            if (generation === lifecycleGeneration) mountPromise = null;
          });
      }
      await mountPromise;
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
    /** Returns true if the sidebar form panel is currently open. */
    isSidebarOpen() {
      return instance.isSidebarOpen?.() ?? false;
    },
    /** Flush the open sidebar editor, then return the current workflow. */
    commitAndGetWorkflow() {
      instance.commitSidebar?.();
      return instance.getWorkflow();
    },
    /**
     * Report validation errors for a step from an external plugin.
     * Pass a non-empty array to mark the step invalid (shows red ⚠ badge with
     * hover tooltip listing the messages); pass [] to clear.
     * @param {string}   stepId
     * @param {string[]} errors
     */
    setStepErrors(stepId, errors) {
      instance.setStepErrors(stepId, errors);
      return api;
    },
    /**
     * Clear plugin-reported errors for a step.
     * @param {string} stepId
     */
    clearStepErrors(stepId) {
      instance.clearStepErrors(stepId);
      return api;
    },
    /** Subscribe to a builder event; returns an unsubscribe function. */
    on(event, handler) {
      return instance.on(event, handler);
    },
    /** Unmount and release the DOM. */
    destroy() {
      lifecycleGeneration += 1;
      instance.unmount();
      isMounted = false;
      mountPromise = null;
    },
  };

  // Auto-mount for convenience. Await `builder.ready` before reading values.
  api.ready = api.mount();

  return api;
}
