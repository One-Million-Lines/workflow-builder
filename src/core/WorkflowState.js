import { uid, deepClone } from "./utils.js";

/**
 * WorkflowState keeps the canonical (nested) workflow JSON in memory.
 * Internally we use the same nested format as the exported one for simplicity.
 */
export class WorkflowState {
  constructor(workflow) {
    this.workflow = this._normalize(workflow);
  }

  _normalize(wf) {
    const w = deepClone(wf || {});
    w.id = w.id || uid("workflow");
    w.name = w.name || "Untitled workflow";
    w.status = w.status || "draft";
    w.version = w.version || 1;
    w.metadata = w.metadata || {
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
    w.trigger = w.trigger || { id: uid("trigger"), type: null, config: {} };
    if (!w.trigger.id) w.trigger.id = uid("trigger");
    if (!w.trigger.config) w.trigger.config = {};
    w.steps = Array.isArray(w.steps) ? w.steps.map((s) => this._normalizeStep(s)) : [];
    return w;
  }

  _normalizeStep(step) {
    const s = deepClone(step);
    if (!s.id) s.id = uid("step");
    if (!("enabled" in s)) s.enabled = true;
    if (!s.config) s.config = {};
    if (s.type === "condition") {
      s.branches = s.branches || { yes: [], no: [] };
      s.branches.yes = (s.branches.yes || []).map((c) => this._normalizeStep(c));
      s.branches.no = (s.branches.no || []).map((c) => this._normalizeStep(c));
    }
    if (!Array.isArray(s.conditions)) {
      // New canonical shape: { match: "all"|"any", items: [...] }
      if (!s.conditions || typeof s.conditions !== "object") {
        s.conditions = { match: "all", items: [] };
      } else {
        s.conditions = {
          match: s.conditions.match === "any" ? "any" : "all",
          items: Array.isArray(s.conditions.items) ? s.conditions.items : [],
        };
      }
    } else {
      // Back-compat: old array form
      s.conditions = { match: "all", items: s.conditions };
    }
    return s;
  }

  getWorkflow() {
    return deepClone(this.workflow);
  }

  setWorkflow(workflow) {
    this.workflow = this._normalize(workflow);
  }

  updateTrigger(patch) {
    this.workflow.trigger = {
      ...this.workflow.trigger,
      ...patch,
      config: { ...this.workflow.trigger.config, ...(patch.config || {}) },
    };
    this._touch();
  }

  /**
   * Find a step by id, returning {step, parentList, index, branch}.
   */
  findStep(stepId, list = this.workflow.steps, parentList = null) {
    for (let i = 0; i < list.length; i++) {
      const step = list[i];
      if (step.id === stepId) {
        return { step, parentList: list, index: i };
      }
      if (step.type === "condition") {
        const inYes = this.findStep(stepId, step.branches.yes, step.branches.yes);
        if (inYes) return inYes;
        const inNo = this.findStep(stepId, step.branches.no, step.branches.no);
        if (inNo) return inNo;
      }
    }
    return null;
  }

  /**
   * Insert a new step.
   * - parentId: "trigger" or step id, or null/undefined for root tail.
   * - position: "after" (default) or "branch:yes" / "branch:no" when parent is a condition.
   */
  addStep(parentId, type, position = "after") {
    const newStep = this._normalizeStep({ id: uid("step"), type, config: {} });

    if (!parentId || parentId === this.workflow.trigger.id || parentId === "trigger") {
      this.workflow.steps.unshift(newStep);
      this._touch();
      return newStep;
    }

    const found = this.findStep(parentId);
    if (!found) throw new Error(`Parent step ${parentId} not found`);

    if (position.startsWith("branch:")) {
      const branch = position.split(":")[1];
      if (found.step.type !== "condition") throw new Error("Parent is not a condition");
      found.step.branches[branch].unshift(newStep);
    } else {
      found.parentList.splice(found.index + 1, 0, newStep);
    }
    this._touch();
    return newStep;
  }

  removeStep(stepId) {
    const found = this.findStep(stepId);
    if (!found) return false;
    found.parentList.splice(found.index, 1);
    this._touch();
    return true;
  }

  /**
   * Move all siblings appearing AFTER the given condition step into one of its branches (yes|no).
   * Returns the moved steps (original order preserved).
   */
  moveSubsequentToBranch(conditionStepId, branch) {
    const found = this.findStep(conditionStepId);
    if (!found || found.step.type !== "condition") return [];
    const moved = found.parentList.splice(found.index + 1, found.parentList.length - found.index - 1);
    found.step.branches[branch].push(...moved);
    this._touch();
    return moved;
  }

  /**
   * Remove a condition step but keep one of its branches inline at the same position.
   * If branch is "all", just removes the condition (drops both branches).
   */
  removeConditionKeepBranch(conditionStepId, branch) {
    const found = this.findStep(conditionStepId);
    if (!found || found.step.type !== "condition") return false;
    const keep = branch === "yes" || branch === "no" ? found.step.branches[branch] || [] : [];
    found.parentList.splice(found.index, 1, ...keep);
    this._touch();
    return true;
  }

  hasSiblingsAfter(stepId) {
    const found = this.findStep(stepId);
    if (!found) return false;
    return found.index < found.parentList.length - 1;
  }

  updateStep(stepId, patch) {
    const found = this.findStep(stepId);
    if (!found) return false;
    const s = found.step;
    if (patch.config) s.config = { ...s.config, ...patch.config };
    if ("enabled" in patch) s.enabled = patch.enabled;
    if ("conditions" in patch) {
      const c = patch.conditions;
      if (Array.isArray(c)) s.conditions = { match: "all", items: c };
      else if (c && typeof c === "object") {
        s.conditions = {
          match: c.match === "any" ? "any" : "all",
          items: Array.isArray(c.items) ? c.items : [],
        };
      } else {
        s.conditions = { match: "all", items: [] };
      }
    }
    if ("label" in patch) s.label = patch.label;
    this._touch();
    return true;
  }

  _touch() {
    this.workflow.metadata.updated_at = new Date().toISOString();
  }
}
