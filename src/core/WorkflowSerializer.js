import { deepClone } from "./utils.js";

/**
 * Serializer cleans the nested workflow JSON for export.
 */
export class WorkflowSerializer {
  static export(workflow) {
    const clean = deepClone(workflow);
    return clean;
  }

  static import(json) {
    if (typeof json === "string") return JSON.parse(json);
    return deepClone(json);
  }
}
