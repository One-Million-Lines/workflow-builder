/**
 * WorkflowValidator returns a list of errors and warnings for a workflow.
 */
export class WorkflowValidator {
  constructor(stepRegistry, triggerRegistry) {
    this.stepRegistry = stepRegistry;
    this.triggerRegistry = triggerRegistry;
  }

  validate(workflow) {
    const errors = [];
    const warnings = [];
    const seenIds = new Set();

    if (!workflow.trigger || !workflow.trigger.type) {
      errors.push({ scope: "workflow", message: "Workflow must have a trigger." });
    } else if (this.triggerRegistry && !this.triggerRegistry.get(workflow.trigger.type)) {
      errors.push({ scope: "trigger", message: `Unknown trigger type "${workflow.trigger.type}".` });
    } else {
      this._validateTriggerConfig(workflow.trigger).forEach((m) =>
        errors.push({ scope: "trigger", id: workflow.trigger.id, message: m })
      );
    }

    if (!workflow.steps || workflow.steps.length === 0) {
      warnings.push({ scope: "workflow", message: "Workflow has no steps." });
    }

    const walk = (steps, path = "root") => {
      steps.forEach((step, idx) => {
        const here = `${path}[${idx}]`;
        if (!step.id) errors.push({ scope: "step", message: `${here}: missing id.` });
        if (seenIds.has(step.id)) errors.push({ scope: "step", id: step.id, message: `Duplicate step id ${step.id}.` });
        seenIds.add(step.id);

        const def = this.stepRegistry?.get(step.type);
        if (!def) {
          errors.push({ scope: "step", id: step.id, message: `Unknown step type "${step.type}".` });
          return;
        }

        const stepErrors = this._validateStepConfig(step, def);
        stepErrors.forEach((e) => errors.push({ scope: "step", id: step.id, message: e }));

        if (step.type === "condition") {
          if (!step.branches) {
            errors.push({ scope: "step", id: step.id, message: "Condition has no branches." });
          } else {
            if ((step.branches.yes || []).length === 0) warnings.push({ scope: "step", id: step.id, message: "Yes branch is empty." });
            if ((step.branches.no || []).length === 0) warnings.push({ scope: "step", id: step.id, message: "No branch is empty." });
            walk(step.branches.yes || [], `${here}.yes`);
            walk(step.branches.no || [], `${here}.no`);
          }
        }

        if (step.type === "exit" && idx !== steps.length - 1) {
          warnings.push({ scope: "step", id: step.id, message: "Exit step has steps after it; they will not run." });
        }
      });
    };

    walk(workflow.steps || []);

    return { valid: errors.length === 0, errors, warnings };
  }

  _validateStepConfig(step, def) {
    const errors = [];
    const cfg = step.config || {};
    switch (step.type) {
      case "email": {
        const tpl = cfg.template || {};
        const subject = cfg.subject || tpl.subject;
        const body    = cfg.content || tpl.html || tpl.text;
        if (!subject) errors.push("Email requires a subject.");
        if (!cfg.template_id && !body) errors.push("Email requires a template or content.");
        break;
      }
      case "sms":
        if (!cfg.message) errors.push("SMS requires a message.");
        break;
      case "whatsapp":
        if (!cfg.message) errors.push("WhatsApp requires a message.");
        break;
      case "webpush":
        if (!cfg.title) errors.push("Webpush requires a title.");
        if (!cfg.message) errors.push("Webpush requires a message.");
        break;
      case "delay":
        if (!cfg.mode) errors.push("Delay requires a mode.");
        if (cfg.mode === "value" && (!cfg.value || !cfg.unit)) errors.push("Delay requires value and unit.");
        if (cfg.mode === "expression" && !cfg.expression) errors.push("Delay requires an expression.");
        break;
      case "action":
        if (!cfg.action_type) errors.push("Action requires an action type.");
        else if (cfg.action_type === "update_attribute") {
          const list = Array.isArray(cfg.attributes) ? cfg.attributes : [];
          if (!list.length) errors.push("Update attribute requires at least one attribute.");
          if (list.some((a) => !a.field)) errors.push("Each attribute requires a name.");
        } else if (cfg.action_type === "add_tag" || cfg.action_type === "remove_tag") {
          if (!cfg.tag_name) errors.push("Tag action requires a tag name.");
        } else if (cfg.action_type === "update_list_status") {
          if (!cfg.list_id) errors.push("List action requires a list id.");
          if (!cfg.list_status) errors.push("List action requires a status.");
        }
        break;
      case "condition":
        if (!cfg.condition_type) {
          errors.push("Condition requires a type.");
        } else if (cfg.condition_type === "user_attributes") {
          const list = Array.isArray(cfg.userconditions) ? cfg.userconditions : [];
          if (!list.length) errors.push("User attribute condition requires at least one rule.");
          if (list.some((r) => !r.field)) errors.push("Each rule requires a field.");
        } else if (cfg.condition_type === "random") {
          const y = Number(cfg.random_yes ?? 0);
          const n = Number(cfg.random_no ?? 0);
          if (y + n !== 100) errors.push("Random YES + NO must equal 100.");
        } else if (cfg.condition_type === "user_activity") {
          const list = Array.isArray(cfg.activity_list) ? cfg.activity_list : [];
          if (!list.length) errors.push("User activity condition requires at least one event.");
        } else if (cfg.condition_type === "workflow_status") {
          if (cfg.what_workflow === "other" && !cfg.workflow_ids) {
            errors.push("Workflow status requires workflow IDs when targeting other workflows.");
          }
        }
        break;
      case "http_request":
        if (!cfg.method) errors.push("HTTP request requires a method.");
        if (!cfg.url || !String(cfg.url).trim()) errors.push("HTTP request requires a URL.");
        break;
    }
    // step-level extra conditions
    const condItems = Array.isArray(step.conditions)
      ? step.conditions
      : (step.conditions && Array.isArray(step.conditions.items) ? step.conditions.items : []);
    condItems.forEach((c, i) => {
      if (!c.field) errors.push(`Extra condition #${i + 1} requires a field.`);
    });
    return errors;
  }

  _validateTriggerConfig(trigger) {
    const errors = [];
    const c = trigger.config || {};
    switch (trigger.type) {
      case "user_events": {
        const events = Array.isArray(c.events) ? c.events : [];
        if (!events.length) errors.push("Trigger requires at least one event.");
        if (events.some((e) => !e.event)) errors.push("Each trigger event requires a name.");
        break;
      }
      case "user_segment":
        if (!c.segment_id) errors.push("Segment trigger requires a segment id.");
        if (c.repeat_flag && !c.recurring) errors.push("Recurring schedule is required when repeating.");
        break;
      case "api_request":
        if (!c.endpoint) errors.push("API trigger requires an endpoint.");
        break;
      case "back_in_stock":
      case "price_change":
        if (c.activity_days !== undefined && Number(c.activity_days) <= 0) {
          errors.push("Activity days must be greater than 0.");
        }
        break;
    }
    return errors;
  }
}
