import { icon } from "../ui/Icon.js";

/**
 * Pure rendering helpers for trigger and step nodes.
 */

export function renderTriggerNode(trigger, triggerDef, { selected }) {
  const node = document.createElement("div");
  node.className = "wfb-node wfb-node--trigger" + (selected ? " wfb-node--selected" : "");
  node.dataset.id = trigger.id;
  const label = triggerDef ? triggerDef.label : trigger.type || "Choose trigger";
  const summary = summarizeTrigger(trigger);
  node.innerHTML = `
    <div class="wfb-node__badge">Trigger</div>
    <div class="wfb-node__row">
      <span class="wfb-node__icon">${icon(triggerDef?.icon || "activity", { size: 18 })}</span>
      <div class="wfb-node__content">
        <div class="wfb-node__title">${escapeHtml(label)}</div>
        <div class="wfb-node__summary">${escapeHtml(summary)}</div>
      </div>
    </div>
  `;
  return node;
}

export function renderStepNode(step, stepDef, { selected, hasError }) {
  const node = document.createElement("div");
  const cls = ["wfb-node", `wfb-node--${step.type}`];
  if (selected) cls.push("wfb-node--selected");
  if (!step.enabled) cls.push("wfb-node--disabled");
  if (hasError) cls.push("wfb-node--error");
  node.className = cls.join(" ");
  node.dataset.id = step.id;

  const summary = summarizeStep(step);
  const condCount = Array.isArray(step.conditions)
    ? step.conditions.length
    : (step.conditions && Array.isArray(step.conditions.items) ? step.conditions.items.length : 0);
  const condMatch = step.conditions && step.conditions.match === "any" ? "any" : "all";
  const extra = condCount
    ? ` <span class="wfb-node__chip" title="${condCount} extra condition(s), match ${condMatch}">+${condCount} ${condMatch === "any" ? "any" : "all"}</span>`
    : "";
  node.innerHTML = `
    <div class="wfb-node__row">
      <span class="wfb-node__status" title="${step.enabled ? "Enabled" : "Disabled"}"></span>
      <span class="wfb-node__icon">${icon(stepDef?.icon || "gear", { size: 18 })}</span>
      <div class="wfb-node__content">
        <div class="wfb-node__title">${escapeHtml(stepDef?.label || step.type)}${extra}</div>
        <div class="wfb-node__summary">${escapeHtml(summary)}</div>
      </div>
      <div class="wfb-node__actions">
        <button class="wfb-iconbtn" data-act="toggle" title="Enable/Disable" type="button">${icon("power", { size: 14 })}</button>
        <button class="wfb-iconbtn" data-act="delete" title="Delete" type="button">${icon("trash", { size: 14 })}</button>
      </div>
    </div>
    ${hasError ? `<div class="wfb-node__error-flag" title="Configuration incomplete">${icon("alert", { size: 12 })}</div>` : ""}
  `;
  return node;
}

function summarizeTrigger(t) {
  if (!t.type) return "Click to configure";
  const c = t.config || {};
  if (t.type === "user_segment") {
    const s = c.segment_id ? `Segment: ${c.segment_id}` : "Choose segment";
    return c.repeat_flag ? `${s} • recurring` : s;
  }
  if (t.type === "user_events") {
    const events = Array.isArray(c.events) ? c.events.filter((e) => e?.event) : [];
    if (!events.length) return "Choose event(s)";
    const names = events.map((e) => e.event).join(", ");
    return events.length > 1 ? `Events (${events.length}): ${names}` : `Event: ${names}`;
  }
  if (t.type === "api_request") return c.endpoint ? `Endpoint: ${c.endpoint}` : "Define endpoint";
  if (t.type === "back_in_stock") return `Back in stock • ${c.activity_days || 30}d`;
  if (t.type === "price_change") {
    const dir = c.direction || "any";
    return `Price change: ${dir} (${c.price_diff ?? -10}%)`;
  }
  return "Configured";
}

function summarizeStep(s) {
  const c = s.config || {};
  switch (s.type) {
    case "email": {
      const tpl = c.template || {};
      const subj = c.subject || tpl.subject;
      return subj || (c.template_id ? `Template ${c.template_id}` : "Click to configure");
    }
    case "sms": return c.message ? truncate(c.message, 50) : "Click to configure";
    case "whatsapp": return c.message ? truncate(c.message, 50) : "Click to configure";
    case "webpush": return c.title || "Click to configure";
    case "delay":
      if (c.mode === "now") return "Continue immediately";
      if (c.mode === "expression") return c.expression || "Set expression";
      return c.value ? `Wait ${c.value} ${c.unit || ""}` : "Set delay";
    case "action": return summarizeAction(c);
    case "condition": return summarizeCondition(c);
    case "http_request":
      return c.url ? `${(c.method || "GET").toUpperCase()} ${truncate(c.url, 40)}` : "Configure HTTP request";
    case "exit": return "Stops this branch";
    default: return "";
  }
}

function summarizeAction(c) {
  if (!c.action_type) return "Choose action";
  switch (c.action_type) {
    case "update_attribute": {
      const n = Array.isArray(c.attributes) ? c.attributes.length : 0;
      return `Update attribute [${n}]`;
    }
    case "add_tag": return c.tag_name ? `Add tag: ${truncate(c.tag_name, 30)}` : "Add tag";
    case "remove_tag": return c.tag_name ? `Remove tag: ${truncate(c.tag_name, 30)}` : "Remove tag";
    case "update_list_status": return `List ${c.list_id || "?"} → ${c.list_status || "?"}`;
    default: return c.action_type.replace(/_/g, " ");
  }
}

function summarizeCondition(c) {
  switch (c.condition_type) {
    case "user_attributes": {
      const n = Array.isArray(c.userconditions) ? c.userconditions.length : 0;
      return `User attributes: ${n}`;
    }
    case "random":
      return `Random: ${c.random_yes ?? 50}-${c.random_no ?? 50}`;
    case "user_activity": {
      const n = Array.isArray(c.activity_list) ? c.activity_list.length : 0;
      return `Activity: ${c.activity_count || "did"} ${n} event${n === 1 ? "" : "s"} since ${c.activity_since || "begin"}`;
    }
    case "workflow_status": {
      const target = c.what_workflow === "current" ? "this workflow" : (c.workflow_ids || "other");
      return `Workflow: ${target} ${c.workflow_is || ""}`.trim();
    }
    default:
      return c.field ? `${c.field} ${c.operator || ""} ${c.value ?? ""}` : "Click to configure";
  }
}

function truncate(s, n) { return s.length > n ? s.slice(0, n - 1) + "…" : s; }

function escapeHtml(s) {
  return String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
}
