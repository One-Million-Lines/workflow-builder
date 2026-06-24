# Changelog

All notable changes to this package are documented here.
This project adheres to [Semantic Versioning](https://semver.org/) and the
[Keep a Changelog](https://keepachangelog.com/) format.

## [Unreleased]

### Added
- npm library build (`dist/workflow-builder.js` ESM, `dist/workflow-builder.cjs` CommonJS).
- Bundled default registry definitions (`defaultDefinitions`) so the builder works
  with no JSON hosting required.
- Shipped stylesheet at `dist/styles.css`, imported via `@one-million-lines/workflow-builder/styles.css`.
- Hand-written TypeScript declarations (`dist/index.d.ts`).
- `exports` map, `files` allowlist, and publishing metadata in `package.json`.

## [0.1.0]

### Added
- Initial framework-agnostic visual workflow builder, JSON-driven registries,
  schema forms, validation, and the vanilla demo application.
