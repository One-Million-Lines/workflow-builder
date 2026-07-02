# Changelog

All notable changes to this package are documented here.
This project adheres to [Semantic Versioning](https://semver.org/) and the
[Keep a Changelog](https://keepachangelog.com/) format.

## [Unreleased]

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
