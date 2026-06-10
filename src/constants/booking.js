const PAYMENT_STATUS = {
  NONE: "none",
  PENDING: "pending",
  PAID: "paid",
  REFUNDED: "refunded",
  FAILED: "failed",
};

const PAYMENT_STATUSES = Object.values(PAYMENT_STATUS);

const SLOT_MODE = {
  FIXED: "fixed",
  OPTIMAL: "optimal",
  DYNAMIC: "dynamic",
};

const SLOT_MODES = Object.values(SLOT_MODE);

const NOTIFICATION_TYPE = {
  BOOKING_CONFIRMED: "booking_confirmed",
  BOOKING_CANCELLED: "booking_cancelled",
  BOOKING_RESCHEDULED: "booking_rescheduled",
  BOOKING_COMPLETED: "booking_completed",
  BOOKING_NO_SHOW: "booking_no_show",
  BOOKING_STATUS_CHANGED: "booking_status_changed",
  REMINDER_24H: "reminder_24h",
  REMINDER_1H: "reminder_1h",
  FOLLOW_UP: "follow_up",
};

const NOTIFICATION_STATUS = {
  SCHEDULED: "scheduled",
  SENT: "sent",
  FAILED: "failed",
  SKIPPED: "skipped",
};

const NOTIFICATION_CHANNEL = {
  EMAIL: "email",
  SMS: "sms",
  TELEGRAM: "telegram",
};

const MEMBERSHIP_STATUS = {
  ACTIVE: "active",
  INVITED: "invited",
  SUSPENDED: "suspended",
  LEFT: "left",
};

const HOST_ROLE = {
  LEAD: "lead",
  ASSISTANT: "assistant",
  OBSERVER: "observer",
};

export {
  PAYMENT_STATUS,
  PAYMENT_STATUSES,
  SLOT_MODE,
  SLOT_MODES,
  NOTIFICATION_TYPE,
  NOTIFICATION_STATUS,
  NOTIFICATION_CHANNEL,
  MEMBERSHIP_STATUS,
  HOST_ROLE,
};
