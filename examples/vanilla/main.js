import { WorkflowBuilder } from "../../src/index.js";

// Example extension — adds a Slack notification step that comes entirely from
// the extension (no edits to the core definitions). Try removing built-ins via
// `remove: { steps: ["webpush"] }` to see them disappear from the add menu.
const slackExtension = {
  steps: [
    {
      type: "slack_notify",
      label: "Slack message",
      icon: "bell",
      category: "integration",
      description: "Post a message to a Slack channel",
      schema: {
        type: "object",
        title: "Slack",
        fields: [
          { name: "channel", label: "Channel", type: "text", required: true, placeholder: "#general" },
          { name: "text",    label: "Message", type: "textarea", required: true, rows: 4 },
        ],
      },
    },
  ],
};

const initialWorkflow = {
  id: "workflow_demo",
  name: "Welcome automation",
  status: "draft",
  trigger: {
    type: "user_segment",
    config: { segment_id: "seg_new_subscribers", repeat_flag: false },
  },
  steps: [
    {
      type: "action",
      config: { action_type: "update_list_status", list_id: "list_main", list_status: "subscribed" },
    },
    {
      type: "delay",
      config: { mode: "value", value: 1, unit: "hours" },
    },
    {
      type: "email",
      config: {
        template: {
          subject: "Welcome to our store!",
          preheader: "We're glad to have you on board.",
          from_name: "The team",
          from_email: "hello@example.com",
          html: "<h1>Hi {{first_name}},</h1><p>Thanks for joining.</p>",
          text: "Hi {{first_name}}, thanks for joining.",
        },
      },
    },
  ],
};

const output = document.getElementById("output-json");
function renderOutput(wf) {
  output.textContent = JSON.stringify(wf, null, 2);
}

const builder = new WorkflowBuilder({
  container: "#workflow-builder",
  workflow: initialWorkflow,
  registries: {
    steps: "/definitions/steps.json",
    triggers: "/definitions/triggers.json",
    actions: "/definitions/actions.json",
  },
  extensions: [slackExtension],
  onChange: (wf) => renderOutput(wf),
  onSave: (wf) => console.log("save", wf),
});

await builder.mount();
renderOutput(builder.getWorkflow());

// Demo header buttons
document.getElementById("btn-export").addEventListener("click", () => {
  const json = JSON.stringify(builder.export(), null, 2);
  navigator.clipboard?.writeText(json);
  alert("Workflow JSON copied to clipboard.");
});
document.getElementById("btn-import").addEventListener("click", () => {
  const raw = prompt("Paste workflow JSON:");
  if (!raw) return;
  try {
    builder.import(JSON.parse(raw));
  } catch (e) {
    alert("Invalid JSON: " + e.message);
  }
});
document.getElementById("btn-validate").addEventListener("click", () => {
  const r = builder.validate();
  if (r.valid) alert("Workflow is valid." + (r.warnings.length ? `\n${r.warnings.length} warning(s).` : ""));
  else alert(`Invalid:\n- ${r.errors.map((e) => e.message).join("\n- ")}`);
});
document.getElementById("btn-reset").addEventListener("click", () => {
  if (confirm("Reset workflow?")) builder.setWorkflow({ trigger: { type: null, config: {} }, steps: [] });
});

window.builder = builder;
