<!--
  Vue 3 wrapper for @openmarketing/workflow-builder.
  The package is framework-agnostic; this SFC wraps the neutral factory.
-->
<template>
  <div ref="host" class="wfb-host" />
</template>

<script setup>
import { onMounted, onBeforeUnmount, ref } from "vue";
import { createWorkflowBuilder } from "@openmarketing/workflow-builder";
import "@openmarketing/workflow-builder/styles.css";

const props = defineProps({
  initialValue: { type: Object, default: null },
  extensions: { type: Array, default: () => [] },
});
const emit = defineEmits(["change"]);

const host = ref(null);
let builder = null;

onMounted(() => {
  builder = createWorkflowBuilder({
    target: host.value,
    initialValue: props.initialValue,
    extensions: props.extensions,
    onChange: (wf) => emit("change", wf),
  });
});

onBeforeUnmount(() => builder?.destroy());

defineExpose({
  getValue: () => builder?.getValue(),
  setValue: (v) => builder?.setValue(v),
  validate: () => builder?.validate(),
});
</script>

<style scoped>
.wfb-host {
  width: 100%;
  height: 100%;
  min-height: 500px;
}
</style>

<!--
  Usage:
  <WorkflowBuilder :initial-value="workflow" @change="onChange" />
-->
