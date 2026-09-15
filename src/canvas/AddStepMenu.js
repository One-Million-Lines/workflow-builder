import { icon } from "../ui/Icon.js";
import { defaultT } from "../i18n/index.js";

/**
 * Floating popup menu showing available step types.
 */
export class AddStepMenu {
  constructor(stepRegistry, onPick, t = defaultT) {
    this.stepRegistry = stepRegistry;
    this.onPick = onPick;
    this._t = t;
    this.el = document.createElement("div");
    this.el.className = "wfb-add-menu";
    this.el.setAttribute("role", "menu");
    this.el.style.display = "none";
    document.addEventListener("click", (e) => {
      if (this._open && !this.el.contains(e.target) && !this._anchor?.contains(e.target)) {
        this.close();
      }
    });
  }

  mount(parent) { parent.appendChild(this.el); }

  openAt(anchor, context) {
    this._anchor = anchor;
    this._context = context;
    this._render();

    // Reveal the menu off-screen first so it can be measured before choosing
    // whether it fits above or below the add button.
    this.el.style.display = "block";
    this.el.style.visibility = "hidden";
    this.el.style.top = "0";
    this.el.style.left = "0";
    this.el.style.maxWidth = "";
    this.el.style.maxHeight = "";

    const rect = anchor.getBoundingClientRect();
    const parentRect = this.el.parentElement.getBoundingClientRect();
    const viewportWidth = window.innerWidth || document.documentElement.clientWidth;
    const viewportHeight = window.innerHeight || document.documentElement.clientHeight;
    const margin = 8;
    const gap = 8;
    const bounds = {
      top: Math.max(parentRect.top, 0) + margin,
      right: Math.min(parentRect.right, viewportWidth) - margin,
      bottom: Math.min(parentRect.bottom, viewportHeight) - margin,
      left: Math.max(parentRect.left, 0) + margin,
    };

    // Keep wide menus inside narrow embeds before measuring their final size.
    this.el.style.maxWidth = `${Math.max(0, bounds.right - bounds.left)}px`;
    const menuWidth = Math.min(this.el.offsetWidth, Math.max(0, bounds.right - bounds.left));
    const menuHeight = this.el.offsetHeight;
    const spaceBelow = Math.max(0, bounds.bottom - rect.bottom - gap);
    const spaceAbove = Math.max(0, rect.top - gap - bounds.top);
    const opensAbove = menuHeight > spaceBelow && spaceAbove > spaceBelow;
    const availableHeight = opensAbove ? spaceAbove : spaceBelow;
    const renderedHeight = Math.min(menuHeight, availableHeight);

    const desiredTop = opensAbove
      ? rect.top - gap - renderedHeight
      : rect.bottom + gap;
    const maxTop = Math.max(bounds.top, bounds.bottom - renderedHeight);
    const top = Math.min(Math.max(desiredTop, bounds.top), maxTop);

    const desiredLeft = rect.left + rect.width / 2 - menuWidth / 2;
    const maxLeft = Math.max(bounds.left, bounds.right - menuWidth);
    const left = Math.min(Math.max(desiredLeft, bounds.left), maxLeft);

    this.el.dataset.placement = opensAbove ? "top" : "bottom";
    this.el.style.maxHeight = `${availableHeight}px`;
    this.el.style.top = `${top - parentRect.top}px`;
    this.el.style.left = `${left - parentRect.left}px`;
    this.el.style.visibility = "visible";
    this._open = true;
  }

  close() {
    this.el.style.display = "none";
    this._open = false;
    this._anchor = null;
  }

  _render() {
    const steps = this.stepRegistry.list();
    const groups = {};
    steps.forEach((s) => {
      const cat = s.category || "other";
      groups[cat] = groups[cat] || [];
      groups[cat].push(s);
    });
    this.el.innerHTML = `
      <div class="wfb-add-menu__header">${this._t("add_step_header")}</div>
      <div class="wfb-add-menu__grid">
        ${steps
          .map(
            (s) => `
          <button class="wfb-add-menu__item" data-type="${s.type}" type="button">
            <span class="wfb-add-menu__icon">${icon(s.icon || "gear", { size: 18 })}</span>
            <span class="wfb-add-menu__label">${s.label}</span>
          </button>
        `
          )
          .join("")}
      </div>
    `;
    this.el.querySelectorAll(".wfb-add-menu__item").forEach((btn) => {
      btn.addEventListener("click", () => {
        const type = btn.dataset.type;
        this.close();
        this.onPick(type, this._context);
      });
    });
  }
}
