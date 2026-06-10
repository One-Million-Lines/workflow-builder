import { icon } from "../ui/Icon.js";

/**
 * Floating popup menu showing available step types.
 */
export class AddStepMenu {
  constructor(stepRegistry, onPick) {
    this.stepRegistry = stepRegistry;
    this.onPick = onPick;
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
    const rect = anchor.getBoundingClientRect();
    const parentRect = this.el.parentElement.getBoundingClientRect();
    this.el.style.display = "block";
    this.el.style.top = `${rect.bottom - parentRect.top + 8}px`;
    this.el.style.left = `${rect.left - parentRect.left + rect.width / 2 - this.el.offsetWidth / 2}px`;
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
      <div class="wfb-add-menu__header">Add step to your workflow</div>
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
