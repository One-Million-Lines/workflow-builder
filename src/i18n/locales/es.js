/** Spanish locale. */
export default {
  // ── Node / Canvas ──────────────────────────────────────────────────────
  trigger_badge: "Disparador",
  choose_trigger: "Elegir disparador",
  click_to_configure: "Clic para configurar",
  enabled: "Habilitado",
  disabled: "Deshabilitado",
  enable_disable: "Habilitar/Deshabilitar",
  status_active: "Activo",
  status_inactive: "Inactivo",
  delete: "Eliminar",
  config_incomplete: "Configuración incompleta",
  add_step: "Añadir paso",

  // ── Add-step menu ──────────────────────────────────────────────────────
  add_step_header: "Añadir paso al flujo de trabajo",

  // ── Sidebar ────────────────────────────────────────────────────────────
  sidebar_default_title: "Configuración",
  sidebar_enabled_label: "Habilitado",
  sidebar_cancel: "Cancelar",
  sidebar_save: "Guardar",
  sidebar_toggle_width: "Alternar ancho del panel",
  sidebar_expand: "Expandir panel",
  sidebar_shrink: "Reducir panel",
  sidebar_close: "Cerrar",

  // ── Trigger editor ─────────────────────────────────────────────────────
  trigger_type_label: "Tipo de disparador",
  trigger_type_placeholder: "Seleccionar disparador…",
  trigger_type_required: "Por favor, elija un tipo de disparador.",

  // ── Step editor ────────────────────────────────────────────────────────
  additional_conditions: "Condiciones adicionales",
  conditions_help: "Ejecutar este paso solo si se cumplen las siguientes condiciones.",
  add_condition: "Añadir condición",
  no_configuration: "Sin configuración.",

  // ── Condition removal dialog ───────────────────────────────────────────
  condition_remove_prompt:
    "Eliminando esta condición. ¿Qué debe ocurrir con sus ramas?\n" +
    "Escriba:  yes  para conservar la rama SÍ\n" +
    "          no   para conservar la rama NO\n" +
    "          all  para eliminar la condición Y ambas ramas\n" +
    "Cancelar para abortar.",

  // ── Move-to-branch dialog ──────────────────────────────────────────────
  move_branch_prompt:
    "Hay pasos después de esta condición. ¿Moverlos a una rama?\n" +
    "Escriba:  yes  para moverlos bajo la rama SÍ\n" +
    "          no   para moverlos bajo la rama NO\n" +
    "Cancelar o cualquier otra cosa para dejarlos en su lugar.",

  // ── Condition branch labels ────────────────────────────────────────────
  branch_yes: "SÍ",
  branch_no: "NO",

  // ── Step summaries ─────────────────────────────────────────────────────
  summary_choose_action: "Elegir acción",
  summary_choose_event: "Elegir evento(s)",
  summary_choose_segment: "Elegir segmento",
  summary_define_endpoint: "Definir punto de acceso",
  summary_configured: "Configurado",
  summary_continue_immediately: "Continuar inmediatamente",
  summary_set_expression: "Establecer expresión",
  summary_set_delay: "Establecer retraso",
  summary_configure_http: "Configurar solicitud HTTP",
  summary_stops_branch: "Detiene esta rama",
  summary_add_tag: "Añadir etiqueta",
  summary_remove_tag: "Eliminar etiqueta",
};
