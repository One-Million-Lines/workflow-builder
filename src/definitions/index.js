/**
 * Bundled default definitions.
 *
 * The builder normally loads registry definitions by fetching JSON URLs at
 * runtime. That requires the consumer to host the `definitions/` folder. For
 * npm consumers we ship the same definitions inlined as JavaScript objects so
 * the builder works out of the box with zero hosting.
 *
 * `defaultDefinitions` can be passed straight to `new WorkflowBuilder({ registries })`,
 * and it is also used automatically when no `registries` option is provided.
 */
import stepsDoc from "../../definitions/steps.json";
import triggersDoc from "../../definitions/triggers.json";
import actionsDoc from "../../definitions/actions.json";

import conditionsSchema from "../../definitions/schemas/_conditions.schema.json";
import actionSchema from "../../definitions/schemas/action.schema.json";
import conditionSchema from "../../definitions/schemas/condition.schema.json";
import delaySchema from "../../definitions/schemas/delay.schema.json";
import emailSchema from "../../definitions/schemas/email.schema.json";
import httpRequestSchema from "../../definitions/schemas/http_request.schema.json";
import smsSchema from "../../definitions/schemas/sms.schema.json";
import webpushSchema from "../../definitions/schemas/webpush.schema.json";
import whatsappSchema from "../../definitions/schemas/whatsapp.schema.json";
import triggerApiRequestSchema from "../../definitions/schemas/trigger_api_request.schema.json";
import triggerBackInStockSchema from "../../definitions/schemas/trigger_back_in_stock.schema.json";
import triggerPriceChangeSchema from "../../definitions/schemas/trigger_price_change.schema.json";
import triggerUserEventsSchema from "../../definitions/schemas/trigger_user_events.schema.json";
import triggerUserSegmentSchema from "../../definitions/schemas/trigger_user_segment.schema.json";

const SCHEMA_BY_PATH = {
  "schemas/_conditions.schema.json": conditionsSchema,
  "schemas/action.schema.json": actionSchema,
  "schemas/condition.schema.json": conditionSchema,
  "schemas/delay.schema.json": delaySchema,
  "schemas/email.schema.json": emailSchema,
  "schemas/http_request.schema.json": httpRequestSchema,
  "schemas/sms.schema.json": smsSchema,
  "schemas/webpush.schema.json": webpushSchema,
  "schemas/whatsapp.schema.json": whatsappSchema,
  "schemas/trigger_api_request.schema.json": triggerApiRequestSchema,
  "schemas/trigger_back_in_stock.schema.json": triggerBackInStockSchema,
  "schemas/trigger_price_change.schema.json": triggerPriceChangeSchema,
  "schemas/trigger_user_events.schema.json": triggerUserEventsSchema,
  "schemas/trigger_user_segment.schema.json": triggerUserSegmentSchema,
};

function inlineSchemas(items) {
  return items.map((item) => {
    if (item.config_schema && SCHEMA_BY_PATH[item.config_schema]) {
      const { config_schema, ...rest } = item;
      return { ...rest, schema: SCHEMA_BY_PATH[item.config_schema] };
    }
    return item;
  });
}

export const defaultDefinitions = {
  steps: {
    steps: inlineSchemas(stepsDoc.steps),
    _conditionsSchema: conditionsSchema,
  },
  triggers: { triggers: inlineSchemas(triggersDoc.triggers) },
  actions: actionsDoc,
};

export { conditionsSchema as defaultConditionsSchema };
