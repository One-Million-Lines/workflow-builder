import { icon } from "./Icon.js";
import { defaultT } from "../i18n/index.js";

/**
 * A simple right-side sliding sidebar.
 *
 * open({ title, content, extras, status, onSave, hideFooter, onClose })
 *   - content: Node or HTML string for the main body
 *   - extras: optional Node appended after the main content (e.g. step-level conditions)
 *   - status: optional { enabled, onToggle(enabled) } to render a power toggle in the header
 */
export class Sidebar {
  constructor(t = defaultT) {
    this._t = t;
    this.el = document.createElement("aside");
    this.el.className = "wfb-sidebar";
    this.el.innerHTML = `
      <header class="wfb-sidebar__header">
        <h3 class="wfb-sidebar__title">${t("sidebar_default_title")}</h3>
        <div class="wfb-sidebar__head-actions">
          <label class="wfb-sidebar__status" style="display:none">
            <input type="checkbox" />
            <span>${t("sidebar_enabled_label")}</span>
          </label>
          <button class="wfb-sidebar__widen" type="button" aria-label="${t("sidebar_toggle_width")}" title="${t("sidebar_expand")}">
            ${icon("expand", { size: 16 })}
          </button>
          <button class="wfb-sidebar__close" type="button" aria-label="${t("sidebar_close")}">${icon("close", { size: 18 })}</button>
        </div>
      </header>
      <div class="wfb-sidebar__body"></div>
      <footer class="wfb-sidebar__footer">
        <button type="button" class="wfb-btn wfb-btn--ghost" data-act="cancel">${t("sidebar_cancel")}</button>
        <button type="button" class="wfb-btn wfb-btn--primary" data-act="save">${t("sidebar_save")}</button>
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
    this.widenBtn.title = next ? this._t("sidebar_shrink") : this._t("sidebar_expand");
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
