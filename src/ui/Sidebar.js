import { icon } from "./Icon.js";
import { defaultT } from "../i18n/index.js";

/**
 * A simple right-side sliding sidebar.
 *
 * Changes are auto-committed on every form input — there are no Save/Cancel
 * buttons. The sidebar just shows the configuration form and closes with X.
 *
 * open({ title, content, extras, status, onCommit, onClose })
 *   - content: Node for the main body
 *   - extras:  optional Node appended after main content
 *   - status:  optional { value:"active"|"inactive", onToggle(newValue) }
 *   - onCommit: optional callback used to flush the open editor on host save
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
            <span class="wfb-sidebar__status-label">${t("sidebar_enabled_label")}</span>
          </label>
          <button class="wfb-sidebar__widen" type="button" aria-label="${t("sidebar_toggle_width")}" title="${t("sidebar_expand")}">
            ${icon("expand", { size: 16 })}
          </button>
          <button class="wfb-sidebar__close" type="button" aria-label="${t("sidebar_close")}">${icon("close", { size: 18 })}</button>
        </div>
      </header>
      <div class="wfb-sidebar__body"></div>
    `;
    this.titleEl    = this.el.querySelector(".wfb-sidebar__title");
    this.bodyEl     = this.el.querySelector(".wfb-sidebar__body");
    this.statusEl   = this.el.querySelector(".wfb-sidebar__status");
    this.statusInput = this.statusEl.querySelector("input");
    this.widenBtn   = this.el.querySelector(".wfb-sidebar__widen");
    this.widenBtn.addEventListener("click", () => this.toggleWide());
    this.el.querySelector(".wfb-sidebar__close").addEventListener("click", () => this.close());
  }

  mount(parent) { parent.appendChild(this.el); }

  toggleWide(force) {
    const next = typeof force === "boolean" ? force : !this.el.classList.contains("wfb-sidebar--wide");
    this.el.classList.toggle("wfb-sidebar--wide", next);
    this.widenBtn.title = next ? this._t("sidebar_shrink") : this._t("sidebar_expand");
  }

  open({ title, content, extras, status, onCommit, onClose }) {
    this.titleEl.textContent = title || "";
    this.bodyEl.innerHTML = "";
    if (content instanceof Node) this.bodyEl.appendChild(content);
    else if (typeof content === "string") this.bodyEl.innerHTML = content;
    if (extras instanceof Node) this.bodyEl.appendChild(extras);

    if (status) {
      this.statusEl.style.display = "";
      const isActive = ("value" in status) ? status.value !== "inactive" : !!status.enabled;
      this.statusInput.checked = isActive;
      const statusLabel = this.statusEl.querySelector(".wfb-sidebar__status-label");
      if (statusLabel) statusLabel.textContent = isActive ? this._t("status_active") : this._t("status_inactive");
      if (this.statusInput._h) this.statusInput.removeEventListener("change", this.statusInput._h);
      const h = () => {
        const newActive = this.statusInput.checked;
        const newStatus = newActive ? "active" : "inactive";
        if (statusLabel) statusLabel.textContent = newActive ? this._t("status_active") : this._t("status_inactive");
        status.onToggle && status.onToggle(newStatus);
      };
      this.statusInput._h = h;
      this.statusInput.addEventListener("change", h);
    } else {
      this.statusEl.style.display = "none";
    }

    this._onCommit = onCommit;
    this._onClose = onClose;
    this.el.classList.add("wfb-sidebar--open");
  }

  commit() {
    if (!this.el.classList.contains("wfb-sidebar--open") || typeof this._onCommit !== "function") {
      return false;
    }
    this._onCommit();
    return true;
  }

  close() {
    if (!this.el.classList.contains("wfb-sidebar--open")) return;
    this.el.classList.remove("wfb-sidebar--open");
    this._onCommit = null;
    if (this._onClose) {
      const callback = this._onClose;
      this._onClose = null;
      callback();
    }
  }
}
