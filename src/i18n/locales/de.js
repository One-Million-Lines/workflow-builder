/** German locale. */
export default {
  // ── Node / Canvas ──────────────────────────────────────────────────────
  trigger_badge: "Auslöser",
  choose_trigger: "Auslöser wählen",
  click_to_configure: "Klicken zum Konfigurieren",
  enabled: "Aktiv",
  disabled: "Inaktiv",
  enable_disable: "Aktivieren/Deaktivieren",
  delete: "Löschen",
  config_incomplete: "Konfiguration unvollständig",
  add_step: "Schritt hinzufügen",

  // ── Add-step menu ──────────────────────────────────────────────────────
  add_step_header: "Schritt zum Workflow hinzufügen",

  // ── Sidebar ────────────────────────────────────────────────────────────
  sidebar_default_title: "Konfiguration",
  sidebar_enabled_label: "Aktiv",
  sidebar_cancel: "Abbrechen",
  sidebar_save: "Speichern",
  sidebar_toggle_width: "Seitenleistenbreite umschalten",
  sidebar_expand: "Seitenleiste erweitern",
  sidebar_shrink: "Seitenleiste verkleinern",
  sidebar_close: "Schließen",

  // ── Trigger editor ─────────────────────────────────────────────────────
  trigger_type_label: "Auslösertyp",
  trigger_type_placeholder: "Auslöser auswählen…",
  trigger_type_required: "Bitte wählen Sie einen Auslösertyp.",

  // ── Step editor ────────────────────────────────────────────────────────
  additional_conditions: "Zusätzliche Bedingungen",
  conditions_help: "Diesen Schritt nur ausführen, wenn die folgenden Bedingungen erfüllt sind.",
  add_condition: "Bedingung hinzufügen",
  no_configuration: "Keine Konfiguration.",

  // ── Condition removal dialog ───────────────────────────────────────────
  condition_remove_prompt:
    "Diese Bedingung wird entfernt. Was soll mit den Verzweigungen passieren?\n" +
    "Eingabe:  yes  um den JA-Zweig beizubehalten\n" +
    "          no   um den NEIN-Zweig beizubehalten\n" +
    "          all  um die Bedingung UND beide Zweige zu entfernen\n" +
    "Abbrechen zum Stornieren.",

  // ── Move-to-branch dialog ──────────────────────────────────────────────
  move_branch_prompt:
    "Nach dieser Bedingung befinden sich weitere Schritte. In einen Zweig verschieben?\n" +
    "Eingabe:  yes  um sie unter den JA-Zweig zu verschieben\n" +
    "          no   um sie unter den NEIN-Zweig zu verschieben\n" +
    "Abbrechen oder anderes, um sie an Ort und Stelle zu lassen.",

  // ── Condition branch labels ────────────────────────────────────────────
  branch_yes: "JA",
  branch_no: "NEIN",

  // ── Step summaries ─────────────────────────────────────────────────────
  summary_choose_action: "Aktion auswählen",
  summary_choose_event: "Ereignis(se) auswählen",
  summary_choose_segment: "Segment auswählen",
  summary_define_endpoint: "Endpunkt definieren",
  summary_configured: "Konfiguriert",
  summary_continue_immediately: "Sofort fortfahren",
  summary_set_expression: "Ausdruck festlegen",
  summary_set_delay: "Verzögerung festlegen",
  summary_configure_http: "HTTP-Anfrage konfigurieren",
  summary_stops_branch: "Beendet diesen Zweig",
  summary_add_tag: "Tag hinzufügen",
  summary_remove_tag: "Tag entfernen",
};
