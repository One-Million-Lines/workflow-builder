export class EventEmitter {
  constructor() {
    this._handlers = new Map();
  }
  on(event, handler) {
    if (!this._handlers.has(event)) this._handlers.set(event, new Set());
    this._handlers.get(event).add(handler);
    return () => this.off(event, handler);
  }
  off(event, handler) {
    this._handlers.get(event)?.delete(handler);
  }
  emit(event, payload) {
    this._handlers.get(event)?.forEach((h) => {
      try { h(payload); } catch (e) { console.error(`[${event}]`, e); }
    });
  }
}
