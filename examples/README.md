# Examples

These examples consume the **built, published** package (not the source), which
is the only way to validate real npm consumption.

## Local development against the package

Build and pack the library, then install the tarball in your example app:

```bash
# In the workflow-builder repo
npm install
npm run build
npm pack            # -> openmarketing-workflow-builder-0.1.0.tgz

# In your example/consumer app
npm install /absolute/path/to/openmarketing-workflow-builder-0.1.0.tgz
```

Alternatively, install via a local path (handy while iterating):

```bash
npm install /absolute/path/to/workflow-builder
```

## What's here

| Folder      | Stack            | Entry file                         |
| ----------- | ---------------- | ---------------------------------- |
| `vanilla/`  | Browser + Vite   | `main.js` (imports from `../../src`, for repo dev) |
| `plain/`    | Plain JS, no build | `index.html`                     |
| `react/`    | React            | `WorkflowBuilder.jsx`              |
| `vue/`      | Vue 3            | `WorkflowBuilder.vue`             |
| `angular/`  | Angular          | `workflow-builder.component.ts`    |

The `react`, `vue`, `angular`, and `plain` examples import from the package name
`@openmarketing/workflow-builder` (or the built `dist/` file) — the realistic
consumer path. The `vanilla` example imports from `../../src` and exists for
in-repo development of the builder itself.

## Stylesheet

Every integration must load the stylesheet once:

```js
import "@openmarketing/workflow-builder/styles.css";
```

or via a `<link>` / bundler config in non-ESM setups.
