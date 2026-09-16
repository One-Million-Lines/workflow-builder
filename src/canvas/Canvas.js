import { renderTriggerNode, renderStepNode } from "./NodeRenderer.js";
import { icon } from "../ui/Icon.js";
import { defaultT } from "../i18n/index.js";

// Safe fallbacks for environments that lack rAF (SSR, test runners, jsdom without mock)
const _raf = typeof requestAnimationFrame === "function"
  ? requestAnimationFrame
  : (fn) => { fn(); return 0; };
const _caf = typeof cancelAnimationFrame === "function"
  ? cancelAnimationFrame
  : () => {};

/**
 * Canvas renders the entire workflow tree vertically with branches.
 *
 * Performance contract
 * ─────────────────────
 * • render(workflow)   — schedules a full structural rebuild via requestAnimationFrame.
 *                        Multiple back-to-back calls in the same JS tick collapse into one.
 * • renderNow(workflow)— forces a synchronous structural rebuild (cancels any pending rAF).
 * • refreshVisual()    — updates ONLY selection / error classes on existing nodes.
 *                        Never touches innerHTML; safe to call as often as needed.
 *
 * Event handling
 * ──────────────
 * Uses a single delegated click listener on this.el instead of per-node listeners.
 * Node and connector elements carry data attributes so the handler can route events:
 *   [data-id]        — step / trigger id
 *   [data-act]       — "delete" | "toggle" (action buttons inside a node)
 *   [data-plus-id]   — parentId for connector + buttons
 *   [data-branch]    — "yes" | "no" for branch connectors
 *
 * Emits CustomEvents on this.el:
 *   "wfb:select-trigger"   detail: {}
 *   "wfb:select-node"      detail: { id }
 *   "wfb:add-step"         detail: { parentId, branch?, anchorEl }
 *   "wfb:delete-step"      detail: { id }
 *   "wfb:toggle-step"      detail: { id }
 */
export class Canvas {
  constructor({ stepRegistry, triggerRegistry, t = defaultT }) {
    this.stepRegistry = stepRegistry;
    this.triggerRegistry = triggerRegistry;
    this._t = t;

    this.el = document.createElement("div");
    this.el.className = "wfb-canvas";
    this._scroll = document.createElement("div");
    this._scroll.className = "wfb-canvas__scroll";
    this.el.appendChild(this._scroll);

    this.selectedId = null;
    this.errors = new Set();

    // rAF batching state
    this._rafId = null;
    this._pendingWorkflow = null;

    // Pre-compute static parts used in every connector
    this._plusTitle = t("add_step");
    this._plusIconHtml = icon("plus", { size: 14 });

    // Single delegated event listener — installed once, never torn down
    this._scroll.addEventListener("click", (e) => this._handleClick(e));
  }

  // ── Public API ──────────────────────────────────────────────────────────────

  setSelected(id) { this.selectedId = id; }
  /** @deprecated Use setErrorState instead. */
  setErrorIds(ids) { this.errors = new Set(ids || []); this.errorMessages = {}; }
  /**
   * Set error IDs and associated messages for display in node tooltips.
   * @param {string[]} ids     — step IDs with errors
   * @param {Object}  messages — map of stepId → string[] of error messages
   */
  setErrorState(ids, messages = {}) {
    this.errors = new Set(ids || []);
    this.errorMessages = messages || {};
  }
  /** Inform the canvas which step types are handled by plugins (for visual indicator). */
  setPluginTypes(types) { this._pluginTypes = new Set(types || []); }

  /**
   * Schedule a full structural re-render.
   * Multiple synchronous calls within the same JS task are coalesced into one rAF.
   */
  render(workflow) {
    this._pendingWorkflow = workflow;
    if (!this._rafId) {
      this._rafId = _raf(() => {
        this._rafId = null;
        const wf = this._pendingWorkflow;
        this._pendingWorkflow = null;
        this._doRender(wf);
      });
    }
  }

  /**
   * Cancel any pending deferred render (call before removing from DOM).
   */
  cancel() {
    if (this._rafId) {
      _caf(this._rafId);
      this._rafId = null;
      this._pendingWorkflow = null;
    }
  }

  /**
   * Force a synchronous structural re-render, cancelling any queued rAF.
   * Use this when the DOM must be up-to-date immediately (e.g. initial mount).
   */
  renderNow(workflow) {
    this.cancel();
    this._doRender(workflow);
  }

  /**
   * Update ONLY the visual state (selected / error classes) on already-rendered nodes.
   * Does NOT touch innerHTML or recreate any elements — runs in O(n) DOM queries.
   */
  refreshVisual() {
    const trigId = this._lastTrigId;
    this._scroll.querySelectorAll(".wfb-node[data-id]").forEach((node) => {
      const id = node.dataset.id;
      const isSelected = this.selectedId === id;
      const hasError = this.errors.has(id);
      const msgs = (this.errorMessages && this.errorMessages[id]) || [];

      node.classList.toggle("wfb-node--selected", isSelected);
      node.classList.toggle("wfb-node--error", hasError);

      // Sync error flag badge
      let flag = node.querySelector(".wfb-node__error-flag");
      if (hasError) {
        if (!flag) {
          flag = document.createElement("div");
          flag.className = "wfb-node__error-flag";
          flag.innerHTML = icon("alert", { size: 12 });
          node.appendChild(flag);
        }
        const tooltip = msgs.length > 0 ? msgs.join("\n") : this._t("config_incomplete");
        flag.title = tooltip;
        flag.setAttribute("data-wfb-errors", tooltip);
      } else if (flag) {
        flag.remove();
      }

      // Sync status dot title
      const statusDot = node.querySelector(".wfb-node__status");
      if (statusDot) {
        const isDisabled = node.classList.contains("wfb-node--disabled");
        statusDot.title = isDisabled ? this._t("status_inactive") : this._t("status_active");
      }
    });
  }

  // ── Private ─────────────────────────────────────────────────────────────────

  _doRender(workflow) {
    this._scroll.innerHTML = "";
    const root = document.createElement("div");
    root.className = "wfb-flow";
    this._scroll.appendChild(root);

    const trigger = workflow.trigger || {};
    this._lastTrigId = trigger.id;

    // Trigger node
    const triggerDef = trigger.type ? this.triggerRegistry.get(trigger.type) : null;
    const triggerEl = renderTriggerNode(trigger, triggerDef, {
      selected: this.selectedId === trigger.id,
      t: this._t,
    });
    root.appendChild(this._wrap(triggerEl));
    root.appendChild(this._makeConnector(trigger.id || "trigger"));

    this._renderStepList(root, workflow.steps || []);
  }

  _renderStepList(container, steps) {
    for (const step of steps) {
      // hasPlugin: step types that have a registered module are "plugin-managed"
      const hasPlugin = this._pluginTypes ? this._pluginTypes.has(step.type) : false;
      const hasError  = this.errors.has(step.id);
      const errorMsgs = (this.errorMessages && this.errorMessages[step.id]) || [];
      const stepEl = renderStepNode(step, this.stepRegistry.get(step.type), {
        selected: this.selectedId === step.id,
        hasError,
        errorMessages: errorMsgs,
        hasPlugin,
        t: this._t,
      });
      // No inline listeners — delegation handles all interaction
      container.appendChild(this._wrap(stepEl));

      if (step.type === "condition") {
        const branchWrap = document.createElement("div");
        branchWrap.className = "wfb-branches";
        for (const which of ["yes", "no"]) {
          const col = document.createElement("div");
          col.className = `wfb-branch wfb-branch--${which}`;
          const labelEl = document.createElement("div");
          labelEl.className = `wfb-branch__label wfb-branch__label--${which}`;
          labelEl.textContent = this._t(which === "yes" ? "branch_yes" : "branch_no");
          col.appendChild(labelEl);
          col.appendChild(this._makeConnector(step.id, which));
          this._renderStepList(col, step.branches?.[which] || []);
          branchWrap.appendChild(col);
        }
        container.appendChild(branchWrap);
      } else if (step.type !== "exit") {
        container.appendChild(this._makeConnector(step.id));
      }
    }
  }

  _wrap(node) {
    const w = document.createElement("div");
    w.className = "wfb-node-wrap";
    w.appendChild(node);
    return w;
  }

  /** Build a connector (line + plus button + line). Data attributes enable delegation. */
  _makeConnector(parentId, branch) {
    const wrap = document.createElement("div");
    wrap.className = "wfb-connector";
    // Encode routing data on the button — no closure needed
    const branchAttr = branch ? ` data-branch="${branch}"` : "";
    wrap.innerHTML = `
      <div class="wfb-connector__line"></div>
      <button class="wfb-plus" type="button"
        title="${this._plusTitle}"
        data-plus-id="${parentId}"${branchAttr}>${this._plusIconHtml}</button>
      <div class="wfb-connector__line"></div>
    `;
    return wrap;
  }

  /** Single delegated click handler — routes to the correct event. */
  _handleClick(e) {
    // 1. Action button (delete / toggle) inside a node
    const actBtn = e.target.closest("[data-act]");
    if (actBtn) {
      e.stopPropagation();
      const nodeEl = actBtn.closest(".wfb-node[data-id]");
      const id = nodeEl?.dataset.id;
      if (!id) return;
      const act = actBtn.dataset.act;
      if (act === "delete") this._emit("wfb:delete-step", { id });
      else if (act === "toggle") this._emit("wfb:toggle-step", { id });
      return;
    }

    // 2. Plus / connector button
    const plusBtn = e.target.closest("[data-plus-id]");
    if (plusBtn) {
      e.stopPropagation();
      this._emit("wfb:add-step", {
        parentId: plusBtn.dataset.plusId,
        branch: plusBtn.dataset.branch || null,
        anchorEl: plusBtn,
      });
      return;
    }

    // 3. Trigger node click
    if (e.target.closest(".wfb-node--trigger")) {
      this._emit("wfb:select-trigger");
      return;
    }

    // 4. Step node click
    const stepNode = e.target.closest(".wfb-node[data-id]");
    if (stepNode) {
      this._emit("wfb:select-node", { id: stepNode.dataset.id });
    }
  }

  _emit(name, detail = {}) {
    this.el.dispatchEvent(new CustomEvent(name, { detail, bubbles: false }));
  }
}
