# Workflow Builder

Workflow Builder is an open-source, framework-agnostic visual editor for marketing automation workflows. It renders a JSON-driven canvas that can be embedded into other products and extended with custom step definitions, triggers, actions, schemas, and modules.

## What it does

It provides a client-side workflow editor for building and validating workflow JSON without depending on a backend or workflow execution engine.

## Why it exists

Products that need automation builders often want the visual editor without coupling it to a specific frontend framework or backend runtime. This project focuses on the authoring experience so it can be embedded in different products and wired to different execution systems.

## Features

- Visual workflow canvas with trigger and step editing
- JSON-driven registries for triggers, actions, and steps
- Form rendering from JSON schemas
- Import, export, reset, and validation support
- Event hooks for workflow and step changes
- Extension system for adding or removing steps without modifying core definitions
- Built-in example email template builder module
- Demo app that shows the current workflow JSON alongside the canvas

## How it works

1. `WorkflowBuilder` mounts into a DOM container.
2. It loads registry definitions from `definitions/*.json`.
3. Step configuration forms are generated from JSON schema-style field definitions.
4. Workflow state is updated client-side and emitted through change events.
5. Consumers can export the workflow JSON and pass it to their own backend or automation engine.

## Tech stack

- JavaScript (ES modules)
- Vite
- CSS
- JSON definition files

## Project structure

```text
src/
  canvas/            canvas rendering and add-step UI
  core/              builder state, serializer, validator, events
  extensions/        built-in extension modules
  forms/             schema-driven form renderer
  registry/          registry builders and lookups
  services/          mock data provider
  styles/            workflow builder styles
  ui/                shared UI helpers
definitions/
  actions.json
  steps.json
  triggers.json
  schemas/           config schemas for built-in step types
examples/
  vanilla/           working browser example
```

## Install

```bash
npm install @openmarketing/workflow-builder
```

> **MANUAL ACTION REQUIRED:** `@openmarketing/workflow-builder` is a placeholder
> package name. Choose/reserve your own npm name (and scope/org) before publishing
> and update `package.json` `name`, `repository`, `homepage`, and `bugs`.

Import the component factory and the stylesheet:

```js
import { createWorkflowBuilder } from "@openmarketing/workflow-builder";
import "@openmarketing/workflow-builder/styles.css";

const builder = createWorkflowBuilder({
  target: document.getElementById("builder"),
  initialValue: workflow,            // optional
  onChange: (value) => console.log(value),
});

await builder.ready;                  // mounting is async
// builder.getValue(); builder.validate(); builder.destroy();
```

Registry definitions are **bundled** — the builder works with zero hosting. You
can still override them by passing `registries` (inline objects or URLs).

### Framework integration

The package is framework-agnostic. Thin wrappers for each framework live in
[`examples/`](./examples):

- **React** — `examples/react/WorkflowBuilder.jsx`
- **Vue 3** — `examples/vue/WorkflowBuilder.vue`
- **Angular** — `examples/angular/workflow-builder.component.ts`
- **Plain JS** — `examples/plain/index.html`

The neutral lifecycle API is: `mount()`, `update(value)`, `getValue()`,
`setValue(value)`, `validate()`, `destroy()`.

### Server-side rendering

The package does not touch `window`/`document` at import time, so it is safe to
import in SSR frameworks. Mounting is client-only — create the builder inside an
effect/`onMounted`, or dynamically import with `ssr: false` in Next.js.

## Getting started

```bash
git clone <repo-url>
cd workflow-builder
npm install
npm run dev
```

Open `http://localhost:5317`.

## Configuration

This project does not require environment variables.

Class-based setup (full control):

```js
import { WorkflowBuilder } from "@openmarketing/workflow-builder";

const builder = new WorkflowBuilder({
  container: "#workflow-builder",
  workflow: initialWorkflow,
  // registries is optional — bundled definitions are used by default.
  onChange: (workflow) => console.log(workflow),
  onSave: (workflow) => console.log("save", workflow),
});

await builder.mount();
```

## Usage

Core methods:

- `mount()` / `unmount()`
- `getWorkflow()` / `setWorkflow(json)`
- `export()` / `import(json)`
- `validate()`
- `addStep(parentStepId, stepType, position?)`
- `removeStep(stepId)`
- `updateStep(stepId, patch)`
- `updateTrigger(patch)`

Common events:

- `workflow:change`
- `workflow:save`
- `step:add`
- `step:update`
- `step:remove`
- `step:select`
- `trigger:update`
- `validation:error`

The demo in `examples/vanilla/` also shows how to register an extension that adds a custom Slack notification step without changing the core definitions.

## Development

```bash
npm run dev          # demo app
npm run build        # build the library into dist/ (ESM + CJS + CSS + d.ts)
npm test             # package-consumption tests (jsdom)
npm run validate:pack # build + npm pack --dry-run
npm run preview      # preview the demo build
```

## Building & publishing

```bash
npm run build              # produces dist/
npm pack --dry-run         # inspect the tarball contents
npm pack                   # create the .tgz to test in a consumer app
```

To publish (run manually):

```bash
# MANUAL ACTION REQUIRED — choose a real package name first, then:
npm login
npm publish --access public
```

`prepublishOnly` rebuilds the library automatically before publish.

## Roadmap

- Add framework-specific wrappers for React, Vue, and Svelte
- Add pan and zoom support on the canvas
- Add drag-and-drop step reordering
- Expand packaging guidance for npm publishing and embedding

## Contributing

This project is public and open for collaboration. If you’re interested in contributing, improving the project, or discussing ideas, feel free to reach out.

LinkedIn: https://linkedin.com/in/alexrada

1. Fork the repository
2. Create a new branch
3. Make your changes
4. Open a pull request

## License

This project is licensed under the MIT License. See [LICENSE](./LICENSE).
