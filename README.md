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
npm install @one-million-lines/workflow-builder
```

> **MANUAL ACTION REQUIRED:** This package is configured to publish under the
> `@one-million-lines` npm scope. Before publishing, confirm you own/have publish
> access to that npm organization and that `@one-million-lines/workflow-builder`
> is available (or already yours). `publishConfig.access` is set to `public`.

Import the component factory and the stylesheet:

```js
import { createWorkflowBuilder } from "@one-million-lines/workflow-builder";
import "@one-million-lines/workflow-builder/styles.css";

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

### Styling & isolation

The stylesheet at `@one-million-lines/workflow-builder/styles.css` is fully
self-contained and does **not** affect the host application:

- All `--wfb-*` CSS custom properties are scoped to the builder root element and
  never declared on `:root`, so they cannot bleed into host styles.
- There are no global resets (no `body`, `html`, or `*` rules).
- The builder root carries two classes: `wfb-root` and `oml-workflow-builder`.
  You can use either for scoped overrides in your own CSS.
- `box-sizing: border-box` is set on `.wfb-root` and inherited by all
  descendants, so the layout is not affected by host-level `box-sizing` changes.

**Hosting the builder:**

Give the container element explicit dimensions; the builder fills `100%` of its
container:

```html
<div id="builder" style="height: 600px; width: 100%; position: relative;"></div>
```

**Overriding design tokens:**

Override the builder's look by setting `--wfb-*` variables on its container:

```css
#builder {
  --wfb-primary: #7c3aed;   /* purple brand color */
  --wfb-radius: 6px;
}
```

**z-index**

The add-step popover uses `z-index: 100` and the sidebar uses `z-index: 50`,
both relative to the builder root (which uses `position: relative`). If your host
creates a stacking context with a high `z-index`, wrap the builder in a container
with `isolation: isolate` to keep builder layers separate from host layers.

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
import { WorkflowBuilder } from "@one-million-lines/workflow-builder";

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
# MANUAL ACTION REQUIRED — log in to an account with publish access to the @one-million-lines scope, then:
npm version patch   # 0.1.3 -> 0.1.4, bugfix
npm version minor   # 0.1.3 -> 0.2.0, new feature
npm version major   # 0.1.3 -> 1.0.0, breaking change

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
