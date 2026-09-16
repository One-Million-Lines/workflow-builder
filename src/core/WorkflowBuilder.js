import { EventEmitter } from "./EventEmitter.js";
import { WorkflowState } from "./WorkflowState.js";
import { WorkflowSerializer } from "./WorkflowSerializer.js";
import { WorkflowValidator } from "./WorkflowValidator.js";
import { buildRegistries } from "../registry/index.js";
import { Canvas } from "../canvas/Canvas.js";
import { AddStepMenu } from "../canvas/AddStepMenu.js";
import { Sidebar } from "../ui/Sidebar.js";
import { renderForm } from "../forms/FormRenderer.js";
import { createDefaultDataProvider } from "../services/MockBackend.js";
import { EmailTemplateBuilder } from "../extensions/email/EmailTemplateBuilder.js";
import { defaultDefinitions } from "../definitions/index.js";
import { createI18n } from "../i18n/index.js";

export class WorkflowBuilder extends EventEmitter {
  constructor({ container, workflow, registries, extensions, dataProvider, modules, onChange, onSave, locale, theme }) {
    super();
    this._containerSel = container;
    this._initialWorkflow = workflow || null;
    this._registriesSrc = registries || defaultDefinitions;
    this._extensions = Array.isArray(extensions) ? [...extensions] : [];
    this._dataProvider = dataProvider || createDefaultDataProvider();
    this._modules = { ...(modules || {}) };
    this._theme = theme || null;
    this._t = createI18n(locale || "en");
    if (onChange) this.on("workflow:change", onChange);
    if (onSave) this.on("workflow:save", onSave);
  }

  /** Register an extension after construction (must be called before mount). */
  registerExtension(ext) {
    this._extensions.push(ext);
  }

  /** Register a custom module that handles `email_template` style field requests. */
  registerModule(name, factory) {
    this._modules[name] = factory;
  }

  /**
   * Report validation errors for a specific step from an external plugin.
   *
   * Plugins should call this whenever their configuration state changes so
   * the canvas node reflects the current validity:
   *   - Pass a non-empty array to mark the step as invalid.
   *   - Pass an empty array (or call clearStepErrors) to mark it as valid.
   *
   * Error messages are shown in a tooltip on the error badge (⚠ icon).
   *
   * @param {string}   stepId  — The step's id (same as `step.id` passed to the plugin).
   * @param {string[]} errors  — Human-readable error messages (empty = no errors).
   */
  setStepErrors(stepId, errors) {
    if (!this._pluginErrors) this._pluginErrors = new Map();
    if (Array.isArray(errors) && errors.length > 0) {
      this._pluginErrors.set(stepId, errors);
    } else {
      this._pluginErrors.delete(stepId);
    }
    this._refreshErrors();
  }

  /**
   * Clear any plugin-reported errors for a step, marking it as valid.
   * @param {string} stepId
   */
  clearStepErrors(stepId) {
    if (this._pluginErrors) this._pluginErrors.delete(stepId);
    this._refreshErrors();
  }

  /** Recompute combined (validator + plugin) error state and update the canvas. */
  _refreshErrors() {
    if (!this._canvas) return;
    const result = this._validator.validate(this._state.getWorkflow());
    const validatorErrorIds = result.errors.filter((e) => e.id).map((e) => e.id);
    const pluginErrorIds    = this._pluginErrors ? [...this._pluginErrors.keys()] : [];
    const allErrorIds = [...new Set([...validatorErrorIds, ...pluginErrorIds])];

    // Build combined error messages map for tooltips
    const errorMessages = {};
    result.errors.forEach((e) => {
      if (e.id) {
        errorMessages[e.id] = errorMessages[e.id] || [];
        errorMessages[e.id].push(e.message);
      }
    });
    if (this._pluginErrors) {
      this._pluginErrors.forEach((msgs, id) => {
        errorMessages[id] = [...(errorMessages[id] || []), ...msgs];
      });
    }

    this._canvas.setErrorState(allErrorIds, errorMessages);
  }

  async mount() {
    // Mounting waits for registry/schema loading. React StrictMode and other
    // hosts may unmount during that await; a generation token prevents the
    // abandoned instance from attaching itself afterwards.
    const mountGeneration = (this._mountGeneration || 0) + 1;
    this._mountGeneration = mountGeneration;

    this._container = typeof this._containerSel === "string"
      ? document.querySelector(this._containerSel)
      : this._containerSel;
    if (!this._container) throw new Error("WorkflowBuilder: container not found");

    const registries = await buildRegistries(this._registriesSrc, this._extensions);
    if (this._mountGeneration !== mountGeneration) return;
    this._reg = registries;
    this._state = new WorkflowState(this._initialWorkflow);
    this._validator = new WorkflowValidator(this._reg.steps, this._reg.triggers);

    // Build DOM shell — both classes are added so consumers can scope overrides
    // via either the legacy `.wfb-root` selector or the namespaced `.oml-workflow-builder`.
    this._root = document.createElement("div");
    this._root.className = "wfb-root oml-workflow-builder";

    // Apply custom theme CSS variables (overrides design tokens from stylesheet).
    if (this._theme && typeof this._theme === "object") {
      Object.entries(this._theme).forEach(([k, v]) => {
        const prop = k.startsWith("--") ? k : `--wfb-${k}`;
        this._root.style.setProperty(prop, v);
      });
    }

    this._canvas = new Canvas({
      stepRegistry: this._reg.steps,
      triggerRegistry: this._reg.triggers,
      t: this._t,
    });
    // Tell the canvas which step types have plugin modules so they get a visual badge.
    this._canvas.setPluginTypes(Object.keys(this._modules));

    this._addMenu = new AddStepMenu(this._reg.steps, (type, ctx) => this._handleAddStep(type, ctx), this._t);
    this._sidebar = new Sidebar(this._t);

    this._root.appendChild(this._canvas.el);
    this._addMenu.mount(this._root);
    this._sidebar.mount(this._root);
    this._container.appendChild(this._root);

    // Built-in module: email template builder
    if (!this._modules.email_template) {
      const tpl = new EmailTemplateBuilder({ mountTarget: this._root });
      this._modules.email_template = (props) => tpl.open(props);
    }

    this._wireCanvasEvents();
    // Initial render is synchronous so the workflow is visible immediately.
    this._pluginErrors = new Map();
    const initResult = this._validator.validate(this._state.getWorkflow());
    const initErrIds = initResult.errors.filter((e) => e.id).map((e) => e.id);
    const initMsgs = {};
    initResult.errors.forEach((e) => { if (e.id) { initMsgs[e.id] = initMsgs[e.id] || []; initMsgs[e.id].push(e.message); } });
    this._canvas.setErrorState(initErrIds, initMsgs);
    this._canvas.renderNow(this._state.getWorkflow());
  }

  unmount() {
    this._mountGeneration = (this._mountGeneration || 0) + 1;
    this._canvas?.cancel();
    this._root?.remove();
  }

  // ---------- Public API ----------
  getWorkflow() { return this._state.getWorkflow(); }
  setWorkflow(json) {
    this._state.setWorkflow(WorkflowSerializer.import(json));
    this._render();
    this._emitChange();
  }
  validate() {
    const result = this._validator.validate(this._state.getWorkflow());
    const ids = result.errors.filter((e) => e.id).map((e) => e.id);
    const msgs = {};
    result.errors.forEach((e) => { if (e.id) { msgs[e.id] = msgs[e.id] || []; msgs[e.id].push(e.message); } });
    this._canvas.setErrorState(ids, msgs);
    this._render(false);
    if (!result.valid) this.emit("validation:error", result);
    return result;
  }
  /**
   * Returns true if the sidebar is currently open.
   */
  isSidebarOpen() {
    return this._sidebar?.el.classList.contains("wfb-sidebar--open") || false;
  }

  /** Flush the currently-open form into workflow state before a host save. */
  commitSidebar() { return this._sidebar?.commit() ?? false; }

  /** @deprecated No longer needed with auto-commit. */
  closeSidebarKeepState() { this._sidebar?.close(); }
  export() { return WorkflowSerializer.export(this._state.getWorkflow()); }
  import(json) { this.setWorkflow(json); }
  addStep(parentStepId, stepType, position = "after") {
    const step = this._state.addStep(parentStepId, stepType, position);
    this._render();
    this.emit("step:add", { step });
    this._emitChange();
    return step;
  }
  removeStep(stepId) {
    this._state.removeStep(stepId);
    this._render();
    this.emit("step:remove", { id: stepId });
    this._emitChange();
  }
  updateStep(stepId, patch) {
    this._state.updateStep(stepId, patch);
    this._render();
    this.emit("step:update", { id: stepId, patch });
    this._emitChange();
  }
  updateTrigger(patch) {
    this._state.updateTrigger(patch);
    this._render();
    this.emit("trigger:update", { patch });
    this._emitChange();
  }

  // ---------- Internal ----------
  _emitChange() { this.emit("workflow:change", this.getWorkflow()); }

  _formCtx() {
    return {
      dataProvider: this._dataProvider,
      openModule: (name, props) => {
        const m = this._modules[name];
        if (!m) { console.warn("Module not registered:", name); return; }
        return m(props);
      },
    };
  }

  _wireCanvasEvents() {
    const c = this._canvas.el;
    c.addEventListener("wfb:select-trigger", () => this._openTriggerEditor());
    c.addEventListener("wfb:select-node", (e) => this._openStepEditor(e.detail.id));
    c.addEventListener("wfb:add-step", (e) => {
      const { parentId, branch, anchorEl } = e.detail;
      this._addMenu.openAt(anchorEl, { parentId, branch });
    });
    c.addEventListener("wfb:delete-step", (e) => {
      const id = e.detail.id;
      const found = this._state.findStep(id);
      if (!found) return;
      const step = found.step;
      if (step.type === "condition") {
        const yesCount = step.branches?.yes?.length || 0;
        const noCount  = step.branches?.no?.length  || 0;
        if (yesCount > 0 || noCount > 0) {
          // Three options: keep YES branch, keep NO branch, or remove all
          const choice = window.prompt(
            this._t("condition_remove_prompt"),
            yesCount > 0 ? "yes" : "no"
          );
          if (choice === null) return;
          const v = choice.trim().toLowerCase();
          if (!["yes", "no", "all"].includes(v)) return;
          this._state.removeConditionKeepBranch(id, v);
          this._render();
          this.emit("step:remove", { id });
          this._emitChange();
          return;
        }
      }
      this.removeStep(id);
    });
    c.addEventListener("wfb:toggle-step", (e) => {
      const id = e.detail.id;
      const found = this._state.findStep(id);
      if (!found) return;
      const newStatus = found.step.status === "inactive" ? "active" : "inactive";
      this.updateStep(id, { status: newStatus });
    });
  }

  _handleAddStep(type, ctx) {
    const { parentId, branch } = ctx;
    const position = branch ? `branch:${branch}` : "after";
    const step = this.addStep(parentId, type, position);

    // If we just added a condition that has siblings AFTER it, offer to move them into a branch.
    if (type === "condition" && this._state.hasSiblingsAfter(step.id)) {
      const choice = window.prompt(
        this._t("move_branch_prompt"),
        "yes"
      );
      if (choice !== null) {
        const v = choice.trim().toLowerCase();
        if (v === "yes" || v === "no") {
          this._state.moveSubsequentToBranch(step.id, v);
          this._render();
          this._emitChange();
        }
      }
    }

    // For condition we leave both branches empty; for others, open editor right away
    if (type !== "exit" && type !== "condition") {
      this._openStepEditor(step.id);
    } else {
      this.emit("step:select", { id: step.id });
    }
  }

  _render(rebuild = true) {
    if (rebuild) {
      // Recompute validation flags (silent) then schedule a structural rebuild
      const result = this._validator.validate(this._state.getWorkflow());
      const validatorIds = result.errors.filter((e) => e.id).map((e) => e.id);
      const pluginIds    = this._pluginErrors ? [...this._pluginErrors.keys()] : [];
      const allIds = [...new Set([...validatorIds, ...pluginIds])];
      const errorMessages = {};
      result.errors.forEach((e) => {
        if (e.id) {
          errorMessages[e.id] = errorMessages[e.id] || [];
          errorMessages[e.id].push(e.message);
        }
      });
      if (this._pluginErrors) {
        this._pluginErrors.forEach((msgs, id) => {
          errorMessages[id] = [...(errorMessages[id] || []), ...msgs];
        });
      }
      this._canvas.setErrorState(allIds, errorMessages);
      this._canvas.render(this._state.getWorkflow()); // batched via rAF
    } else {
      // Only selection or error classes changed — no DOM rebuild needed
      this._canvas.refreshVisual();
    }
  }

  _openTriggerEditor() {
    const wf = this._state.getWorkflow();
    this._canvas.setSelected(wf.trigger.id);
    this._render(false);
    this.emit("step:select", { id: wf.trigger.id, kind: "trigger" });

    // Build a 2-stage editor: pick trigger type, then config form
    const wrapper = document.createElement("div");

    const typeField = document.createElement("div");
    typeField.className = "wfb-field";
    typeField.innerHTML = `
    <label class="wfb-field__label">${this._t("trigger_type_label")}</label>
      <select class="wfb-input" id="wfb-trigger-type">
      <option value="">${this._t("trigger_type_placeholder")}</option>
        ${this._reg.triggers.list().map((t) => `<option value="${t.type}">${t.label}</option>`).join("")}
      </select>
    `;
    wrapper.appendChild(typeField);

    const formHost = document.createElement("div");
    wrapper.appendChild(formHost);

    const select = typeField.querySelector("select");
    if (wf.trigger.type) select.value = wf.trigger.type;

    let form = null;
    const renderTriggerForm = (type) => {
      formHost.innerHTML = "";
      form = null;
      if (!type) return;
      const schema = this._reg.triggers.getSchema(type);
      if (!schema) return;
      form = renderForm(schema, wf.trigger.type === type ? wf.trigger.config : {}, this._formCtx());
      formHost.appendChild(form.element);
    };
    renderTriggerForm(wf.trigger.type);
    select.addEventListener("change", () => renderTriggerForm(select.value));

    // ── Auto-commit ─────────────────────────────────────────────────────────
    // Every form change is immediately committed to the workflow state and
    // emitted via workflow:change so the host React component always has the
    // latest values — no Save button needed.
    const autoCommit = () => {
      const type = select.value;
      if (!type) return;
      const config = form ? form.getValues() : {};
      // Full replacement (not merge) so switching trigger types clears stale config.
      this._state.setTriggerFields(type, config);
      const result = this._validator.validate(this._state.getWorkflow());
      this._canvas.setErrorIds(result.errors.filter((e) => e.id).map((e) => e.id));
      this._canvas.render(this._state.getWorkflow());
      this._emitChange();
    };
    wrapper.addEventListener("input",  autoCommit);
    wrapper.addEventListener("change", autoCommit);

    this._sidebar.open({
      title: "Configure trigger",
      content: wrapper,
      onCommit: autoCommit,
    });
  }

  _openStepEditor(stepId) {
    const found = this._state.findStep(stepId);
    if (!found) return;
    const step = found.step;

    this._canvas.setSelected(stepId);
    this._render(false);
    this.emit("step:select", { id: stepId, kind: "step" });

    // Step plugin: if a module matching the step type is registered, delegate to
    // it instead of opening the standard form sidebar.
    const plugin = this._modules[step.type];
    if (typeof plugin === "function") {
      plugin({
        config: { ...(step.config || {}) },
        step: { id: step.id, type: step.type, title: step.title, enabled: step.enabled, status: step.status },
        // Plugins may pass an optional root-level step patch as the second
        // argument. Apply config + root fields in one state mutation so hosts
        // receive exactly one authoritative workflow:change event.
        onSave: (newConfig, stepPatch = {}) => {
          const rootPatch = stepPatch && typeof stepPatch === "object" && !Array.isArray(stepPatch)
            ? stepPatch
            : {};
          this.updateStep(stepId, { ...rootPatch, config: newConfig });
        },
        /**
         * Report validation errors back to the canvas from inside a plugin.
         * Call with a non-empty array to show the error badge; call with []
         * (or omit) to clear. See `setStepErrors` for full documentation.
         *
         * @param {string[]} errors
         */
        onReportErrors: (errors) => {
          this.setStepErrors(stepId, errors);
        },
        onClose: () => {},
      });
      return;
    }

    const def = this._reg.steps.get(step.type);
    if (!def) return;
    const schema = this._reg.steps.getSchema(step.type);

    const statusObj = step.type === "exit" ? null : {
      value: step.status || "active",
      onToggle: (newStatus) => {
        this.updateStep(stepId, { status: newStatus }); // immediately committed + emits
      },
    };

    // Build "extras": step-level conditions panel
    let extrasNode = null;
    let extrasForm = null;
    const condSchema = this._reg.shared?.conditions;
    const showExtras = condSchema && step.type !== "condition" && step.type !== "exit";
    if (showExtras) {
      extrasNode = document.createElement("div");
      extrasNode.className = "wfb-section";
      const title = document.createElement("h4");
      title.className = "wfb-section__title";
      title.textContent = this._t("additional_conditions");
      extrasNode.appendChild(title);
      const help = document.createElement("div");
      help.className = "wfb-info";
      help.textContent = this._t("conditions_help");
      extrasNode.appendChild(help);

      const initial = (step.conditions && typeof step.conditions === "object" && !Array.isArray(step.conditions))
        ? { match: step.conditions.match === "any" ? "any" : "all", items: Array.isArray(step.conditions.items) ? step.conditions.items : [] }
        : { match: "all", items: Array.isArray(step.conditions) ? step.conditions : [] };

      const wrapperSchema = {
        fields: [
          {
            name: "conditions",
            label: "",
            type: "condition_group",
            add_label: this._t("add_condition"),
            item_label: condSchema.item_label || "Condition",
            item_fields: condSchema.item_fields,
            default_match: "all",
          },
        ],
      };
      extrasForm = renderForm(wrapperSchema, { conditions: initial }, this._formCtx());
      extrasNode.appendChild(extrasForm.element);
    }

    // Exit step has no schema → just show summary
    if (!schema) {
      const div = document.createElement("div");
      div.className = "wfb-empty";
      div.textContent = `${def.label}: ${def.description || this._t("no_configuration")}`;
      this._sidebar.open({ title: def.label, content: div, status: statusObj });
      return;
    }

    const form = renderForm(schema, step.config || {}, this._formCtx());

    // ── Auto-commit ──────────────────────────────────────────────────────────
    // Every change to the config or conditions is immediately committed to the
    // workflow state and emitted via workflow:change.
    const autoCommit = () => {
      const patch = { config: form.getValues() };
      if (extrasForm) {
        const group = extrasForm.getValues().conditions || { match: "all", items: [] };
        patch.conditions = {
          match: group.match === "any" ? "any" : "all",
          items: Array.isArray(group.items) ? group.items : [],
        };
      }
      this._state.updateStep(stepId, patch);
      const result = this._validator.validate(this._state.getWorkflow());
      this._canvas.setErrorIds(result.errors.filter((e) => e.id).map((e) => e.id));
      this._canvas.render(this._state.getWorkflow());
      this._emitChange();
    };
    form.element.addEventListener("input",  autoCommit);
    form.element.addEventListener("change", autoCommit);
    if (extrasForm) {
      extrasForm.element.addEventListener("input",  autoCommit);
      extrasForm.element.addEventListener("change", autoCommit);
    }

    this._sidebar.open({
      title: def.label,
      content: form.element,
      extras: extrasNode,
      status: statusObj,
      onCommit: autoCommit,
    });
  }
}
