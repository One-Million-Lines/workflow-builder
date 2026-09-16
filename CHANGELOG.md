# Changelog

All notable changes to this package are documented here.
This project adheres to [Semantic Versioning](https://semver.org/) and the
[Keep a Changelog](https://keepachangelog.com/) format.

## [0.3.0] — 2026-09-16

### Added
- **Plugin error reporting API** — Plugins can now report step-level validation
  errors back to the canvas via the new `onReportErrors(errors)` callback that
  is passed to every registered plugin module, and via the public
  `builder.setStepErrors(stepId, errors)` / `builder.clearStepErrors(stepId)`
  methods on the factory API.  Error messages are displayed in a hover tooltip
  on the red ⚠ badge so users can immediately see what is wrong with a step.
- **`Canvas.setErrorState(ids, messages)`** — new Canvas method that accepts
  both the error-ID set and a `{[stepId]: string[]}` messages map, enabling
  rich tooltips for every step node type (plugin and sidebar).

### Changed
- **Plugin step border** — `.wfb-node--plugin` border changed from `dashed`
  to `solid`.  Plugin-managed steps are already distinguished by the blue gear
  badge; a dashed border added visual noise without communicating useful
  information.
- **Validator: `template_id` is now sufficient for email / SMS / WhatsApp** —
  when a `template_id` is stored in the step config the validator no longer
  requires a separate `subject` (email) or `message` (sms / whatsapp) because
  those values live inside the referenced template.

### Deprecated
- `Canvas.setErrorIds(ids)` — superseded by `Canvas.setErrorState(ids, messages)`.
  `setErrorIds` still works but will be removed in a future major version.

## [0.2.6] — 2026-09-16

### Fixed
- New steps created by the plugins were being overwritten by a stale version of the workflow

## [0.2.5] — 2026-09-15

### Fixed
- The add-step menu now flips above its button near the bottom edge and scrolls when space is limited.

### Changed
- Documented host-controlled step lists through the existing `registries` and `extensions` options.

## [0.2.4] — 2026-09-15

### Fixed
- `commitAndGetWorkflow()` now flushes the open trigger or step editor before returning the workflow JSON.

## [0.2.3] — 2026-09-14

### Fixed
- **Infinite-loop / page-freeze when editing step/trigger forms** — `rerenderVisibility` now accepts a `changedField` argument and only reloads `options_source` selects whose `depends_on` list includes that field, eliminating the O(n²) reload chain that fired on every keystroke.
- **`_wfbReload` concurrent-invocation amplification** — added a `_wfbLoading` guard flag; a new reload is skipped if one is already in flight for the same select element.
- **Spurious `onChange` from `_wfbReload`** — `onChange` is now fired only when the selected value genuinely changes, avoiding unnecessary rerenderVisibility cascades.

### Added
- **Step-level plugins** — `WorkflowBuilder` now checks `modules[step.type]` before opening the standard sidebar form. If a callable is found it is invoked with `{ config, step, onSave }`, allowing host applications to wire in their own editors (React components, modals, etc.) without touching the sidebar system.
- **Step status** — Each step / action in the workflow has a status flag

## [0.2.2] — 2026-09-14

### Added
- `WorkflowBuilder.commitSidebar()` — programmatically triggers the sidebar's Save button when it is open, so callers can commit any in-progress step/trigger form before reading the final workflow.
- `createWorkflowBuilder` factory now exposes `commitAndGetWorkflow()` — commits the sidebar then returns the latest workflow in one call.

### Changed
- Shortened connector line segments (before and after the `+` add-step button) from 16 px to 8 px for a more compact flow layout.

## [0.2.1] — 2026-08-27

### Changed
- FIX memory leak problem with the canvas

## [0.2.0] — 2026-08-27

### Changed
- added support for internationalization (german and spanish)
- added support for CSS customization on embedding using overwritting variables
- fixed issue making the builder embeddable in other projects

## [0.1.2] — 2026-07-02

### Changed
- **Dependencies upgraded to latest releases** (no public API changes):
- **Dev dependencies upgraded to latest releases**:
- `engines.node` bumped to `>=22` in line with supported LTS range.

## [0.1.1] — 2026-06-30

### Added
- npm library build (`dist/workflow-builder.js` ESM, `dist/workflow-builder.cjs` CommonJS).
- Bundled default registry definitions (`defaultDefinitions`) so the builder works
  with no JSON hosting required.
- Shipped stylesheet at `dist/styles.css`, imported via `@one-million-lines/workflow-builder/styles.css`.
- Hand-written TypeScript declarations (`dist/index.d.ts`).
- `exports` map, `files` allowlist, and publishing metadata in `package.json`.

### Fixed
- **CSS isolation**: moved all `--wfb-*` CSS custom properties from `:root` to
  `.wfb-root` so they are fully scoped and never leak into the host application.
- Added `.oml-workflow-builder` as a secondary root class (the root element now
  carries both `wfb-root` and `oml-workflow-builder`) so consumers can target the
  builder via the canonical namespaced selector.
- Added scoped `box-sizing: border-box` reset for all descendants of `.wfb-root`
  so the builder layout is unaffected by host-level `box-sizing` overrides.

## [0.1.0]

### Added
- Initial framework-agnostic visual workflow builder, JSON-driven registries,
  schema forms, validation, and the vanilla demo application.
