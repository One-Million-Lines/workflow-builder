/**
 * MockBackend - simulates async server lookups used by form dropdowns.
 *
 * All methods return Promises that resolve with arrays of { label, value, ...meta }
 * shaped for the `select` field's `options` consumer.
 *
 * Replace the body of any method (or pass a `dataProvider` into WorkflowBuilder)
 * to wire real endpoints. The contract per source is:
 *
 *   attributes()           -> [{ value, label, type }]
 *   lists()                -> [{ value, label }]
 *   list_statuses(list_id) -> [{ value, label }]
 *   segments()             -> [{ value, label }]
 *   events()               -> [{ value, label, fields:[{name,type}] }]
 *   event_fields(event)    -> [{ value, label, type }]
 */
const DELAY = 180;
const wait = (data) => new Promise((res) => setTimeout(() => res(data), DELAY));

const ATTRIBUTES = [
  { value: "first_name", label: "First name", type: "string" },
  { value: "last_name",  label: "Last name",  type: "string" },
  { value: "email",      label: "Email",      type: "string" },
  { value: "phone",      label: "Phone",      type: "string" },
  { value: "country",    label: "Country",    type: "string" },
  { value: "city",       label: "City",       type: "string" },
  { value: "age",        label: "Age",        type: "number" },
  { value: "lifetime_value", label: "Lifetime value", type: "number" },
  { value: "bio",        label: "Bio",        type: "text" },
  { value: "birthday",   label: "Birthday",   type: "date" },
  { value: "last_seen_at", label: "Last seen at", type: "date" },
];

const LISTS = [
  { value: "list_main",    label: "Main subscribers" },
  { value: "list_vip",     label: "VIP customers" },
  { value: "list_newsletter", label: "Weekly newsletter" },
  { value: "list_promo",   label: "Promo blasts" },
];

const STATUSES_DEFAULT = [
  { value: "subscribed",   label: "Subscribed" },
  { value: "unsubscribed", label: "Unsubscribed" },
  { value: "pending",      label: "Pending confirmation" },
  { value: "spam",         label: "Spam" },
  { value: "bounced",      label: "Bounced" },
];

const SEGMENTS = [
  { value: "seg_new_subscribers", label: "New subscribers" },
  { value: "seg_vip",             label: "VIP customers" },
  { value: "seg_inactive_30d",    label: "Inactive 30 days" },
  { value: "seg_cart_abandoned",  label: "Cart abandoned" },
  { value: "seg_high_ltv",        label: "High LTV" },
];

const EVENTS = [
  {
    value: "page_view", label: "Page view",
    fields: [
      { name: "url",       type: "string" },
      { name: "referrer",  type: "string" },
      { name: "duration",  type: "number" },
    ],
  },
  {
    value: "product_view", label: "Product view",
    fields: [
      { name: "product_id",   type: "string" },
      { name: "product_name", type: "string" },
      { name: "price",        type: "number" },
      { name: "category",     type: "string" },
    ],
  },
  {
    value: "add_to_cart", label: "Add to cart",
    fields: [
      { name: "product_id", type: "string" },
      { name: "quantity",   type: "number" },
      { name: "price",      type: "number" },
    ],
  },
  {
    value: "purchase", label: "Purchase",
    fields: [
      { name: "order_id",    type: "string" },
      { name: "total",       type: "number" },
      { name: "items_count", type: "number" },
      { name: "currency",    type: "string" },
    ],
  },
  {
    value: "newsletter_signup", label: "Newsletter signup",
    fields: [
      { name: "source", type: "string" },
    ],
  },
];

export class MockBackend {
  attributes() { return wait([...ATTRIBUTES]); }
  lists()      { return wait([...LISTS]); }
  list_statuses(/* list_id */) { return wait([...STATUSES_DEFAULT]); }
  segments()   { return wait([...SEGMENTS]); }
  events()     { return wait(EVENTS.map(({ fields, ...e }) => e)); }
  event_fields(event) {
    const ev = EVENTS.find((e) => e.value === event);
    return wait(ev ? ev.fields.map((f) => ({ value: f.name, label: f.name, type: f.type })) : []);
  }
}

/**
 * Default dataProvider used by WorkflowBuilder if none is passed.
 * Signature: (source, context) -> Promise<option[]>
 *   source  : "attributes" | "lists" | "list_statuses" | "segments" | "events" | "event_fields"
 *   context : { depends?: { [fieldName]: value } }
 */
export function createDefaultDataProvider() {
  const api = new MockBackend();
  return (source, context = {}) => {
    const deps = context.depends || {};
    switch (source) {
      case "attributes":    return api.attributes();
      case "lists":         return api.lists();
      case "list_statuses": return api.list_statuses(deps.list_id);
      case "segments":      return api.segments();
      case "events":        return api.events();
      case "event_fields":  return api.event_fields(deps.event);
      default:              return Promise.resolve([]);
    }
  };
}
