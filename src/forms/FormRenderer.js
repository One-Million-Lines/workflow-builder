import { deepClone, uid } from "../core/utils.js";
import { icon } from "../ui/Icon.js";

/**
 * Render a JSON-schema-like form into the given container.
 *
 * Supported field types:
 *   text, textarea, number, select, toggle, checkbox, radio, hidden,
 *   info, divider, json, repeater, condition_group, email_template, http_kv,
 *   combobox, action_button
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
      const sel = w?.querySelector("select.wfb-input, .wfb-combobox");
      if (sel && typeof sel._wfbReload === "function") sel._wfbReload();
    }
    // Also reload selects nested inside repeater sub-forms that depend on the changed field.
    // These selects carry a data-wfb-depends-on attribute set during rendering.
    if (changedField !== null) {
      for (const field of schemaRef.fields) {
        if (field.type !== "repeater") continue;
        const w = ctxRef.fieldEls.get(field.name);
        if (!w) continue;
        const nested = w.querySelectorAll(`select.wfb-input[data-wfb-depends-on], .wfb-combobox[data-wfb-depends-on]`);
        for (const sel of nested) {
          const deps = (sel.dataset.wfbDependsOn || "").split(",");
          if (deps.includes(changedField) && typeof sel._wfbReload === "function") {
            sel._wfbReload();
          }
        }
      }
    }
    // Update action_button disabled state based on requires_field option.
    for (const field of schemaRef.fields) {
      if (field.type !== "action_button" || !field.requires_field) continue;
      const w = ctxRef.fieldEls.get(field.name);
      const btn = w?.querySelector("button.wfb-btn--action");
      if (btn) btn.disabled = !ctxRef.state[field.requires_field];
    }
  }
  rerenderVisibility(schema, ctx, null);

  return {
    element: container,
    getValues() {
      const out = {};
      for (const field of schema.fields) {
        if (field.type === "info" || field.type === "divider" || field.type === "action_button") continue;
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
        if (field.type === "info" || field.type === "divider" || field.type === "action_button") continue;
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
    if (f.type === "info" || f.type === "divider" || f.type === "action_button") continue;
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
  if (Array.isArray(field.visible_if.all)) {
    return field.visible_if.all.every((rule) => isVisible({ visible_if: rule }, state));
  }
  if (Array.isArray(field.visible_if.any)) {
    return field.visible_if.any.some((rule) => isVisible({ visible_if: rule }, state));
  }

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
  if (field.type === "action_button") {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "wfb-btn wfb-btn--action";
    btn.textContent = field.label || "Run";
    // Disable immediately if the required field is empty
    if (field.requires_field) btn.disabled = !ctx?.state?.[field.requires_field];
    const result = document.createElement("div");
    result.className = "wfb-action-btn-result";
    btn.addEventListener("click", async () => {
      const action = ctx?.formCtx?.actions?.[field.action];
      if (!action) return;
      btn.disabled = true;
      result.textContent = "…";
      result.className = "wfb-action-btn-result";
      try {
        const res = await action(deepClone(ctx.state));
        result.textContent = typeof res === "object" ? JSON.stringify(res) : String(res ?? "");
        result.className = "wfb-action-btn-result wfb-action-btn-result--ok";
      } catch {
        result.textContent = "Error";
        result.className = "wfb-action-btn-result wfb-action-btn-result--err";
      } finally {
        // Re-evaluate disabled state after action completes
        if (field.requires_field) btn.disabled = !ctx?.state?.[field.requires_field];
        else btn.disabled = false;
      }
    });
    wrap.appendChild(btn);
    wrap.appendChild(result);
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
        // Tag for nested-form dependency reload
        if (Array.isArray(field.depends_on) && field.depends_on.length > 0) {
          s.dataset.wfbDependsOn = field.depends_on.join(",");
        }
        s._wfbReload = async () => {
          // Guard: skip if a reload is already in flight (prevents amplification
          // when rerenderVisibility triggers multiple concurrent reloads).
          if (s._wfbLoading) return;
          s._wfbLoading = true;
          try {
            const deps = {};
            if (Array.isArray(field.depends_on)) {
              for (const d of field.depends_on) {
                // Resolve from own state first, then from parent state (nested repeaters)
                deps[d] = ctx?.state?.[d] ?? ctx?.formCtx?.parentState?.[d];
              }
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
    case "combobox": {
      // Live-search field: filters pre-loaded options client-side;
      // calls dataProvider(field.search_source, { depends: { query } }) when available.
      const wrap = document.createElement("div");
      wrap.className = "wfb-combobox";
      if (Array.isArray(field.depends_on) && field.depends_on.length > 0) {
        wrap.dataset.wfbDependsOn = field.depends_on.join(",");
      }

      const input = document.createElement("input");
      input.type = "text";
      input.className = "wfb-input";
      input.placeholder = field.placeholder || "Search…";
      input.setAttribute("autocomplete", "off");

      const dropdown = document.createElement("div");
      dropdown.className = "wfb-combobox__dropdown";
      dropdown.style.display = "none";

      // Selection badge shown below the input
      const selDisplay = document.createElement("div");
      selDisplay.className = "wfb-combobox__selected";
      selDisplay.style.display = "none";

      let allOptions = [];
      let selectedValue = value ?? "";
      // Pre-seed label from companion field if already stored
      let selectedLabel = (field.companion_name && ctx?.state?.[field.companion_name]) || "";
      let searchTimer = null;

      const updateSelDisplay = () => {
        if (selectedValue && selectedLabel) {
          selDisplay.style.display = "";
          selDisplay.innerHTML = `<span class="wfb-combobox__sel-icon">✓</span>
            <span class="wfb-combobox__sel-text">${escapeHtml(selectedLabel)}</span>
            <span class="wfb-combobox__sel-id">#${escapeHtml(String(selectedValue))}</span>`;
        } else {
          selDisplay.style.display = "none";
        }
      };
      updateSelDisplay();

      const renderDropdown = (opts) => {
        dropdown.innerHTML = "";
        const limited = opts.slice(0, 15);
        if (!limited.length) { dropdown.style.display = "none"; return; }
        for (const opt of limited) {
          const item = document.createElement("div");
          item.className = "wfb-combobox__item" + (opt.value === selectedValue ? " wfb-combobox__item--selected" : "");
          item.textContent = opt.label;
          item.addEventListener("mousedown", (e) => {
            e.preventDefault();
            selectedValue = opt.value;
            selectedLabel = opt.label;
            input.value = "";
            input.placeholder = field.placeholder || "Search…";
            dropdown.style.display = "none";
            onChange(opt.value);
            // Store companion label
            if (field.companion_name && ctx?.state) ctx.state[field.companion_name] = opt.label;
            updateSelDisplay();
            // Bubble a change event so parent form's autoCommit fires
            input.dispatchEvent(new Event("change", { bubbles: true }));
          });
          dropdown.appendChild(item);
        }
        dropdown.style.display = "";
      };

      const filterLocal = (q) => {
        const lq = q.toLowerCase().trim();
        return lq
          ? allOptions.filter((o) => o.label.toLowerCase().includes(lq) || String(o.value).toLowerCase().includes(lq))
          : allOptions;
      };

      const provider = ctx?.formCtx?.dataProvider;
      wrap._wfbReload = async () => {
        if (!provider) return;
        allOptions = (await provider(field.options_source || "segments").catch(() => [])) || [];
        const found = selectedValue ? allOptions.find((o) => o.value === selectedValue) : null;
        if (found) {
          selectedLabel = found.label;
          if (field.companion_name && ctx?.state) ctx.state[field.companion_name] = found.label;
          updateSelDisplay();
        }
      };
      Promise.resolve().then(() => wrap._wfbReload());

      input.addEventListener("focus", () => renderDropdown(filterLocal(input.value)));
      input.addEventListener("input", () => {
        const q = input.value;
        clearTimeout(searchTimer);
        searchTimer = setTimeout(async () => {
          if (field.search_source && provider) {
            try {
              const live = await provider(field.search_source, { depends: { query: q } });
              if (live && live.length > 0) { renderDropdown(live); return; }
            } catch { /* fall through to local */ }
          }
          renderDropdown(filterLocal(q));
        }, 200);
      });
      input.addEventListener("blur", () => {
        setTimeout(() => {
          dropdown.style.display = "none";
          input.value = ""; // always clear so it stays a search field
        }, 150);
      });

      wrap.appendChild(input);
      wrap.appendChild(dropdown);
      wrap.appendChild(selDisplay);
      return wrap;
    }
    case "cron": {
      return renderCronField(field, value, onChange);
    }
    case "text":
    default: {
      const i = document.createElement("input");
      i.type = field.input_type || "text";
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
      // Merge own state into parentState so nested repeaters can resolve depends_on fields
      // that live in ancestor form items (e.g., `event` field in trigger event conditions).
      const subCtx = {
        ...(ctx?.formCtx || {}),
        parentState: { ...(ctx?.formCtx?.parentState || {}), ...ctx.state },
      };
      const sub = renderForm(subSchema, item, subCtx);
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

// ── Cron helpers ────────────────────────────────────────────────────────────

function parseCron(val) {
  const defaults = { freq: "daily", hour: 9, minute: 0, weekday: 1, monthday: 1 };
  if (!val || typeof val !== "string") return defaults;
  const parts = val.trim().split(/\s+/);
  if (parts.length !== 5) return defaults;
  const [min, hr, dom, _mon, dow] = parts;
  const hour = parseInt(hr, 10);
  const minute = parseInt(min, 10);
  if (isNaN(hour) || isNaN(minute)) return defaults;
  if (dom !== "*") return { freq: "monthly", hour, minute, weekday: 1, monthday: Math.max(1, parseInt(dom, 10) || 1) };
  if (dow !== "*") return { freq: "weekly",  hour, minute, weekday: parseInt(dow, 10) ?? 1, monthday: 1 };
  return { freq: "daily", hour, minute, weekday: 1, monthday: 1 };
}

function renderCronField(field, value, onChange) {
  const wrap = document.createElement("div");
  wrap.className = "wfb-cron";

  const p = parseCron(value);
  let freq     = p.freq;
  let hour     = p.hour;
  let minute   = [0, 15, 30, 45].includes(p.minute) ? p.minute : 0;
  let weekday  = p.weekday;
  let monthday = p.monthday;

  const toCronStr = () => {
    if (freq === "weekly")  return `${minute} ${hour} * * ${weekday}`;
    if (freq === "monthly") return `${minute} ${hour} ${monthday} * *`;
    return `${minute} ${hour} * * *`;
  };

  const preview = document.createElement("code");
  preview.className = "wfb-cron__preview";

  const updatePreview = () => {
    preview.textContent = toCronStr();
  };

  const renderRow = () => {
    wrap.innerHTML = "";
    const row = document.createElement("div");
    row.className = "wfb-cron__row";

    const sel = (opts, cur, onCh) => {
      const s = document.createElement("select");
      s.className = "wfb-input wfb-cron__sel";
      opts.forEach(([v, l]) => {
        const o = document.createElement("option");
        o.value = v; o.textContent = l; s.appendChild(o);
      });
      s.value = String(cur);
      s.addEventListener("change", () => { onCh(s.value); updatePreview(); onChange(toCronStr()); });
      return s;
    };

    const lbl = (t) => {
      const sp = document.createElement("span");
      sp.className = "wfb-cron__label"; sp.textContent = t; return sp;
    };

    row.appendChild(lbl("Every"));
    row.appendChild(sel([["daily","day"],["weekly","week"],["monthly","month"]], freq, (v) => {
      freq = v; renderRow();
    }));

    if (freq === "weekly") {
      row.appendChild(lbl("on"));
      row.appendChild(sel([["1","Mon"],["2","Tue"],["3","Wed"],["4","Thu"],["5","Fri"],["6","Sat"],["0","Sun"]],
        weekday, (v) => { weekday = Number(v); }));
    }
    if (freq === "monthly") {
      row.appendChild(lbl("on day"));
      row.appendChild(sel(Array.from({length: 28}, (_, i) => [String(i+1), String(i+1)]),
        monthday, (v) => { monthday = Number(v); }));
    }

    row.appendChild(lbl("at"));
    row.appendChild(sel(Array.from({length: 24}, (_, i) => [String(i), String(i).padStart(2,"0")]),
      hour, (v) => { hour = Number(v); }));
    row.appendChild(lbl(":"));
    row.appendChild(sel([["0","00"],["15","15"],["30","30"],["45","45"]], minute, (v) => { minute = Number(v); }));

    wrap.appendChild(row);
    wrap.appendChild(preview);
    updatePreview();
  };

  renderRow();
  return wrap;
}
