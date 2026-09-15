/** English locale (default). */
export default {
  // ── Node / Canvas ──────────────────────────────────────────────────────
  trigger_badge: "Trigger",
  choose_trigger: "Choose trigger",
  click_to_configure: "Click to configure",
  enabled: "Enabled",
  disabled: "Disabled",
  enable_disable: "Enable/Disable",
  status_active: "Active",
  status_inactive: "Inactive",
  set_active: "Set active",
  set_inactive: "Set inactive",
  delete: "Delete",
  config_incomplete: "Configuration incomplete",
  add_step: "Add step",

  // ── Add-step menu ──────────────────────────────────────────────────────
  add_step_header: "Add step to your workflow",

  // ── Sidebar ────────────────────────────────────────────────────────────
  sidebar_default_title: "Configuration",
  sidebar_enabled_label: "Enabled",
  sidebar_cancel: "Cancel",
  sidebar_save: "Save",
  sidebar_toggle_width: "Toggle sidebar width",
  sidebar_expand: "Expand sidebar",
  sidebar_shrink: "Shrink sidebar",
  sidebar_close: "Close",

  // ── Trigger editor ─────────────────────────────────────────────────────
  trigger_type_label: "Trigger type",
  trigger_type_placeholder: "Select trigger…",
  trigger_type_required: "Please choose a trigger type.",

  // ── Step editor ────────────────────────────────────────────────────────
  additional_conditions: "Additional conditions",
  conditions_help: "Only execute this step if the conditions below are met.",
  add_condition: "Add condition",
  no_configuration: "No configuration.",

  // ── Condition removal dialog ───────────────────────────────────────────
  condition_remove_prompt:
    "Removing this condition. What should happen with its branches?\n" +
    "Type:  yes  to keep the YES branch in place\n" +
    "       no   to keep the NO branch in place\n" +
    "       all  to remove the condition AND both branches\n" +
    "Cancel to abort.",

  // ── Move-to-branch dialog ──────────────────────────────────────────────
  move_branch_prompt:
    "There are steps after this condition. Move them into a branch?\n" +
    "Type:  yes  to move them under the YES branch\n" +
    "       no   to move them under the NO branch\n" +
    "Cancel or anything else to leave them in place.",

  // ── Condition branch labels ────────────────────────────────────────────
  branch_yes: "YES",
  branch_no: "NO",

  // ── Step summaries ─────────────────────────────────────────────────────
  summary_choose_action: "Choose action",
  summary_choose_event: "Choose event(s)",
  summary_choose_segment: "Choose segment",
  summary_define_endpoint: "Define endpoint",
  summary_configured: "Configured",
  summary_continue_immediately: "Continue immediately",
  summary_set_expression: "Set expression",
  summary_set_delay: "Set delay",
  summary_configure_http: "Configure HTTP request",
  summary_stops_branch: "Stops this branch",
  summary_add_tag: "Add tag",
  summary_remove_tag: "Remove tag",
};
