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

export class WorkflowBuilder extends EventEmitter {
  constructor({ container, workflow, registries, extensions, dataProvider, modules, onChange, onSave }) {
    super();
    this._containerSel = container;
    this._initialWorkflow = workflow || null;
    this._registriesSrc = registries || defaultDefinitions;
    this._extensions = Array.isArray(extensions) ? [...extensions] : [];
    this._dataProvider = dataProvider || createDefaultDataProvider();
    this._modules = { ...(modules || {}) };
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

  async mount() {
    this._container = typeof this._containerSel === "string"
      ? document.querySelector(this._containerSel)
      : this._containerSel;
    if (!this._container) throw new Error("WorkflowBuilder: container not found");

    this._reg = await buildRegistries(this._registriesSrc, this._extensions);
    this._state = new WorkflowState(this._initialWorkflow);
    this._validator = new WorkflowValidator(this._reg.steps, this._reg.triggers);

    // Build DOM shell — both classes are added so consumers can scope overrides
    // via either the legacy `.wfb-root` selector or the namespaced `.oml-workflow-builder`.
    this._root = document.createElement("div");
    this._root.className = "wfb-root oml-workflow-builder";

    this._canvas = new Canvas({
      stepRegistry: this._reg.steps,
      triggerRegistry: this._reg.triggers,
    });
    this._addMenu = new AddStepMenu(this._reg.steps, (type, ctx) => this._handleAddStep(type, ctx));
    this._sidebar = new Sidebar();

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
    this._render();
  }

  unmount() {
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
    this._canvas.setErrorIds(result.errors.filter((e) => e.id).map((e) => e.id));
    this._render(false);
    if (!result.valid) this.emit("validation:error", result);
    return result;
  }
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
            "Removing this condition. What should happen with its branches?\n" +
            "Type:  yes  to keep the YES branch in place\n" +
            "       no   to keep the NO branch in place\n" +
            "       all  to remove the condition AND both branches\n" +
            "Cancel to abort.",
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
      this.updateStep(id, { enabled: !found.step.enabled });
    });
  }

  _handleAddStep(type, ctx) {
    const { parentId, branch } = ctx;
    const position = branch ? `branch:${branch}` : "after";
    const step = this.addStep(parentId, type, position);

    // If we just added a condition that has siblings AFTER it, offer to move them into a branch.
    if (type === "condition" && this._state.hasSiblingsAfter(step.id)) {
      const choice = window.prompt(
        "There are steps after this condition. Move them into a branch?\n" +
        "Type:  yes  to move them under the YES branch\n" +
        "       no   to move them under the NO branch\n" +
        "Cancel or anything else to leave them in place.",
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
      // recompute validation flags (silent)
      const result = this._validator.validate(this._state.getWorkflow());
      this._canvas.setErrorIds(result.errors.filter((e) => e.id).map((e) => e.id));
    }
    this._canvas.render(this._state.getWorkflow());
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
      <label class="wfb-field__label">Trigger type</label>
      <select class="wfb-input" id="wfb-trigger-type">
        <option value="">Select trigger…</option>
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

    this._sidebar.open({
      title: "Configure trigger",
      content: wrapper,
      onSave: () => {
        const type = select.value;
        if (!type) { alert("Please choose a trigger type."); return; }
        let config = {};
        if (form) {
          const v = form.validate();
          if (!v.valid) return;
          config = form.getValues();
        }
        this.updateTrigger({ type, config });
        this._sidebar.close();
      },
    });
  }

  _openStepEditor(stepId) {
    const found = this._state.findStep(stepId);
    if (!found) return;
    const step = found.step;
    this._canvas.setSelected(stepId);
    this._render(false);
    this.emit("step:select", { id: stepId, kind: "step" });

    const def = this._reg.steps.get(step.type);
    if (!def) return;
    const schema = this._reg.steps.getSchema(step.type);

    const status = step.type === "exit" ? null : {
      enabled: !!step.enabled,
      onToggle: (enabled) => this.updateStep(stepId, { enabled }),
    };

    // Build "extras": step-level conditions panel (skip for trigger/condition/exit and when shared schema absent)
    let extrasNode = null;
    let extrasForm = null;
    const condSchema = this._reg.shared?.conditions;
    const showExtras = condSchema && step.type !== "condition" && step.type !== "exit";
    if (showExtras) {
      extrasNode = document.createElement("div");
      extrasNode.className = "wfb-section";
      const title = document.createElement("h4");
      title.className = "wfb-section__title";
      title.textContent = "Additional conditions";
      extrasNode.appendChild(title);
      const help = document.createElement("div");
      help.className = "wfb-info";
      help.textContent = "Only execute this step if the conditions below are met.";
      extrasNode.appendChild(help);

      // Normalise step.conditions into { match, items }
      const initial = (step.conditions && typeof step.conditions === "object" && !Array.isArray(step.conditions))
        ? { match: step.conditions.match === "any" ? "any" : "all", items: Array.isArray(step.conditions.items) ? step.conditions.items : [] }
        : { match: "all", items: Array.isArray(step.conditions) ? step.conditions : [] };

      const wrapperSchema = {
        fields: [
          {
            name: "conditions",
            label: "",
            type: "condition_group",
            add_label: "Add condition",
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
      div.textContent = `${def.label}: ${def.description || "No configuration."}`;
      this._sidebar.open({ title: def.label, content: div, hideFooter: true, status });
      return;
    }

    const form = renderForm(schema, step.config || {}, this._formCtx());
    this._sidebar.open({
      title: def.label,
      content: form.element,
      extras: extrasNode,
      status,
      onSave: () => {
        const v = form.validate();
        if (!v.valid) return;
        const patch = { config: form.getValues() };
        if (extrasForm) {
          const ev = extrasForm.validate();
          if (!ev.valid) return;
          const group = extrasForm.getValues().conditions || { match: "all", items: [] };
          patch.conditions = {
            match: group.match === "any" ? "any" : "all",
            items: Array.isArray(group.items) ? group.items : [],
          };
        }
        this.updateStep(stepId, patch);
        this._sidebar.close();
      },
    });
  }
}
