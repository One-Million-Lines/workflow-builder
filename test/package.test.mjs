// Package-consumption tests for the BUILT library (dist/), not the source.
// Run with: npm test
import { test } from "node:test";
import assert from "node:assert/strict";
import { JSDOM } from "jsdom";
import { createRequire } from "node:module";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

const here = dirname(fileURLToPath(import.meta.url));
const distEsm = resolve(here, "../dist/workflow-builder.js");
const distCjs = resolve(here, "../dist/workflow-builder.cjs");

// A browser-like environment. Importing the package must NOT touch these at
// module-evaluation time (that already happened above, before this line).
function installDom() {
  const dom = new JSDOM('<!doctype html><html><body></body></html>', {
    url: "https://example.test/",
  });
  globalThis.window = dom.window;
  globalThis.document = dom.window.document;
  globalThis.HTMLElement = dom.window.HTMLElement;
  globalThis.Node = dom.window.Node;
  globalThis.CustomEvent = dom.window.CustomEvent;
  globalThis.Event = dom.window.Event;
  // `navigator` is a read-only global in modern Node; define it non-destructively.
  try {
    Object.defineProperty(globalThis, "navigator", {
      value: dom.window.navigator,
      configurable: true,
    });
  } catch { /* already present and read-only — fine, core does not use it */ }
  return dom;
}

test("ESM build exposes the public API", async () => {
  const mod = await import(distEsm);
  for (const name of [
    "WorkflowBuilder",
    "WorkflowState",
    "WorkflowSerializer",
    "WorkflowValidator",
    "EventEmitter",
    "renderForm",
    "buildRegistries",
    "createDefaultDataProvider",
    "MockBackend",
    "defaultDefinitions",
  ]) {
    assert.ok(mod[name], `missing export: ${name}`);
  }
});

test("CommonJS build is requireable", () => {
  const require = createRequire(import.meta.url);
  const mod = require(distCjs);
  assert.equal(typeof mod.WorkflowBuilder, "function");
  assert.ok(mod.defaultDefinitions.steps.steps.length > 0);
});

test("bundled definitions carry inlined schemas (no hosting required)", async () => {
  const { defaultDefinitions } = await import(distEsm);
  assert.ok(defaultDefinitions.steps.steps[0].schema, "step schema inlined");
  assert.ok(defaultDefinitions.steps._conditionsSchema, "conditions schema inlined");
  assert.ok(defaultDefinitions.triggers.triggers.length > 0);
});

test("importing the package does not require browser globals", () => {
  // We imported the ESM/CJS builds at the top of this file with NO window /
  // document defined. Reaching this assertion proves there was no crash.
  assert.equal(typeof globalThis.window, "undefined");
});

test("mounts into a container and exposes workflow JSON", async () => {
  installDom();
  const { WorkflowBuilder } = await import(distEsm);
  const host = document.createElement("div");
  host.id = "wb";
  document.body.appendChild(host);

  const changes = [];
  const builder = new WorkflowBuilder({
    container: "#wb",
    workflow: { trigger: { type: "user_segment", config: { segment_id: "seg" } }, steps: [] },
    onChange: (wf) => changes.push(wf),
  });
  await builder.mount();

  assert.ok(host.querySelector(".wfb-root"), "renders the builder root");
  const wf = builder.getWorkflow();
  assert.equal(wf.trigger.type, "user_segment");

  builder.setWorkflow({ trigger: { type: "api_request", config: { endpoint: "/x" } }, steps: [] });
  assert.equal(builder.getWorkflow().trigger.type, "api_request");
  assert.ok(changes.length >= 1, "onChange fired");

  builder.unmount();
  assert.equal(host.querySelector(".wfb-root"), null, "unmount removes DOM");
});

test("multiple instances coexist and clean up independently", async () => {
  installDom();
  const { WorkflowBuilder } = await import(distEsm);
  const a = document.createElement("div");
  const b = document.createElement("div");
  document.body.append(a, b);

  const b1 = new WorkflowBuilder({ container: a, workflow: { trigger: { type: null, config: {} }, steps: [] } });
  const b2 = new WorkflowBuilder({ container: b, workflow: { trigger: { type: null, config: {} }, steps: [] } });
  await b1.mount();
  await b2.mount();

  assert.ok(a.querySelector(".wfb-root"));
  assert.ok(b.querySelector(".wfb-root"));

  b1.unmount();
  assert.equal(a.querySelector(".wfb-root"), null, "first instance cleaned up");
  assert.ok(b.querySelector(".wfb-root"), "second instance still mounted");
  b2.unmount();
});

test("commitAndGetWorkflow flushes trigger edits and the result can be reloaded", async () => {
  installDom();
  const { createWorkflowBuilder } = await import(distEsm);
  const host = document.createElement("div");
  document.body.appendChild(host);

  const builder = createWorkflowBuilder({
    target: host,
    initialValue: {
      trigger: { type: "api_request", config: { endpoint: "before" } },
      steps: [],
    },
  });
  await builder.ready;
  builder.instance._openTriggerEditor();

  const endpoint = host.querySelector('input[placeholder="my_workflow_endpoint"]');
  assert.ok(endpoint, "trigger endpoint input is rendered");
  endpoint.value = "after";
  // The field updates its form state, but this non-bubbling event deliberately
  // bypasses the editor's normal auto-commit listener.
  endpoint.dispatchEvent(new Event("input", { bubbles: false }));
  assert.equal(builder.getValue().trigger.config.endpoint, "before");

  const committed = builder.commitAndGetWorkflow();
  assert.equal(committed.trigger.config.endpoint, "after");

  const reloadedHost = document.createElement("div");
  document.body.appendChild(reloadedHost);
  const reloaded = createWorkflowBuilder({ target: reloadedHost, initialValue: committed });
  await reloaded.ready;
  assert.equal(reloaded.getValue().trigger.config.endpoint, "after");

  builder.destroy();
  reloaded.destroy();
});

test("host registries control the step menu and it flips inside the lower viewport edge", async () => {
  installDom();
  const { WorkflowBuilder, defaultDefinitions } = await import(distEsm);
  const host = document.createElement("div");
  document.body.appendChild(host);

  const enabledTypes = new Set(["email", "webpush", "exit"]);
  const registries = {
    ...defaultDefinitions,
    steps: {
      ...defaultDefinitions.steps,
      steps: defaultDefinitions.steps.steps.filter(({ type }) => enabledTypes.has(type)),
    },
  };
  const builder = new WorkflowBuilder({
    container: host,
    workflow: { trigger: { type: null, config: {} }, steps: [] },
    registries,
  });
  await builder.mount();

  const anchor = document.createElement("button");
  builder._root.appendChild(anchor);
  builder._root.getBoundingClientRect = () => ({
    top: 0, right: 600, bottom: 300, left: 0, width: 600, height: 300,
  });
  anchor.getBoundingClientRect = () => ({
    top: 270, right: 320, bottom: 290, left: 300, width: 20, height: 20,
  });
  Object.defineProperty(builder._addMenu.el, "offsetWidth", { configurable: true, value: 300 });
  Object.defineProperty(builder._addMenu.el, "offsetHeight", { configurable: true, value: 260 });

  builder._addMenu.openAt(anchor, { parentId: null });

  const menuTypes = Array.from(builder._addMenu.el.querySelectorAll("[data-type]"), (el) => el.dataset.type);
  assert.deepEqual(menuTypes, ["email", "webpush", "exit"]);
  assert.equal(builder._addMenu.el.dataset.placement, "top");
  assert.ok(parseFloat(builder._addMenu.el.style.top) < 270, "menu opens above its anchor");
  assert.ok(parseFloat(builder._addMenu.el.style.maxHeight) <= 260, "menu height is capped to visible space");

  builder.unmount();
});

test("shipped stylesheet is non-empty and scoped to .wfb- classes", () => {
  const css = readFileSync(resolve(here, "../dist/styles.css"), "utf8");
  assert.ok(css.length > 0);
  assert.ok(css.includes(".wfb-root"), "expected scoped class names");
  assert.match(css, /\.wfb-add-menu\s*\{[^}]*overflow-y:\s*auto/s, "step menu is scrollable");
});
