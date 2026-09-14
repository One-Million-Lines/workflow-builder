import { deepClone, uid } from "../core/utils.js";
import { icon } from "../ui/Icon.js";

/**
 * Render a JSON-schema-like form into the given container.
 *
 * Supported field types:
 *   text, textarea, number, select, toggle, checkbox, radio, hidden,
 *   info, divider, json, repeater, condition_group, email_template, http_kv
 *
 * Field options:
 *   visible_if: { field, equals } | { field, in: [...] }
 *   computed_from: { field, formula: "100-x" }   // currently only "100-x" supported
 *   required, default, placeholder, min, max, options
 *   options_source: "attributes" | "lists" | "list_statuses" | "segments" | "events" | "event_fields"
 *   depends_on: ["other_field", ...]  // for cascading async dropdowns
 *   repeater: { item_label, add_label, min_items, max_items, item_fields: [...] }
 *   condition_group: { item_fields: [...], add_label, item_label }
 *
 * The third argument can carry extension context:
 *   { dataProvider, parentState, openModule(name, props) }
 *
 * Returns: { element, getValues(), setValues(values), validate() }
 */
export function renderForm(schema, initialValues = {}, formCtx = {}) {
  const container = document.createElement("form");
  container.className = "wfb-form";
  container.addEventListener("submit", (e) => e.preventDefault());

  const state = deepClone(initialValues || {});
  applyDefaults(schema.fields, state);

  const ctx = { state, fieldEls: new Map(), formCtx };

  for (const field of schema.fields) {
    const wrap = renderFieldWrap(field, ctx, (changedFieldName) => rerenderVisibility(schema, ctx, changedFieldName));
    ctx.fieldEls.set(field.name, wrap);
    container.appendChild(wrap);
  }

  /**
   * changedField (optional): the name of the field that triggered the update.
   * When provided, only dependent selects that list that field in `depends_on`
   * are reloaded — prevents the O(n²) reload chain that would otherwise occur
   * on every key-press.  Pass `null` from `setValues` to reload everything.
   */
  function rerenderVisibility(schemaRef, ctxRef, changedField = null) {
    for (const field of schemaRef.fields) {
      const wrap = ctxRef.fieldEls.get(field.name);
      if (!wrap) continue;
      wrap.style.display = isVisible(field, ctxRef.state) ? "" : "none";
    }
    for (const field of schemaRef.fields) {
      if (!field.computed_from) continue;
      const src = ctxRef.state[field.computed_from.field];
      if (typeof src === "number") {
        let v = src;
        if (field.computed_from.formula === "100-x") v = 100 - src;
        ctxRef.state[field.name] = v;
        const w = ctxRef.fieldEls.get(field.name);
        const inp = w?.querySelector("input.wfb-input");
        if (inp) inp.value = v;
      }
    }
    // Reload async selects — but only those whose `depends_on` list includes
    // the field that just changed. If changedField is null (full refresh), reload all.
    for (const field of schemaRef.fields) {
      if (!field.depends_on || !field.options_source) continue;
      if (changedField !== null && !field.depends_on.includes(changedField)) continue;
      const w = ctxRef.fieldEls.get(field.name);
      const sel = w?.querySelector("select.wfb-input");
      if (sel && typeof sel._wfbReload === "function") sel._wfbReload();
    }
  }
  rerenderVisibility(schema, ctx, null);

  return {
    element: container,
    getValues() {
      const out = {};
      for (const field of schema.fields) {
        if (field.type === "info" || field.type === "divider") continue;
        if (!isVisible(field, state)) continue;
        out[field.name] = deepClone(state[field.name]);
      }
      return out;
    },
    setValues(values) {
      Object.assign(state, deepClone(values || {}));
      container.innerHTML = "";
      ctx.fieldEls.clear();
      applyDefaults(schema.fields, state);
      for (const field of schema.fields) {
        const wrap = renderFieldWrap(field, ctx, (changedFieldName) => rerenderVisibility(schema, ctx, changedFieldName));
        ctx.fieldEls.set(field.name, wrap);
        container.appendChild(wrap);
      }
      rerenderVisibility(schema, ctx, null); // full reload on setValues
    },
    validate() {
      const errors = [];
      for (const field of schema.fields) {
        const wrap = ctx.fieldEls.get(field.name);
        const errEl = wrap?.querySelector(":scope > .wfb-field__error");
        if (errEl) errEl.textContent = "";
        if (!isVisible(field, state)) continue;
        const val = state[field.name];

        if (field.type === "repeater") {
          const items = Array.isArray(val) ? val : [];
          if (field.min_items && items.length < field.min_items) {
            const m = `${field.label || field.name}: at least ${field.min_items} required`;
            if (errEl) errEl.textContent = m;
            errors.push({ field: field.name, message: m });
          }
          for (let i = 0; i < items.length; i++) {
            for (const sub of field.item_fields || []) {
              if (sub.required) {
                const v = items[i][sub.name];
                if (v === undefined || v === null || v === "") {
                  errors.push({ field: `${field.name}[${i}].${sub.name}`, message: `${sub.label || sub.name} required` });
                }
              }
            }
          }
          continue;
        }

        if (field.type === "condition_group") {
          const items = (val && Array.isArray(val.items)) ? val.items : [];
          if (field.min_items && items.length < field.min_items) {
            const m = `${field.label || field.name}: at least ${field.min_items} required`;
            if (errEl) errEl.textContent = m;
            errors.push({ field: field.name, message: m });
          }
          for (let i = 0; i < items.length; i++) {
            for (const sub of field.item_fields || []) {
              if (sub.required) {
                const v = items[i][sub.name];
                if (v === undefined || v === null || v === "") {
                  errors.push({ field: `${field.name}.items[${i}].${sub.name}`, message: `${sub.label || sub.name} required` });
                }
              }
            }
          }
          continue;
        }

        if (field.required && (val === undefined || val === null || val === "")) {
          const m = `${field.label || field.name} is required`;
          if (errEl) errEl.textContent = m;
          errors.push({ field: field.name, message: m });
        }
        if (field.type === "json" && typeof val === "string" && val.trim()) {
          try { JSON.parse(val); } catch (e) {
            const m = `${field.label || field.name}: invalid JSON`;
            if (errEl) errEl.textContent = m;
            errors.push({ field: field.name, message: m });
          }
        }
      }
      return { valid: errors.length === 0, errors };
    },
  };
}

function applyDefaults(fields, state) {
  for (const f of fields) {
    if (f.type === "info" || f.type === "divider") continue;
    if (state[f.name] === undefined && "default" in f) {
      state[f.name] = deepClone(f.default);
    }
    if (f.type === "repeater" && !Array.isArray(state[f.name])) {
      state[f.name] = [];
    }
    if (f.type === "condition_group" && (typeof state[f.name] !== "object" || state[f.name] === null || Array.isArray(state[f.name]))) {
      // Back-compat: previously stored as plain array
      const items = Array.isArray(state[f.name]) ? state[f.name] : [];
      state[f.name] = { match: f.default_match || "all", items };
    }
    if (f.type === "http_kv" && !Array.isArray(state[f.name])) {
      state[f.name] = [];
    }
  }
}

function isVisible(field, state) {
  if (!field.visible_if) return true;
  const { field: depField, equals, in: inList } = field.visible_if;
  const v = state[depField];
  if (Array.isArray(inList)) return inList.includes(v);
  return v === equals;
}

function renderFieldWrap(field, ctx, onChange) {
  const wrap = document.createElement("div");
  wrap.className = `wfb-field wfb-field--${field.type}`;
  const id = `wfb_f_${field.name}_${uid("i")}`;

  if (field.type === "info") {
    const p = document.createElement("div");
    p.className = "wfb-info";
    p.textContent = field.text || "";
    wrap.appendChild(p);
    return wrap;
  }
  if (field.type === "divider") {
    const d = document.createElement("div");
    d.className = "wfb-divider";
    d.innerHTML = `<span>${escapeHtml(field.label || "")}</span>`;
    wrap.appendChild(d);
    return wrap;
  }

  if (field.type !== "hidden") {
    const label = document.createElement("label");
    label.className = "wfb-field__label";
    label.htmlFor = id;
    label.textContent = field.label || field.name;
    if (field.required) {
      const req = document.createElement("span");
      req.className = "wfb-field__required";
      req.textContent = " *";
      label.appendChild(req);
    }
    wrap.appendChild(label);
  }

  const input = renderInput(field, ctx.state[field.name], (v) => {
    ctx.state[field.name] = v;
    onChange(field.name);  // pass which field changed so rerenderVisibility can be targeted
  }, ctx);
  if (input.tagName !== "DIV" && input.tagName !== "LABEL") input.id = id;
  wrap.appendChild(input);

  const err = document.createElement("div");
  err.className = "wfb-field__error";
  wrap.appendChild(err);

  return wrap;
}

function renderInput(field, value, onChange, ctx) {
  switch (field.type) {
    case "textarea": {
      const ta = document.createElement("textarea");
      ta.className = "wfb-input wfb-input--textarea";
      ta.value = value ?? "";
      ta.placeholder = field.placeholder || "";
      ta.rows = field.rows || 4;
      ta.addEventListener("input", () => onChange(ta.value));
      return ta;
    }
    case "number": {
      const i = document.createElement("input");
      i.type = "number";
      i.className = "wfb-input";
      i.value = value ?? "";
      if (field.min !== undefined) i.min = field.min;
      if (field.max !== undefined) i.max = field.max;
      i.addEventListener("input", () => onChange(i.value === "" ? "" : Number(i.value)));
      return i;
    }
    case "select": {
      const s = document.createElement("select");
      s.className = "wfb-input";

      const setStaticOptions = (opts) => {
        s.innerHTML = "";
        for (const opt of opts || []) {
          const o = document.createElement("option");
          o.value = opt.value;
          o.textContent = opt.label;
          if (opt.type) o.dataset.type = opt.type;
          s.appendChild(o);
        }
      };

      if (field.options_source) {
        const provider = ctx?.formCtx?.dataProvider;
        // Placeholder option while loading
        s.innerHTML = `<option value="">Loading…</option>`;
        s.disabled = true;
        s._wfbReload = async () => {
          // Guard: skip if a reload is already in flight (prevents amplification
          // when rerenderVisibility triggers multiple concurrent reloads).
          if (s._wfbLoading) return;
          s._wfbLoading = true;
          try {
            const deps = {};
            if (Array.isArray(field.depends_on)) {
              for (const d of field.depends_on) deps[d] = ctx?.state?.[d];
            }
            const opts = provider
              ? await provider(field.options_source, { depends: deps })
              : [];
            const prev = s.value || value || "";
            s.disabled = false;
            s.innerHTML = "";
            if (field.allow_empty !== false) {
              const empty = document.createElement("option");
              empty.value = ""; empty.textContent = field.placeholder || "Select…";
              s.appendChild(empty);
            }
            for (const opt of opts) {
              const o = document.createElement("option");
              o.value = opt.value; o.textContent = opt.label;
              if (opt.type) o.dataset.type = opt.type;
              s.appendChild(o);
            }
            if (prev && Array.from(s.options).some((o) => o.value === prev)) {
              if (s.value !== prev) s.value = prev;
            } else if (s.options.length) {
              const first = s.options[0].value;
              s.value = first;
              // Only fire onChange when the value genuinely changes so we don't
              // trigger redundant rerenderVisibility calls.
              if (ctx.state[field.name] !== first) {
                onChange(first);
              }
            }
          } finally {
            s._wfbLoading = false;
          }
        };
        // Kick off initial load
        Promise.resolve().then(() => s._wfbReload());
      } else {
        setStaticOptions(field.options);
        if (value !== undefined && value !== null) s.value = value;
      }

      s.addEventListener("change", () => onChange(s.value));
      if (!field.options_source && value === undefined && s.options.length) onChange(s.value);
      return s;
    }
    case "toggle":
    case "checkbox": {
      const w = document.createElement("label");
      w.className = "wfb-input wfb-input--toggle";
      const i = document.createElement("input");
      i.type = "checkbox";
      i.checked = !!value;
      i.addEventListener("change", () => onChange(i.checked));
      w.appendChild(i);
      const span = document.createElement("span");
      span.textContent = field.text || "";
      w.appendChild(span);
      return w;
    }
    case "radio": {
      const w = document.createElement("div");
      w.className = "wfb-input wfb-input--radio";
      for (const opt of field.options || []) {
        const l = document.createElement("label");
        const r = document.createElement("input");
        r.type = "radio";
        r.name = field.name;
        r.value = opt.value;
        r.checked = value === opt.value;
        r.addEventListener("change", () => onChange(opt.value));
        l.appendChild(r);
        l.appendChild(document.createTextNode(" " + opt.label));
        w.appendChild(l);
      }
      return w;
    }
    case "json": {
      const ta = document.createElement("textarea");
      ta.className = "wfb-input wfb-input--textarea wfb-input--mono";
      ta.value = value ? (typeof value === "string" ? value : JSON.stringify(value, null, 2)) : "";
      ta.placeholder = field.placeholder || "{ }";
      ta.rows = field.rows || 5;
      ta.addEventListener("input", () => {
        const v = ta.value;
        try {
          onChange(v.trim() ? JSON.parse(v) : null);
          ta.classList.remove("wfb-input--invalid");
        } catch {
          ta.classList.add("wfb-input--invalid");
          onChange(v);
        }
      });
      return ta;
    }
    case "hidden": {
      const i = document.createElement("input");
      i.type = "hidden";
      i.value = value ?? "";
      return i;
    }
    case "repeater": {
      return renderRepeater(field, Array.isArray(value) ? value : [], onChange, ctx);
    }
    case "condition_group": {
      return renderConditionGroup(field, value, onChange, ctx);
    }
    case "email_template": {
      return renderEmailTemplateField(field, value, onChange, ctx);
    }
    case "http_kv": {
      return renderHttpKvField(field, Array.isArray(value) ? value : [], onChange);
    }
    case "text":
    default: {
      const i = document.createElement("input");
      i.type = "text";
      i.className = "wfb-input";
      i.value = value ?? "";
      i.placeholder = field.placeholder || "";
      i.addEventListener("input", () => onChange(i.value));
      return i;
    }
  }
}

function renderRepeater(field, items, onChange, ctx) {
  const wrap = document.createElement("div");
  wrap.className = "wfb-repeater";

  function rerender(currentItems) {
    wrap.innerHTML = "";
    currentItems.forEach((item, idx) => {
      const card = document.createElement("div");
      card.className = "wfb-repeater__item";
      const head = document.createElement("div");
      head.className = "wfb-repeater__head";
      head.innerHTML = `<strong>${escapeHtml(field.item_label || "Item")} #${idx + 1}</strong>`;
      const removeBtn = document.createElement("button");
      removeBtn.type = "button";
      removeBtn.className = "wfb-iconbtn";
      removeBtn.title = "Remove";
      removeBtn.innerHTML = icon("trash", { size: 14 });
      removeBtn.addEventListener("click", () => {
        currentItems.splice(idx, 1);
        onChange([...currentItems]);
        rerender(currentItems);
      });
      head.appendChild(removeBtn);
      card.appendChild(head);

      const subSchema = { fields: field.item_fields || [] };
      const sub = renderForm(subSchema, item, ctx?.formCtx);
      const sync = () => {
        currentItems[idx] = sub.getValues();
        onChange([...currentItems]);
      };
      sub.element.addEventListener("input", sync);
      sub.element.addEventListener("change", sync);
      card.appendChild(sub.element);
      wrap.appendChild(card);
    });

    const addBtn = document.createElement("button");
    addBtn.type = "button";
    addBtn.className = "wfb-btn wfb-btn--ghost wfb-repeater__add";
    addBtn.innerHTML = `${icon("plus", { size: 12 })} ${escapeHtml(field.add_label || "Add")}`;
    if (field.max_items && currentItems.length >= field.max_items) addBtn.disabled = true;
    addBtn.addEventListener("click", () => {
      currentItems.push({});
      onChange([...currentItems]);
      rerender(currentItems);
    });
    wrap.appendChild(addBtn);
  }

  rerender(items);
  return wrap;
}

function escapeHtml(s) {
  return String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
}

/**
 * condition_group: a repeater of conditions with a "match all / any" selector.
 * Value shape: { match: "all"|"any", items: [{field, operator, value}, ...] }
 */
function renderConditionGroup(field, value, onChange, ctx) {
  const wrap = document.createElement("div");
  wrap.className = "wfb-condgroup";

  const v = (value && typeof value === "object" && !Array.isArray(value))
    ? value
    : { match: field.default_match || "all", items: Array.isArray(value) ? value : [] };

  const matchBar = document.createElement("div");
  matchBar.className = "wfb-condgroup__match";
  matchBar.innerHTML = `
    <label class="wfb-field__label">Match</label>
    <select class="wfb-input">
      <option value="all">All conditions are met</option>
      <option value="any">Any condition is met</option>
    </select>
  `;
  const matchSel = matchBar.querySelector("select");
  matchSel.value = v.match === "any" ? "any" : "all";
  matchSel.addEventListener("change", () => {
    v.match = matchSel.value;
    onChange({ ...v, items: [...v.items] });
  });
  wrap.appendChild(matchBar);

  const repHost = document.createElement("div");
  wrap.appendChild(repHost);

  const rep = renderRepeater(
    {
      type: "repeater",
      name: field.name + "__items",
      add_label: field.add_label || "Add condition",
      item_label: field.item_label || "Condition",
      item_fields: field.item_fields,
    },
    v.items,
    (items) => {
      v.items = items;
      onChange({ match: v.match, items });
    },
    ctx
  );
  repHost.appendChild(rep);

  return wrap;
}

/**
 * email_template: opens a full-screen template builder.
 * Value shape: { subject, preheader, from_name, from_email, reply_to, html, text }
 */
function renderEmailTemplateField(field, value, onChange, ctx) {
  const wrap = document.createElement("div");
  wrap.className = "wfb-email-tpl-field";

  const state = {
    subject: "", preheader: "", from_name: "", from_email: "", reply_to: "",
    html: "", text: "",
    ...(value && typeof value === "object" ? value : {}),
  };

  const summary = document.createElement("div");
  summary.className = "wfb-email-tpl-field__summary";
  const refresh = () => {
    const subj = state.subject || "(no subject)";
    const hasHtml = !!(state.html && state.html.trim());
    const hasText = !!(state.text && state.text.trim());
    summary.innerHTML = `
      <div class="wfb-email-tpl-field__subject"><strong>Subject:</strong> ${escapeHtml(subj)}</div>
      <div class="wfb-email-tpl-field__meta">
        <span class="wfb-tag">${hasHtml ? "HTML ✓" : "HTML —"}</span>
        <span class="wfb-tag">${hasText ? "Plain text ✓" : "Plain text —"}</span>
      </div>
    `;
  };
  refresh();
  wrap.appendChild(summary);

  const btn = document.createElement("button");
  btn.type = "button";
  btn.className = "wfb-btn wfb-btn--primary wfb-email-tpl-field__open";
  btn.textContent = state.html || state.text ? "Edit email template" : "Open email template builder";
  btn.addEventListener("click", () => {
    const open = ctx?.formCtx?.openModule;
    if (typeof open !== "function") {
      alert("Email template builder is not available.");
      return;
    }
    open("email_template", {
      value: { ...state },
      onSave: (next) => {
        Object.assign(state, next);
        onChange({ ...state });
        refresh();
        btn.textContent = "Edit email template";
      },
    });
  });
  wrap.appendChild(btn);

  return wrap;
}

/**
 * http_kv: simple key/value list for query/headers.
 */
function renderHttpKvField(field, items, onChange) {
  const wrap = document.createElement("div");
  wrap.className = "wfb-http-kv";

  function rerender(curr) {
    wrap.innerHTML = "";
    curr.forEach((row, idx) => {
      const line = document.createElement("div");
      line.className = "wfb-http-kv__row";
      line.innerHTML = `
        <input class="wfb-input wfb-http-kv__key"   placeholder="key"   value="${escapeHtml(row.key || "")}" />
        <input class="wfb-input wfb-http-kv__value" placeholder="value" value="${escapeHtml(row.value || "")}" />
        <button type="button" class="wfb-iconbtn" title="Remove">${icon("trash", { size: 14 })}</button>
      `;
      const [kEl, vEl, rmEl] = line.querySelectorAll(".wfb-http-kv__key, .wfb-http-kv__value, .wfb-iconbtn");
      kEl.addEventListener("input", () => { curr[idx].key = kEl.value; onChange([...curr]); });
      vEl.addEventListener("input", () => { curr[idx].value = vEl.value; onChange([...curr]); });
      rmEl.addEventListener("click", () => { curr.splice(idx, 1); onChange([...curr]); rerender(curr); });
      wrap.appendChild(line);
    });
    const addBtn = document.createElement("button");
    addBtn.type = "button";
    addBtn.className = "wfb-btn wfb-btn--ghost wfb-repeater__add";
    addBtn.innerHTML = `${icon("plus", { size: 12 })} ${escapeHtml(field.add_label || "Add row")}`;
    addBtn.addEventListener("click", () => {
      curr.push({ key: "", value: "" });
      onChange([...curr]);
      rerender(curr);
    });
    wrap.appendChild(addBtn);
  }
  rerender(items);
  return wrap;
}
