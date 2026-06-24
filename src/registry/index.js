import { RegistryLoader } from "./RegistryLoader.js";

class BaseRegistry {
  constructor(items = [], schemas = {}) {
    this._items = new Map(items.map((i) => [i.type, i]));
    this._schemas = schemas;
  }
  list() { return Array.from(this._items.values()); }
  get(type) { return this._items.get(type); }
  getSchema(type) { return this._schemas[type] || null; }

  /** Add or replace a single item with optional inline schema. */
  register(item, schema) {
    if (!item || !item.type) throw new Error("registry.register: item.type required");
    this._items.set(item.type, item);
    if (schema) this._schemas[item.type] = schema;
  }

  /** Remove an item by type (used for hiding built-ins). */
  unregister(type) {
    this._items.delete(type);
    delete this._schemas[type];
  }
}

export class StepRegistry extends BaseRegistry {}
export class TriggerRegistry extends BaseRegistry {}
export class ActionRegistry extends BaseRegistry {}

/**
 * Build all registries from the configured sources (URL strings or inline objects).
 *
 * Extensions are merged on top of the base definitions. Each extension may carry:
 *   { steps: [{...stepDef, schema?}], triggers: [...], actions: [...] }
 * Schema can be inlined on the definition as `schema: {...}` (preferred for plugins),
 * or referenced as `config_schema: "url"` (loaded relative to extension.baseUrl or absolute).
 */
export async function buildRegistries(registries, extensions = []) {
  const loader = new RegistryLoader();

  const stepsRes    = await loader.loadJson(registries.steps);
  const triggersRes = await loader.loadJson(registries.triggers);
  const actionsRes  = registries.actions
    ? await loader.loadJson(registries.actions)
    : { data: { actions: [] }, baseUrl: null };

  const stepSchemas = {};
  for (const s of stepsRes.data.steps) {
    if (s.schema) stepSchemas[s.type] = s.schema;
    else if (s.config_schema) stepSchemas[s.type] = await loader.loadSchema(s.config_schema, stepsRes.baseUrl);
  }
  const triggerSchemas = {};
  for (const t of triggersRes.data.triggers) {
    if (t.schema) triggerSchemas[t.type] = t.schema;
    else if (t.config_schema) triggerSchemas[t.type] = await loader.loadSchema(t.config_schema, triggersRes.baseUrl);
  }

  // Shared "step-level conditions" schema. Prefer an inlined schema (bundled
  // definitions), then fall back to fetching it relative to the steps source.
  let conditionsSchema = stepsRes.data._conditionsSchema || null;
  if (!conditionsSchema) {
    try {
      conditionsSchema = await loader.loadSchema("schemas/_conditions.schema.json", stepsRes.baseUrl);
    } catch { /* optional */ }
  }

  const stepReg    = new StepRegistry(stepsRes.data.steps, stepSchemas);
  const triggerReg = new TriggerRegistry(triggersRes.data.triggers, triggerSchemas);
  const actionReg  = new ActionRegistry(actionsRes.data.actions || []);

  // Merge extensions
  for (const ext of extensions || []) {
    const baseUrl = ext.baseUrl || null;
    for (const s of ext.steps || []) {
      let schema = s.schema || null;
      if (!schema && s.config_schema) schema = await loader.loadSchema(s.config_schema, baseUrl);
      stepReg.register(stripInline(s), schema);
    }
    for (const t of ext.triggers || []) {
      let schema = t.schema || null;
      if (!schema && t.config_schema) schema = await loader.loadSchema(t.config_schema, baseUrl);
      triggerReg.register(stripInline(t), schema);
    }
    for (const a of ext.actions || []) actionReg.register(a);
    if (Array.isArray(ext.remove?.steps))    ext.remove.steps.forEach((t) => stepReg.unregister(t));
    if (Array.isArray(ext.remove?.triggers)) ext.remove.triggers.forEach((t) => triggerReg.unregister(t));
    if (Array.isArray(ext.remove?.actions))  ext.remove.actions.forEach((t) => actionReg.unregister(t));
  }

  return {
    steps: stepReg,
    triggers: triggerReg,
    actions: actionReg,
    shared: { conditions: conditionsSchema },
  };
}

function stripInline(def) {
  const { schema, ...rest } = def;
  return rest;
}
