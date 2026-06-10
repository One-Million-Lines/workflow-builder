/**
 * Loads JSON definitions and schemas. Resolves relative schema paths against the
 * directory of the registry source.
 */
export class RegistryLoader {
  constructor() {
    this._schemaCache = new Map();
  }

  async loadJson(source) {
    if (typeof source === "string") {
      const res = await fetch(source);
      if (!res.ok) throw new Error(`Failed to load ${source}: ${res.status}`);
      return { data: await res.json(), baseUrl: source };
    }
    return { data: source, baseUrl: null };
  }

  async loadSchema(schemaPath, baseUrl) {
    if (!schemaPath) return null;
    const url = this._resolve(schemaPath, baseUrl);
    if (this._schemaCache.has(url)) return this._schemaCache.get(url);
    const res = await fetch(url);
    if (!res.ok) throw new Error(`Failed to load schema ${url}: ${res.status}`);
    const schema = await res.json();
    this._schemaCache.set(url, schema);
    return schema;
  }

  _resolve(path, baseUrl) {
    if (!baseUrl) return path;
    if (/^https?:\/\//.test(path) || path.startsWith("/")) return path;
    const dir = baseUrl.substring(0, baseUrl.lastIndexOf("/") + 1);
    return dir + path;
  }
}
