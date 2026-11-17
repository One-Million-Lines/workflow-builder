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

test("http request schema hides unsupported runtime fields and uses url input type", async () => {
  const { defaultDefinitions } = await import(distEsm);
  const httpStep = defaultDefinitions.steps.steps.find((step) => step.type === "http_request");
  assert.ok(httpStep?.schema?.fields, "http_request schema should be inlined");

  const fields = httpStep.schema.fields;
  const urlField = fields.find((field) => field.name === "url");
  assert.equal(urlField?.input_type, "url");
  assert.equal(fields.some((field) => field.name === "save_response_as"), false);
  assert.equal(fields.some((field) => field.name === "fail_on_error"), false);
});

test("importing the package does not require browser globals", () => {
  // We imported the ESM/CJS builds at the top of this file with NO window /
  // document defined. Reaching this assertion proves there was no crash.
  assert.equal(typeof globalThis.window, "undefined");
});

test("visible_if all-rules hide and show fields correctly", async () => {
  installDom();
  const { renderForm } = await import(distEsm);

  const schema = {
    fields: [
      {
        name: "condition_type",
        label: "Condition type",
        type: "select",
        default: "user_activity",
        options: [
          { label: "User activity", value: "user_activity" },
          { label: "Workflow status", value: "workflow_status" },
        ],
      },
      {
        name: "what_workflow",
        label: "Workflow",
        type: "select",
        default: "other",
        options: [
          { label: "This workflow", value: "current" },
          { label: "Other workflow", value: "other" },
        ],
      },
      {
        name: "workflow_ids",
        label: "Workflow IDs",
        type: "text",
        placeholder: "workflow ids",
        visible_if: {
          all: [
            { field: "condition_type", equals: "workflow_status" },
            { field: "what_workflow", equals: "other" },
          ],
        },
      },
    ],
  };

  const form = renderForm(schema, {});
  document.body.appendChild(form.element);

  const workflowIdsInput = form.element.querySelector('input[placeholder="workflow ids"]');
  assert.ok(workflowIdsInput);
  const workflowIdsWrap = workflowIdsInput.closest(".wfb-field");
  assert.equal(workflowIdsWrap.style.display, "none");

  const [conditionTypeSelect, workflowSelect] = form.element.querySelectorAll("select.wfb-input");
  conditionTypeSelect.value = "workflow_status";
  conditionTypeSelect.dispatchEvent(new Event("change"));
  assert.notEqual(workflowIdsWrap.style.display, "none");

  workflowSelect.value = "current";
  workflowSelect.dispatchEvent(new Event("change"));
  assert.equal(workflowIdsWrap.style.display, "none");
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

test("destroying during async mount does not attach an abandoned builder", async () => {
  installDom();
  const { createWorkflowBuilder } = await import(distEsm);
  const host = document.createElement("div");
  document.body.appendChild(host);

  const originalFetch = globalThis.fetch;
  let releaseSteps;
  globalThis.fetch = () => new Promise((resolve) => {
    releaseSteps = () => resolve({
      ok: true,
      json: async () => ({ steps: [], _conditionsSchema: { fields: [] } }),
    });
  });

  try {
    const builder = createWorkflowBuilder({
      target: host,
      registries: {
        steps: "/delayed-steps.json",
        triggers: { triggers: [] },
        actions: { actions: [] },
      },
    });
    builder.destroy();
    releaseSteps();
    await builder.ready;

    assert.equal(host.querySelector(".wfb-root"), null);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("commitAndGetWorkflow flushes open form state and result is reloadable", async () => {
  installDom();
  const { createWorkflowBuilder } = await import(distEsm);
  const host = document.createElement("div");
  document.body.appendChild(host);

  const builder = createWorkflowBuilder({
    target: host,
    initialValue: {
      trigger: { type: "user_segment", config: { segment_id: "seg_vip" } },
      steps: [],
    },
  });
  await builder.ready;

  // The commit mechanism should return the current workflow without errors
  const committed = builder.commitAndGetWorkflow();
  assert.equal(committed.trigger.type, "user_segment");
  assert.equal(committed.trigger.config.segment_id, "seg_vip");
  assert.ok(Array.isArray(committed.steps));

  // Verify the committed workflow can seed a new builder
  const reloadedHost = document.createElement("div");
  document.body.appendChild(reloadedHost);
  const reloaded = createWorkflowBuilder({ target: reloadedHost, initialValue: committed });
  await reloaded.ready;
  assert.equal(reloaded.getValue().trigger.config.segment_id, "seg_vip");

  builder.destroy();
  reloaded.destroy();
});

test("plugin-managed steps remain in the workflow and save their config", async () => {
  installDom();
  const { createWorkflowBuilder } = await import(distEsm);
  const host = document.createElement("div");
  document.body.appendChild(host);

  let pluginProps;
  const changes = [];
  const builder = createWorkflowBuilder({
    target: host,
    initialValue: {
      trigger: { type: "api_request", config: { endpoint: "/start" } },
      steps: [{ id: "existing-delay", type: "delay", config: { value: 1, unit: "hours" } }],
    },
    modules: {
      email: (props) => { pluginProps = props; },
    },
    onChange: (workflow) => changes.push(workflow),
  });
  await builder.ready;

  builder.instance._handleAddStep("email", { parentId: "existing-delay" });

  const added = builder.getValue().steps[1];
  assert.equal(added.type, "email");
  assert.equal(pluginProps.step.id, added.id, "new plugin step is opened for editing");
  assert.equal(changes.length, 1, "adding a plugin step emits exactly one change");
  assert.equal(changes.at(-1).steps[1].id, added.id, "new step is emitted to the host");
  assert.equal(
    builder.commitAndGetWorkflow().steps[1].id,
    added.id,
    "an unconfigured plugin step is still part of the committed workflow",
  );

  const changesBeforePluginSave = changes.length;
  pluginProps.onSave(
    { template_id: 42 },
    { condition: "random", conditionrules: { random_yes: 75, random_no: 25 } },
  );
  const committed = builder.commitAndGetWorkflow();
  assert.equal(changes.length, changesBeforePluginSave + 1, "plugin save emits exactly one change");
  assert.equal(committed.steps[0].id, "existing-delay", "existing steps are preserved");
  assert.equal(committed.steps[1].id, added.id, "new plugin step is preserved");
  assert.equal(committed.steps[1].config.template_id, 42);
  assert.equal(committed.steps[1].condition, "random");
  assert.deepEqual(committed.steps[1].conditionrules, { random_yes: 75, random_no: 25 });

  builder.destroy();
});

test("validator accepts HTTP request URLs as full URL, domain, or hostname", async () => {
  const { WorkflowValidator } = await import(distEsm);
  const validator = new WorkflowValidator(
    { get: () => ({}) },
    { get: () => ({}) },
  );

  const makeWorkflow = (url) => ({
    trigger: { id: "tr_1", type: "api_request", config: { endpoint: "/incoming" } },
    steps: [{ id: "s_http", type: "http_request", config: { method: "GET", url } }],
  });

  const fullUrlResult = validator.validate(makeWorkflow("https://api.example.com/users/{{customer.id}}"));
  assert.equal(
    fullUrlResult.errors.some((e) => e.id === "s_http"),
    false,
    "full HTTP URL with placeholders should be accepted",
  );

  const domainResult = validator.validate(makeWorkflow("api.example.com"));
  assert.equal(
    domainResult.errors.some((e) => e.id === "s_http"),
    false,
    "domain-only target should be accepted",
  );

  const hostnameResult = validator.validate(makeWorkflow("localhost"));
  assert.equal(
    hostnameResult.errors.some((e) => e.id === "s_http"),
    false,
    "hostname-only target should be accepted",
  );
});

test("validator rejects invalid HTTP request URLs", async () => {
  const { WorkflowValidator } = await import(distEsm);
  const validator = new WorkflowValidator(
    { get: () => ({}) },
    { get: () => ({}) },
  );

  const result = validator.validate({
    trigger: { id: "tr_1", type: "api_request", config: { endpoint: "/incoming" } },
    steps: [{ id: "s_http", type: "http_request", config: { method: "GET", url: "not a url !!!" } }],
  });

  assert.equal(result.valid, false);
  assert.ok(
    result.errors.some((e) => e.id === "s_http" && /valid URL, domain, or hostname/.test(e.message)),
  );
});

test("empty condition branches render a visible do-nothing placeholder", async () => {
  installDom();
  const { WorkflowBuilder } = await import(distEsm);
  const host = document.createElement("div");
  document.body.appendChild(host);

  const builder = new WorkflowBuilder({
    container: host,
    workflow: {
      trigger: { type: "api_request", config: { endpoint: "/incoming" } },
      steps: [{
        id: "cond_1",
        type: "condition",
        config: { condition_type: "random", random_yes: 50, random_no: 50 },
        branches: { yes: [], no: [] },
      }],
    },
  });
  await builder.mount();

  const placeholders = host.querySelectorAll(".wfb-branch__empty-text");
  assert.equal(placeholders.length, 2);
  assert.equal(placeholders[0].textContent, "Do nothing");
  assert.equal(placeholders[1].textContent, "Do nothing");

  builder.unmount();
});

test("opening and closing the sidebar updates canvas layout offset", async () => {
  installDom();
  const { WorkflowBuilder } = await import(distEsm);
  const host = document.createElement("div");
  document.body.appendChild(host);

  const builder = new WorkflowBuilder({
    container: host,
    workflow: {
      trigger: { type: "api_request", config: { endpoint: "/incoming" } },
      steps: [],
    },
  });
  await builder.mount();

  builder._sidebar.el.getBoundingClientRect = () => ({
    top: 0, right: 380, bottom: 500, left: 0, width: 380, height: 500, x: 0, y: 0, toJSON: () => ({}),
  });

  builder._openTriggerEditor();
  const root = host.querySelector(".wfb-root");
  assert.ok(root.classList.contains("wfb-root--sidebar-open"));
  assert.equal(root.style.getPropertyValue("--wfb-active-sidebar-width"), "380px");

  builder._sidebar.close();
  assert.equal(root.classList.contains("wfb-root--sidebar-open"), false);
  assert.equal(root.style.getPropertyValue("--wfb-active-sidebar-width"), "0px");

  builder.unmount();
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
