import { icon } from "../ui/Icon.js";
import { defaultT } from "../i18n/index.js";

/**
 * Pure rendering helpers for trigger and step nodes.
 */

export function renderTriggerNode(trigger, triggerDef, { selected, t = defaultT }) {
  const node = document.createElement("div");
  node.className = "wfb-node wfb-node--trigger" + (selected ? " wfb-node--selected" : "");
  node.dataset.id = trigger.id;
  const label = triggerDef ? triggerDef.label : trigger.type || t("choose_trigger");
  const summary = summarizeTrigger(trigger, t);
  node.innerHTML = `
    <div class="wfb-node__badge">${t("trigger_badge")}</div>
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

export function renderStepNode(step, stepDef, { selected, hasError, hasPlugin, t = defaultT }) {
  const node = document.createElement("div");
  const cls = ["wfb-node", `wfb-node--${step.type}`];
  if (selected) cls.push("wfb-node--selected");
  // Use canonical status field; fall back to enabled for backward compat
  const isInactive = step.status === "inactive" || (!("status" in step) && step.enabled === false);
  if (isInactive) cls.push("wfb-node--disabled");
  if (hasError) cls.push("wfb-node--error");
  if (hasPlugin) cls.push("wfb-node--plugin");
  node.className = cls.join(" ");
  node.dataset.id = step.id;

  const summary = summarizeStep(step, t);
  const condCount = Array.isArray(step.conditions)
    ? step.conditions.length
    : (step.conditions && Array.isArray(step.conditions.items) ? step.conditions.items.length : 0);
  const condMatch = step.conditions && step.conditions.match === "any" ? "any" : "all";
  const extra = condCount
    ? ` <span class="wfb-node__chip" title="${condCount} extra condition(s), match ${condMatch}">+${condCount} ${condMatch === "any" ? "any" : "all"}</span>`
    : "";
  const statusLabel = isInactive ? t("status_inactive") : t("status_active");
  const toggleLabel = isInactive ? t("set_active") : t("set_inactive");
  node.innerHTML = `
    <div class="wfb-node__row">
      <span class="wfb-node__status" title="${statusLabel}"></span>
      <span class="wfb-node__icon">${icon(stepDef?.icon || "gear", { size: 18 })}</span>
      <div class="wfb-node__content">
        <div class="wfb-node__title">${escapeHtml(stepDef?.label || step.type)}${extra}</div>
        <div class="wfb-node__summary">${escapeHtml(summary)}</div>
      </div>
      <div class="wfb-node__actions">
        <button class="wfb-status-toggle wfb-status-toggle--${isInactive ? "inactive" : "active"}"
          data-act="toggle" title="${toggleLabel}" type="button">
          ${isInactive ? escapeHtml(t("status_inactive")) : escapeHtml(t("status_active"))}
        </button>
        <button class="wfb-iconbtn" data-act="delete" title="${t("delete")}" type="button">${icon("trash", { size: 14 })}</button>
      </div>
    </div>
    ${hasError ? `<div class="wfb-node__error-flag" title="${t("config_incomplete")}">${icon("alert", { size: 12 })}</div>` : ""}
    ${hasPlugin ? `<div class="wfb-node__plugin-badge" title="Managed by plugin">${icon("link", { size: 10 })}</div>` : ""}
  `;
  return node;
}

function summarizeTrigger(t_obj, t = defaultT) {
  if (!t_obj.type) return t("click_to_configure");
  const c = t_obj.config || {};
  if (t_obj.type === "user_segment") {
    const s = c.segment_id ? `Segment: ${c.segment_id}` : t("summary_choose_segment");
    return c.repeat_flag ? `${s} • recurring` : s;
  }
  if (t_obj.type === "user_events") {
    const events = Array.isArray(c.events) ? c.events.filter((e) => e?.event) : [];
    if (!events.length) return t("summary_choose_event");
    const names = events.map((e) => e.event).join(", ");
    return events.length > 1 ? `Events (${events.length}): ${names}` : `Event: ${names}`;
  }
  if (t_obj.type === "api_request") return c.endpoint ? `Endpoint: ${c.endpoint}` : t("summary_define_endpoint");
  if (t_obj.type === "back_in_stock") return `Back in stock • ${c.activity_days || 30}d`;
  if (t_obj.type === "price_change") {
    const dir = c.direction || "any";
    return `Price change: ${dir} (${c.price_diff ?? -10}%)`;
  }
  return t("summary_configured");
}

function summarizeStep(s, t = defaultT) {
  const c = s.config || {};
  switch (s.type) {
    case "email": {
      const tpl = c.template || {};
      const subj = c.subject || tpl.subject;
      return subj || (c.template_id ? `Template ${c.template_id}` : t("click_to_configure"));
    }
    case "sms": return c.template_id ? `Template ${c.template_id}` : (c.message ? truncate(c.message, 50) : t("click_to_configure"));
    case "whatsapp": return c.template_id ? `Template ${c.template_id}` : (c.message ? truncate(c.message, 50) : t("click_to_configure"));
    case "webpush": return c.title || t("click_to_configure");
    case "delay":
      if (c.mode === "now") return t("summary_continue_immediately");
      if (c.mode === "expression") return c.expression || t("summary_set_expression");
      return c.value ? `Wait ${c.value} ${c.unit || ""}` : t("summary_set_delay");
    case "action": return summarizeAction(c, t);
    case "condition": return summarizeCondition(c, t);
    case "http_request":
      return c.url ? `${(c.method || "GET").toUpperCase()} ${truncate(c.url, 40)}` : t("summary_configure_http");
    case "exit": return t("summary_stops_branch");
    default: return "";
  }
}

function summarizeAction(c, t = defaultT) {
  if (!c.action_type) return t("summary_choose_action");
  switch (c.action_type) {
    case "update_attribute": {
      const n = Array.isArray(c.attributes) ? c.attributes.length : 0;
      return `Update attribute [${n}]`;
    }
    case "add_tag": return c.tag_name ? `${t("summary_add_tag")}: ${truncate(c.tag_name, 30)}` : t("summary_add_tag");
    case "remove_tag": return c.tag_name ? `${t("summary_remove_tag")}: ${truncate(c.tag_name, 30)}` : t("summary_remove_tag");
    case "update_list_status": return `List ${c.list_id || "?"} → ${c.list_status || "?"}`;
    default: return c.action_type.replace(/_/g, " ");
  }
}

function summarizeCondition(c, t = defaultT) {
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
      return c.field ? `${c.field} ${c.operator || ""} ${c.value ?? ""}` : t("click_to_configure");
  }
}

function truncate(s, n) { return s.length > n ? s.slice(0, n - 1) + "…" : s; }

function escapeHtml(s) {
  return String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
}
