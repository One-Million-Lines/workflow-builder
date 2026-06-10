# @openmarketing/workflow-builder

Open-source, framework-agnostic JavaScript visual marketing automation workflow builder.

It provides a JSON-driven workflow canvas with triggers, actions, delays, conditions, and message steps. It is designed to be embedded into any product (vanilla JS, React, Vue, Angular, Svelte, Web Components) and extended with custom step definitions — without changing the core code.

The builder is responsible only for visual creation, editing, validation and import/export of the workflow JSON. It does **not** execute workflows and does **not** require a backend.

---

## Quick start

```bash
npm install
npm run dev
```

Then open http://localhost:5317.

## Project layout

```
workflow-builder/
  src/
    core/            # WorkflowBuilder, WorkflowState, Serializer, Validator, EventEmitter
    canvas/          # Canvas, NodeRenderer, AddStepMenu
    forms/           # JSON-schema form renderer
    registry/        # Step / trigger / action registries
    ui/              # Sidebar, Icon
    styles/          # CSS (CSS variables for theming)
    index.js         # Public entry point
  definitions/
    steps.json
    triggers.json
    actions.json
    schemas/
      *.schema.json
  examples/
    vanilla/         # Vanilla JS demo (this is what `npm run dev` opens)
```

## Public API

```js
import { WorkflowBuilder } from "@openmarketing/workflow-builder";

const builder = new WorkflowBuilder({
  container: "#workflow-builder",
  workflow: initialWorkflow,
  registries: {
    steps:    "/definitions/steps.json",
    triggers: "/definitions/triggers.json",
    actions:  "/definitions/actions.json",
  },
  onChange: (wf) => console.log(wf),
  onSave:   (wf) => console.log("save", wf),
});

await builder.mount();
```

### Methods

- `mount()` / `unmount()`
- `getWorkflow()` / `setWorkflow(json)`
- `export()` / `import(json)`
- `validate()` → `{ valid, errors, warnings }`
- `addStep(parentStepId, stepType, position?)`
- `removeStep(stepId)`
- `updateStep(stepId, patch)`
- `updateTrigger(patch)`

### Events

```js
builder.on("workflow:change", (wf) => {});
builder.on("workflow:save",   (wf) => {});
builder.on("step:add",        ({ step }) => {});
builder.on("step:update",     ({ id, patch }) => {});
builder.on("step:remove",     ({ id }) => {});
builder.on("step:select",     ({ id, kind }) => {});
builder.on("trigger:update",  ({ patch }) => {});
builder.on("validation:error",(result) => {});
```

## Step types (MVP)

| type           | purpose                                              |
|----------------|------------------------------------------------------|
| `email`        | Send an email (full template builder, HTML + text)   |
| `sms`          | Send an SMS                                          |
| `webpush`      | Send a web push                                      |
| `whatsapp`     | Send a WhatsApp message                              |
| `delay`        | Wait fixed time / expression                         |
| `action`       | Update attribute / tag / list status                 |
| `http_request` | GET/POST to any URL with dynamic placeholders        |
| `condition`    | Yes/No branch                                        |
| `exit`         | Stop this branch                                     |

All step types are declared in `definitions/steps.json` and can be added, removed, or replaced via extensions (see "Extensions" below). Configuration forms are generated from JSON schemas in `definitions/schemas/`.

## Form field types

`FormRenderer` supports: `text`, `textarea`, `number`, `select`, `toggle`, `checkbox`, `radio`, `hidden`, `info`, `divider`, `json`, `repeater`, `condition_group`, `email_template`, `http_kv`.

### Async dropdowns

Any `select` field can declare `options_source` to fetch options from the configured `dataProvider`:

```json
{ "name": "list_id", "label": "List", "type": "select", "options_source": "lists" }
```

For cascading dropdowns, declare `depends_on`:

```json
{
  "name": "list_status", "label": "Status", "type": "select",
  "options_source": "list_statuses", "depends_on": ["list_id"]
}
```

The default `dataProvider` is `MockBackend` (see `src/services/MockBackend.js`). Replace it via `new WorkflowBuilder({ dataProvider: myProvider })` where `myProvider(source, { depends }) => Promise<option[]>`. Built-in sources: `attributes`, `lists`, `list_statuses`, `segments`, `events`, `event_fields`.

### condition_group

Stores `{ match: "all" | "any", items: [{field, operator, value}, ...] }`. Used for the per-step "Additional conditions" panel. Existing array values are auto-migrated.

### email_template

Opens a full-page email template builder with tabs for Settings / HTML / Plain text / Preview. Replaces the small subject/content fields with a richer editor that supports HTML and text versions, preheader, from-name, from-email, reply-to and live preview.

## HTTP request step

`http_request` lets a workflow call an external endpoint. Configuration:

- `method`: GET or POST
- `url`: supports `{{customer.field}}` / `{{trigger.field}}` placeholders
- `query`, `headers`: `http_kv` rows
- `body_mode`: `none`, `json`, `raw` (POST only)
- `save_response_as`: optional variable name
- `fail_on_error`: stop the branch on non-2xx

## Extensions

Extensions add (or remove) steps, triggers and actions without editing the core definitions:

```js
const slack = {
  steps: [{
    type: "slack_notify",
    label: "Slack message",
    icon: "bell",
    category: "integration",
    schema: {
      type: "object",
      fields: [
        { name: "channel", label: "Channel", type: "text", required: true },
        { name: "text",    label: "Message", type: "textarea", required: true },
      ],
    },
  }],
  // remove built-ins you don't want
  remove: { steps: ["webpush"] },
};

const builder = new WorkflowBuilder({
  container: "#workflow-builder",
  registries: { steps: "/definitions/steps.json", triggers: "/definitions/triggers.json" },
  extensions: [slack],
});
```

Extensions can carry inline `schema` per item, or a `config_schema` path (resolved against `ext.baseUrl`). Use `builder.registerExtension(ext)` before `mount()` for dynamic registration, and `builder.registerModule(name, factory)` to plug in a custom full-page module (the email template builder is registered this way).

## Workflow JSON shape

```json
{
  "id": "workflow_001",
  "name": "Welcome automation",
  "status": "draft",
  "trigger": { "type": "user_segment", "config": { "segment_id": "spam" } },
  "steps": [
    { "type": "action", "config": { "action_type": "update_list_status" } },
    { "type": "delay",  "config": { "mode": "value", "value": 1, "unit": "hours" } },
    { "type": "email",  "config": { "subject": "Hello", "content": "..." } },
    {
      "type": "condition",
      "config": { "field": "customer.orders_count", "operator": "greater_than", "value": 0 },
      "branches": {
        "yes": [ { "type": "sms", "config": { "message": "Thanks!" } } ],
        "no":  [ { "type": "exit", "config": {} } ]
      }
    }
  ]
}
```

## Adding a new step type

1. Add a JSON schema in `definitions/schemas/coupon.schema.json`.
2. Register the step in `definitions/steps.json`:
   ```json
   {
     "type": "coupon",
     "label": "Generate coupon",
     "icon": "tag",
     "category": "commerce",
     "config_schema": "schemas/coupon.schema.json"
   }
   ```

No core JS code changes required.

## Theming

Override CSS variables under `.wfb-root` or `:root`:

```css
:root {
  --wfb-bg: #fafafa;
  --wfb-node-bg: #ffffff;
  --wfb-node-border: #d5d8e2;
  --wfb-node-selected: #3182ce;
  --wfb-success: #42b85c;
  --wfb-danger: #f56c6c;
  --wfb-primary: #3182ce;
}
```

## Roadmap

- React / Vue / Svelte wrappers
- Pan/zoom canvas
- Drag-and-drop reordering
- WYSIWYG block-based email editor on top of the template builder
- Web Components wrapper
