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

Typical builder setup:

```js
import { WorkflowBuilder } from "@openmarketing/workflow-builder";

const builder = new WorkflowBuilder({
  container: "#workflow-builder",
  workflow: initialWorkflow,
  registries: {
    steps: "/definitions/steps.json",
    triggers: "/definitions/triggers.json",
    actions: "/definitions/actions.json",
  },
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
npm run dev
npm run build
npm run preview
```

There is currently no dedicated lint or automated test command in the repository.

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
