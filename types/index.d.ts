// Type declarations for @one-million-lines/workflow-builder
// Hand-written to describe the public API of the (JavaScript) source.

export type Json =
  | string
  | number
  | boolean
  | null
  | Json[]
  | { [key: string]: Json };

/** A trigger that starts the workflow. */
export interface WorkflowTrigger {
  id?: string;
  type: string | null;
  config?: Record<string, unknown>;
}

/** A single workflow step (action, delay, condition, exit, etc.). */
export interface WorkflowStep {
  id?: string;
  type: string;
  enabled?: boolean;
  config?: Record<string, unknown>;
  conditions?:
    | unknown[]
    | { match?: "all" | "any"; items?: unknown[] };
  branches?: { yes?: WorkflowStep[]; no?: WorkflowStep[] };
  [key: string]: unknown;
}

/** The full workflow document produced and consumed by the builder. */
export interface Workflow {
  id?: string;
  name?: string;
  status?: string;
  trigger: WorkflowTrigger;
  steps: WorkflowStep[];
  [key: string]: unknown;
}

export interface ValidationIssue {
  scope: "workflow" | "trigger" | "step" | string;
  id?: string;
  message: string;
}

export interface ValidationResult {
  valid: boolean;
  errors: ValidationIssue[];
  warnings: ValidationIssue[];
}

/** A definition entry (step/trigger/action) with an optional inline schema. */
export interface DefinitionItem {
  type: string;
  label?: string;
  icon?: string;
  category?: string;
  description?: string;
  /** Inline JSON-schema-style field definition. */
  schema?: Json;
  /** Relative or absolute URL to a JSON schema (loaded at runtime). */
  config_schema?: string | null;
  [key: string]: unknown;
}

/** Registry sources: either inline data objects or URLs to JSON files. */
export interface RegistrySources {
  steps: string | { steps: DefinitionItem[]; _conditionsSchema?: Json };
  triggers: string | { triggers: DefinitionItem[] };
  actions?: string | { actions: DefinitionItem[] };
}

/** Bundled default registry definitions (works with no hosting required). */
export const defaultDefinitions: RegistrySources;
export const defaultConditionsSchema: Json;

/** An extension can add or hide steps, triggers, and actions. */
export interface Extension {
  baseUrl?: string | null;
  steps?: DefinitionItem[];
  triggers?: DefinitionItem[];
  actions?: DefinitionItem[];
  remove?: { steps?: string[]; triggers?: string[]; actions?: string[] };
}

/**
 * Async data provider for form dropdowns.
 * `source` is one of the known lookup names; `context.depends` carries values of
 * fields the lookup depends on.
 */
export type DataProvider = (
  source: string,
  context?: { depends?: Record<string, unknown> },
) => Promise<Array<{ value: string; label: string; [key: string]: unknown }>>;

/** A module factory handles custom field requests (e.g. `email_template`). */
export type ModuleFactory = (props: unknown) => unknown;

export interface WorkflowBuilderOptions {
  /** A CSS selector string or an HTMLElement to mount into. */
  container: string | HTMLElement;
  /** Initial workflow document. */
  workflow?: Workflow | null;
  /** Registry sources. Defaults to the bundled `defaultDefinitions`. */
  registries?: RegistrySources;
  /** Extensions applied on top of the base definitions. */
  extensions?: Extension[];
  /** Async data provider for form dropdowns. */
  dataProvider?: DataProvider;
  /** Custom modules keyed by name. */
  modules?: Record<string, ModuleFactory>;
  /** Convenience callback wired to the `workflow:change` event. */
  onChange?: (workflow: Workflow) => void;
  /** Convenience callback wired to the `workflow:save` event. */
  onSave?: (workflow: Workflow) => void;
}

export type WorkflowBuilderEvent =
  | "workflow:change"
  | "workflow:save"
  | "step:add"
  | "step:update"
  | "step:remove"
  | "step:select"
  | "trigger:update"
  | "validation:error";

export class EventEmitter {
  on(event: string, handler: (payload?: unknown) => void): () => void;
  off(event: string, handler: (payload?: unknown) => void): void;
  emit(event: string, payload?: unknown): void;
}

export class WorkflowBuilder extends EventEmitter {
  constructor(options: WorkflowBuilderOptions);

  /** Register an extension (call before `mount()`). */
  registerExtension(ext: Extension): void;
  /** Register a custom module that handles field requests. */
  registerModule(name: string, factory: ModuleFactory): void;

  /** Build the registries and render the builder into the container. */
  mount(): Promise<void>;
  /** Remove the builder from the DOM. */
  unmount(): void;

  getWorkflow(): Workflow;
  setWorkflow(json: Workflow | string): void;
  validate(): ValidationResult;
  export(): Workflow;
  import(json: Workflow | string): void;

  addStep(parentStepId: string | null, stepType: string, position?: string): WorkflowStep;
  removeStep(stepId: string): void;
  updateStep(stepId: string, patch: Partial<WorkflowStep>): void;
  updateTrigger(patch: Partial<WorkflowTrigger>): void;

  on(event: WorkflowBuilderEvent | string, handler: (payload?: unknown) => void): () => void;
}

export interface WorkflowBuilderInstance {
  /** The underlying WorkflowBuilder instance. */
  instance: WorkflowBuilder;
  /** Resolves once the builder has mounted. */
  ready: Promise<WorkflowBuilderInstance>;
  mount(): Promise<WorkflowBuilderInstance>;
  update(value: Workflow | string): WorkflowBuilderInstance;
  getValue(): Workflow;
  setValue(value: Workflow | string): WorkflowBuilderInstance;
  validate(): ValidationResult;
  on(event: WorkflowBuilderEvent | string, handler: (payload?: unknown) => void): () => void;
  destroy(): void;
}

export interface CreateWorkflowBuilderOptions
  extends Omit<WorkflowBuilderOptions, "container" | "workflow"> {
  /** Target element or selector (alias for `container`). */
  target?: string | HTMLElement;
  container?: string | HTMLElement;
  /** Initial workflow document (alias for `workflow`). */
  initialValue?: Workflow | null;
  workflow?: Workflow | null;
}

/** Framework-neutral factory with a stable lifecycle API. */
export function createWorkflowBuilder(
  options: CreateWorkflowBuilderOptions,
): WorkflowBuilderInstance;

export class WorkflowState {
  constructor(workflow?: Workflow | null);
  getWorkflow(): Workflow;
  setWorkflow(workflow: Workflow): void;
}

export class WorkflowSerializer {
  static export(workflow: Workflow): Workflow;
  static import(json: Workflow | string): Workflow;
}

export class WorkflowValidator {
  constructor(stepRegistry: unknown, triggerRegistry: unknown);
  validate(workflow: Workflow): ValidationResult;
}

export interface RenderedForm {
  element: HTMLElement;
  getValues(): Record<string, unknown>;
  validate(): { valid: boolean; [key: string]: unknown };
}

export function renderForm(
  schema: Json,
  values: Record<string, unknown>,
  context?: unknown,
): RenderedForm;

export interface Registries {
  steps: unknown;
  triggers: unknown;
  actions: unknown;
  shared: { conditions: Json | null };
}

export function buildRegistries(
  registries: RegistrySources,
  extensions?: Extension[],
): Promise<Registries>;

export class MockBackend {
  attributes(): Promise<unknown[]>;
  lists(): Promise<unknown[]>;
  list_statuses(listId?: string): Promise<unknown[]>;
  segments(): Promise<unknown[]>;
  events(): Promise<unknown[]>;
  event_fields(event?: string): Promise<unknown[]>;
}

export function createDefaultDataProvider(): DataProvider;

export class EmailTemplateBuilder {
  constructor(options: { mountTarget: HTMLElement });
  open(props: unknown): unknown;
}
