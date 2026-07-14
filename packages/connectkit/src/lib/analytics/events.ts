export const WALLET_EVENTS = {
  WALLET_CONNECTED: "wallet_connected",
  WALLET_DISCONNECTED: "wallet_disconnected",
} as const;

export const PAYMENT_EVENTS = {
  PAYMENT_FLOW_STARTED: "payment_flow_started",
  PAYMENT_METHOD_SELECTED: "payment_method_selected",
  PAYMENT_QUOTE_REQUESTED: "payment_quote_requested",
  PAYMENT_QUOTE_RECEIVED: "payment_quote_received",
  PAYMENT_QUOTE_FAILED: "payment_quote_failed",
  PAYMENT_CONFIRMED: "payment_confirmed",
  PAYMENT_SUBMITTED: "payment_submitted",
  PAYMENT_COMPLETED: "payment_completed",
  PAYMENT_FAILED: "payment_failed",
  PAYMENT_VALIDATION_ERROR: "payment_validation_error",
  PAYMENT_CANCELLED: "payment_cancelled",
  PAYMENT_NO_TOKENS_AVAILABLE: "payment_no_tokens_available",
} as const;

export const GLOBAL_EVENTS = {
  USER_IDENTIFIED: "user_identified",
  USER_RESET: "user_reset",
  ERROR_OCCURRED: "error_occurred",
} as const;

export const ROZO_EVENTS = {
  ...GLOBAL_EVENTS,
  ...WALLET_EVENTS,
  ...PAYMENT_EVENTS,
} as const;

export type RozoEventName = (typeof ROZO_EVENTS)[keyof typeof ROZO_EVENTS];
