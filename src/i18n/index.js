/**
 * Minimal i18n engine for workflow-builder.
 *
 * Usage:
 *   import { createI18n } from "./i18n/index.js";
 *   const t = createI18n("de");          // built-in locale
 *   const t = createI18n({ … });         // fully custom locale object
 *   const t = createI18n("es", { … });   // built-in + partial overrides
 *   t("sidebar_save")                    // → "Guardar"
 *
 * Supported locale codes: "en" (default), "de", "es".
 */

import en from "./locales/en.js";
import de from "./locales/de.js";
import es from "./locales/es.js";

const LOCALES = { en, de, es };

/**
 * @param {string | Record<string,string>} locale
 *   A locale code ("en" | "de" | "es") or a fully custom messages object.
 * @param {Record<string,string>} [overrides]
 *   Optional partial overrides merged on top of the resolved locale.
 * @returns {(key: string) => string} Translation function `t(key)`.
 */
export function createI18n(locale = "en", overrides = {}) {
  let messages;
  if (typeof locale === "string") {
    messages = { ...(LOCALES[locale] ?? LOCALES.en), ...overrides };
  } else if (locale && typeof locale === "object") {
    // Fully custom locale object passed directly
    messages = { ...LOCALES.en, ...locale, ...overrides };
  } else {
    messages = { ...LOCALES.en, ...overrides };
  }
  return (key) => messages[key] ?? key;
}

/** Default English `t()` — used internally when no locale is configured. */
export const defaultT = createI18n("en");
