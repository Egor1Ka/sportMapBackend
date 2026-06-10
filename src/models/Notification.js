import mongoose from "mongoose";

const { Schema, model } = mongoose;

/** Тип получателя */
const RECIPIENT_TYPES = ["invitee", "staff"];

/** Канал доставки */
const CHANNELS = ["email", "sms", "telegram"];

/** Типы уведомлений */
const NOTIFICATION_TYPES = [
  "booking_confirmed",
  "booking_cancelled",
  "booking_rescheduled",
  "reminder_24h",
  "reminder_1h",
  "follow_up",
];

/** Статусы доставки */
const NOTIFICATION_STATUSES = ["scheduled", "sent", "failed", "skipped"];

const NotificationSchema = new Schema(
  {
    /**
     * Бронирование к которому относится уведомление.
     */
    bookingId: {
      type: Schema.Types.ObjectId,
      ref: "Booking",
      required: true,
    },

    /**
     * Получатель: Invitee или User (зависит от recipientType).
     */
    recipientId: { type: Schema.Types.ObjectId, required: true },

    /**
     * invitee | staff — в какой коллекции искать получателя.
     */
    recipientType: {
      type: String,
      enum: RECIPIENT_TYPES,
      required: true,
    },

    /**
     * Канал доставки: email | sms.
     */
    channel: { type: String, enum: CHANNELS, required: true },

    /**
     * booking_confirmed   — сразу после создания
     * booking_cancelled   — при отмене
     * booking_rescheduled — при переносе
     * reminder_24h        — за 24 часа
     * reminder_1h         — за 1 час
     * follow_up           — после встречи (запрос отзыва)
     */
    type: { type: String, enum: NOTIFICATION_TYPES, required: true },

    /**
     * scheduled → sent | failed | skipped
     */
    status: {
      type: String,
      enum: NOTIFICATION_STATUSES,
      default: "scheduled",
    },

    /**
     * Когда отправить.
     * Воркер ищет: status=scheduled AND scheduledAt <= now.
     */
    scheduledAt: { type: Date, required: true },

    /**
     * Счётчик попыток. При >= 3 → failed окончательно.
     */
    attempts: { type: Number, default: 0 },

    /**
     * ID в Resend/Twilio для трекинга доставки.
     */
    externalId: { type: String },
  },
  { timestamps: true },
);

/**
 * Partial index: только pending задачи.
 * Маленький даже при миллионах броней.
 */
NotificationSchema.index(
  { status: 1, scheduledAt: 1 },
  { partialFilterExpression: { status: "scheduled" } },
);

/**
 * Найти все уведомления брони (при отмене → skipped).
 */
NotificationSchema.index({ bookingId: 1 });

export default model("Notification", NotificationSchema);
