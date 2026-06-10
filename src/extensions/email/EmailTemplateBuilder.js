import { icon } from "../../ui/Icon.js";

/**
 * EmailTemplateBuilder - full-page email composer.
 *
 * Opens an overlay covering the whole builder root. Provides tabs:
 *   - Settings  (subject, preheader, from name/email, reply-to)
 *   - HTML      (raw HTML editor with live preview)
 *   - Plain text
 *   - Preview   (rendered HTML in iframe)
 *
 * Usage:
 *   const tpl = new EmailTemplateBuilder({ mountTarget: builder._root });
 *   tpl.open({ value, onSave, onCancel });
 */
export class EmailTemplateBuilder {
  constructor({ mountTarget }) {
    this.mountTarget = mountTarget;
    this.el = document.createElement("div");
    this.el.className = "wfb-tpl-overlay";
    this.el.style.display = "none";
    this.mountTarget.appendChild(this.el);
  }

  open({ value, onSave, onCancel }) {
    const v = {
      subject: "", preheader: "", from_name: "", from_email: "", reply_to: "",
      html: defaultHtml(), text: "",
      ...(value || {}),
    };

    this.el.innerHTML = `
      <div class="wfb-tpl">
        <header class="wfb-tpl__header">
          <div class="wfb-tpl__title">
            <span class="wfb-tpl__icon">${icon("mail", { size: 20 })}</span>
            Email template builder
          </div>
          <nav class="wfb-tpl__tabs">
            <button class="wfb-tpl__tab is-active" data-tab="settings">Settings</button>
            <button class="wfb-tpl__tab" data-tab="html">HTML</button>
            <button class="wfb-tpl__tab" data-tab="text">Plain text</button>
            <button class="wfb-tpl__tab" data-tab="preview">Preview</button>
          </nav>
          <div class="wfb-tpl__actions">
            <button class="wfb-btn wfb-btn--ghost" data-act="cancel">Cancel</button>
            <button class="wfb-btn wfb-btn--primary" data-act="save">Save template</button>
          </div>
        </header>
        <div class="wfb-tpl__body">
          <section class="wfb-tpl__pane is-active" data-pane="settings">
            <div class="wfb-form">
              <div class="wfb-field">
                <label class="wfb-field__label">Subject<span class="wfb-field__required"> *</span></label>
                <input class="wfb-input" data-k="subject" />
              </div>
              <div class="wfb-field">
                <label class="wfb-field__label">Preheader</label>
                <input class="wfb-input" data-k="preheader" placeholder="Short text shown after the subject in inbox" />
              </div>
              <div class="wfb-tpl__grid2">
                <div class="wfb-field">
                  <label class="wfb-field__label">From name</label>
                  <input class="wfb-input" data-k="from_name" />
                </div>
                <div class="wfb-field">
                  <label class="wfb-field__label">From email</label>
                  <input class="wfb-input" data-k="from_email" placeholder="hello@example.com" />
                </div>
              </div>
              <div class="wfb-field">
                <label class="wfb-field__label">Reply-to</label>
                <input class="wfb-input" data-k="reply_to" placeholder="replies@example.com" />
              </div>
            </div>
          </section>
          <section class="wfb-tpl__pane" data-pane="html">
            <div class="wfb-tpl__split">
              <div class="wfb-tpl__editor">
                <label class="wfb-field__label">HTML source</label>
                <textarea class="wfb-input wfb-input--textarea wfb-input--mono" data-k="html" spellcheck="false"></textarea>
              </div>
              <div class="wfb-tpl__live">
                <label class="wfb-field__label">Live preview</label>
                <iframe class="wfb-tpl__iframe" data-iframe="html"></iframe>
              </div>
            </div>
          </section>
          <section class="wfb-tpl__pane" data-pane="text">
            <div class="wfb-field">
              <label class="wfb-field__label">Plain text version</label>
              <textarea class="wfb-input wfb-input--textarea wfb-input--mono" data-k="text" rows="20" spellcheck="false"
                placeholder="Plain text fallback for clients that don't render HTML."></textarea>
            </div>
            <button type="button" class="wfb-btn wfb-btn--ghost" data-act="generate-text">Generate from HTML</button>
          </section>
          <section class="wfb-tpl__pane" data-pane="preview">
            <iframe class="wfb-tpl__iframe wfb-tpl__iframe--full" data-iframe="preview"></iframe>
          </section>
        </div>
      </div>
    `;
    this.el.style.display = "";

    // Wire inputs
    this.el.querySelectorAll("[data-k]").forEach((inp) => {
      const k = inp.dataset.k;
      inp.value = v[k] ?? "";
      inp.addEventListener("input", () => {
        v[k] = inp.value;
        if (k === "html") this._updateIframe("html", v.html);
      });
    });

    // Tabs
    const tabs = this.el.querySelectorAll(".wfb-tpl__tab");
    const panes = this.el.querySelectorAll(".wfb-tpl__pane");
    tabs.forEach((t) => t.addEventListener("click", () => {
      tabs.forEach((x) => x.classList.toggle("is-active", x === t));
      panes.forEach((p) => p.classList.toggle("is-active", p.dataset.pane === t.dataset.tab));
      if (t.dataset.tab === "preview") this._updateIframe("preview", buildPreview(v));
      if (t.dataset.tab === "html")    this._updateIframe("html",    v.html);
    }));

    // Actions
    this.el.querySelector('[data-act="cancel"]').addEventListener("click", () => {
      this.close();
      if (onCancel) onCancel();
    });
    this.el.querySelector('[data-act="save"]').addEventListener("click", () => {
      if (!v.subject || !v.subject.trim()) {
        alert("Subject is required.");
        return;
      }
      this.close();
      if (onSave) onSave({ ...v });
    });
    this.el.querySelector('[data-act="generate-text"]').addEventListener("click", () => {
      const text = htmlToText(v.html || "");
      v.text = text;
      this.el.querySelector('[data-k="text"]').value = text;
    });

    // Initial iframe
    this._updateIframe("html", v.html);

    // Keyboard: Esc cancels
    this._keyHandler = (e) => { if (e.key === "Escape") this.close(); };
    document.addEventListener("keydown", this._keyHandler);
  }

  _updateIframe(name, html) {
    const ifr = this.el.querySelector(`[data-iframe="${name}"]`);
    if (!ifr) return;
    const doc = ifr.contentDocument;
    if (!doc) return;
    doc.open(); doc.write(html || ""); doc.close();
  }

  close() {
    this.el.style.display = "none";
    this.el.innerHTML = "";
    if (this._keyHandler) {
      document.removeEventListener("keydown", this._keyHandler);
      this._keyHandler = null;
    }
  }
}

function defaultHtml() {
  return `<!doctype html>
<html>
  <head><meta charset="utf-8" /><title>Email</title></head>
  <body style="font-family: -apple-system, Segoe UI, Roboto, Arial, sans-serif; line-height:1.5; color:#222; padding:24px;">
    <h1 style="margin-top:0">Hello {{first_name}},</h1>
    <p>Write your message here.</p>
    <p>— The team</p>
  </body>
</html>`;
}

function buildPreview(v) {
  // Wrap with a small subject/preheader header bar for context
  return `<!doctype html><html><body style="margin:0;font-family:-apple-system,Segoe UI,Roboto,Arial,sans-serif;">
    <div style="background:#f5f5f7;border-bottom:1px solid #e5e7eb;padding:12px 16px;font-size:13px;color:#555;">
      <div><strong>Subject:</strong> ${escape(v.subject || "(no subject)")}</div>
      ${v.preheader ? `<div style="color:#888"><em>${escape(v.preheader)}</em></div>` : ""}
      ${v.from_name || v.from_email ? `<div style="color:#888;font-size:12px;">From: ${escape(v.from_name || "")} ${v.from_email ? "&lt;" + escape(v.from_email) + "&gt;" : ""}</div>` : ""}
    </div>
    <div>${v.html || "<em>No HTML content</em>"}</div>
  </body></html>`;
}

function escape(s) {
  return String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
}

function htmlToText(html) {
  return String(html || "")
    .replace(/<style[\s\S]*?<\/style>/gi, "")
    .replace(/<script[\s\S]*?<\/script>/gi, "")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/p>/gi, "\n\n")
    .replace(/<\/h[1-6]>/gi, "\n\n")
    .replace(/<[^>]+>/g, "")
    .replace(/\n{3,}/g, "\n\n")
    .replace(/[ \t]+\n/g, "\n")
    .trim();
}
