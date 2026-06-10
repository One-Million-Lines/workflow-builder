import { icon } from "./Icon.js";

/**
 * A simple right-side sliding sidebar.
 *
 * open({ title, content, extras, status, onSave, hideFooter, onClose })
 *   - content: Node or HTML string for the main body
 *   - extras: optional Node appended after the main content (e.g. step-level conditions)
 *   - status: optional { enabled, onToggle(enabled) } to render a power toggle in the header
 */
export class Sidebar {
  constructor() {
    this.el = document.createElement("aside");
    this.el.className = "wfb-sidebar";
    this.el.innerHTML = `
      <header class="wfb-sidebar__header">
        <h3 class="wfb-sidebar__title">Configuration</h3>
        <div class="wfb-sidebar__head-actions">
          <label class="wfb-sidebar__status" style="display:none">
            <input type="checkbox" />
            <span>Enabled</span>
          </label>
          <button class="wfb-sidebar__widen" type="button" aria-label="Toggle width" title="Toggle sidebar width">
            ${icon("expand", { size: 16 })}
          </button>
          <button class="wfb-sidebar__close" type="button" aria-label="Close">${icon("close", { size: 18 })}</button>
        </div>
      </header>
      <div class="wfb-sidebar__body"></div>
      <footer class="wfb-sidebar__footer">
        <button type="button" class="wfb-btn wfb-btn--ghost" data-act="cancel">Cancel</button>
        <button type="button" class="wfb-btn wfb-btn--primary" data-act="save">Save</button>
      </footer>
    `;
    this.titleEl = this.el.querySelector(".wfb-sidebar__title");
    this.bodyEl = this.el.querySelector(".wfb-sidebar__body");
    this.footerEl = this.el.querySelector(".wfb-sidebar__footer");
    this.statusEl = this.el.querySelector(".wfb-sidebar__status");
    this.statusInput = this.statusEl.querySelector("input");
    this.widenBtn = this.el.querySelector(".wfb-sidebar__widen");
    this.widenBtn.addEventListener("click", () => this.toggleWide());
    this.el.querySelector(".wfb-sidebar__close").addEventListener("click", () => this.close());
    this.el.querySelector('[data-act="cancel"]').addEventListener("click", () => this.close());
    this._saveBtn = this.el.querySelector('[data-act="save"]');
  }

  mount(parent) { parent.appendChild(this.el); }

  toggleWide(force) {
    const next = typeof force === "boolean" ? force : !this.el.classList.contains("wfb-sidebar--wide");
    this.el.classList.toggle("wfb-sidebar--wide", next);
    this.widenBtn.title = next ? "Shrink sidebar" : "Expand sidebar";
  }

  open({ title, content, extras, status, onSave, hideFooter, onClose }) {
    this.titleEl.textContent = title || "";
    this.bodyEl.innerHTML = "";
    if (content instanceof Node) this.bodyEl.appendChild(content);
    else if (typeof content === "string") this.bodyEl.innerHTML = content;
    if (extras instanceof Node) this.bodyEl.appendChild(extras);

    if (status) {
      this.statusEl.style.display = "";
      this.statusInput.checked = !!status.enabled;
      if (this.statusInput._h) this.statusInput.removeEventListener("change", this.statusInput._h);
      const h = () => status.onToggle && status.onToggle(this.statusInput.checked);
      this.statusInput._h = h;
      this.statusInput.addEventListener("change", h);
    } else {
      this.statusEl.style.display = "none";
    }

    this.footerEl.style.display = hideFooter ? "none" : "";
    if (this._saveBtn._h) this._saveBtn.removeEventListener("click", this._saveBtn._h);
    const handler = () => { onSave && onSave(); };
    this._saveBtn._h = handler;
    this._saveBtn.addEventListener("click", handler);

    this._onClose = onClose;
    this.el.classList.add("wfb-sidebar--open");
  }

  close() {
    if (!this.el.classList.contains("wfb-sidebar--open")) return;
    this.el.classList.remove("wfb-sidebar--open");
    if (this._onClose) { const cb = this._onClose; this._onClose = null; cb(); }
  }
}
