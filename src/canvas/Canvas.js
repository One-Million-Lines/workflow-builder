import { renderTriggerNode, renderStepNode } from "./NodeRenderer.js";
import { icon } from "../ui/Icon.js";

/**
 * Canvas renders the entire workflow tree vertically with branches.
 *
 * Emits DOM events on its root element:
 *   - "wfb:select-node"    detail: { id }
 *   - "wfb:add-step"       detail: { parentId, branch?, anchorEl }
 *   - "wfb:delete-step"    detail: { id }
 *   - "wfb:toggle-step"    detail: { id }
 *   - "wfb:select-trigger" detail: {}
 */
export class Canvas {
  constructor({ stepRegistry, triggerRegistry }) {
    this.stepRegistry = stepRegistry;
    this.triggerRegistry = triggerRegistry;
    this.el = document.createElement("div");
    this.el.className = "wfb-canvas";
    this._scroll = document.createElement("div");
    this._scroll.className = "wfb-canvas__scroll";
    this.el.appendChild(this._scroll);
    this.selectedId = null;
    this.errors = new Set(); // ids with config errors
  }

  setSelected(id) { this.selectedId = id; }
  setErrorIds(ids) { this.errors = new Set(ids || []); }

  render(workflow) {
    this._scroll.innerHTML = "";
    const root = document.createElement("div");
    root.className = "wfb-flow";
    this._scroll.appendChild(root);

    // Trigger
    const triggerDef = workflow.trigger?.type ? this.triggerRegistry.get(workflow.trigger.type) : null;
    const triggerEl = renderTriggerNode(workflow.trigger || {}, triggerDef, {
      selected: this.selectedId === workflow.trigger?.id,
    });
    triggerEl.addEventListener("click", () => this._emit("wfb:select-trigger"));
    root.appendChild(this._wrap(triggerEl));

    // Plus between trigger and first step (insert at root index 0)
    root.appendChild(this._renderConnectorWithPlus(workflow.trigger?.id || "trigger"));

    this._renderStepList(root, workflow.steps || [], null);
  }

  _renderStepList(container, steps, branchOwnerId) {
    steps.forEach((step, idx) => {
      const stepEl = renderStepNode(step, this.stepRegistry.get(step.type), {
        selected: this.selectedId === step.id,
        hasError: this.errors.has(step.id),
      });
      stepEl.addEventListener("click", (e) => {
        if (e.target.closest("[data-act]")) return;
        this._emit("wfb:select-node", { id: step.id });
      });
      stepEl.querySelector('[data-act="delete"]')?.addEventListener("click", (e) => {
        e.stopPropagation();
        this._emit("wfb:delete-step", { id: step.id });
      });
      stepEl.querySelector('[data-act="toggle"]')?.addEventListener("click", (e) => {
        e.stopPropagation();
        this._emit("wfb:toggle-step", { id: step.id });
      });
      container.appendChild(this._wrap(stepEl));

      if (step.type === "condition") {
        // Branches container
        const branchWrap = document.createElement("div");
        branchWrap.className = "wfb-branches";
        for (const which of ["yes", "no"]) {
          const col = document.createElement("div");
          col.className = `wfb-branch wfb-branch--${which}`;
          const label = document.createElement("div");
          label.className = `wfb-branch__label wfb-branch__label--${which}`;
          label.textContent = which.toUpperCase();
          col.appendChild(label);
          // plus to add at start of branch
          col.appendChild(this._renderConnectorWithPlus(step.id, which));
          this._renderStepList(col, step.branches?.[which] || [], step.id);
          branchWrap.appendChild(col);
        }
        container.appendChild(branchWrap);
      } else if (step.type !== "exit") {
        container.appendChild(this._renderConnectorWithPlus(step.id));
      }
    });
  }

  _wrap(node) {
    const w = document.createElement("div");
    w.className = "wfb-node-wrap";
    w.appendChild(node);
    return w;
  }

  _renderConnectorWithPlus(parentId, branch) {
    const wrap = document.createElement("div");
    wrap.className = "wfb-connector";
    wrap.innerHTML = `
      <div class="wfb-connector__line"></div>
      <button class="wfb-plus" type="button" title="Add step">${icon("plus", { size: 14 })}</button>
      <div class="wfb-connector__line"></div>
    `;
    const btn = wrap.querySelector(".wfb-plus");
    btn.addEventListener("click", (e) => {
      e.stopPropagation();
      this._emit("wfb:add-step", { parentId, branch: branch || null, anchorEl: btn });
    });
    return wrap;
  }

  _emit(name, detail = {}) {
    this.el.dispatchEvent(new CustomEvent(name, { detail, bubbles: false }));
  }
}
