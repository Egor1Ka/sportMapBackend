import mongoose from "mongoose";

const { Schema, model } = mongoose;

/** Роли специалистов на встрече */
const HOST_ROLES = ["lead", "assistant", "observer"];

/** Статусы оплаты */
const PAYMENT_STATUSES = ["none", "pending", "paid", "refunded", "failed"];

/**
 * Специалист на встрече.
 */
const HostSchema = new Schema(
  {
    /** Специалист */
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true },

    /**
     * lead      — ведущий специалист
     * assistant — ассистент
     * observer  — наблюдатель (стажёр, куратор)
     */
    role: { type: String, enum: HOST_ROLES, default: "lead" },
  },
  { _id: false },
);

/**
 * Копия данных клиента на момент бронирования.
 * НИКОГДА не обновляется после создания.
 * Клиент может сменить email — исторические брони не ломаются.
 */
const InviteeSnapshotSchema = new Schema(
  {
    name: { type: String },
    email: { type: String },
    phone: { type: String },
  },
  { _id: false },
);

const BookingSchema = new Schema(
  {
    /**
     * Какая услуга забронирована.
     */
    eventTypeId: {
      type: Schema.Types.ObjectId,
      ref: "EventType",
      required: true,
    },

    /**
     * Специалисты на встрече. Bounded max 5.
     * Массив (не один hostId) — поддерживает парные сессии.
     */
    hosts: {
      type: [HostSchema],
      validate: {
        validator: (v) => v.length <= 5,
        message: "Maximum 5 hosts allowed",
      },
      required: true,
    },

    /**
     * Клиент.
     */
    inviteeId: {
      type: Schema.Types.ObjectId,
      ref: "Invitee",
      required: true,
    },

    /**
     * Организация. null = solo.
     */
    orgId: {
      type: Schema.Types.ObjectId,
      ref: "Organization",
      default: null,
    },

    /**
     * Где физически проходит встреча.
     * null = solo или онлайн.
     */
    locationId: {
      type: Schema.Types.ObjectId,
      ref: "Location",
      default: null,
    },

    /**
     * Начало встречи. ВСЕГДА UTC в базе.
     */
    startAt: { type: Date, required: true },

    /**
     * Конец встречи. ВСЕГДА UTC в базе.
     * endAt = startAt + durationMin из EventType.
     */
    endAt: { type: Date, required: true },

    /**
     * Timezone клиента в момент бронирования.
     * Используется для показа времени в его письмах.
     */
    timezone: { type: String },

    /**
     * Динамический статус бронирования.
     * Ссылка на BookingStatus collection.
     */
    statusId: {
      type: Schema.Types.ObjectId,
      ref: "BookingStatus",
      required: true,
    },

    /**
     * Копия { name, email, phone } клиента на момент брони.
     * НИКОГДА не обновляется после создания.
     */
    inviteeSnapshot: { type: InviteeSnapshotSchema },

    /**
     * Заметка от клиента. Nullable.
     * Сохраняется только если bookingFields.notes.enabled=true.
     */
    clientNotes: { type: String, default: null },

    /**
     * Значения кастомных полей формы бронирования.
     * Каждый элемент: { fieldId, label, value }.
     */
    customFieldValues: {
      type: [
        {
          fieldId: { type: String, required: true },
          label: { type: String, required: true },
          value: { type: String, required: true },
          _id: false,
        },
      ],
      default: [],
    },

    payment: {
      /**
       * Статус оплаты: none | pending | paid | refunded | failed.
       */
      status: { type: String, enum: PAYMENT_STATUSES, default: "none" },

      /**
       * Центы. Integer. 5000 = ₴50. Никогда float.
       */
      amount: { type: Number, default: 0 },

      /**
       * Stripe PaymentIntent ID для трекинга и возвратов.
       */
      stripeId: { type: String },
    },

    /**
     * Уникальный токен для ссылки "Відмінити" в письме клиенту.
     * Клиент может отменить бронь без входа в систему.
     * Unique sparse — null у уже отменённых броней.
     */
    cancelToken: { type: String, unique: true, sparse: true, default: null },

    /**
     * Уникальный токен для ссылки "Перенести" в письме клиенту.
     */
    rescheduleToken: {
      type: String,
      unique: true,
      sparse: true,
      default: null,
    },
  },
  { timestamps: true },
);

/** Проверка коллізій по времени специалиста */
BookingSchema.index({ "hosts.userId": 1, startAt: 1, endAt: 1 });

/** Журнал мастера */
BookingSchema.index({ "hosts.userId": 1, statusId: 1, startAt: 1 });

/** История клиента */
BookingSchema.index({ inviteeId: 1, startAt: -1 });

/** Аналитика организации */
BookingSchema.index({ orgId: 1, statusId: 1, startAt: 1 });

/** Загруженность точки */
BookingSchema.index({ locationId: 1, statusId: 1, startAt: 1 });

export default model("Booking", BookingSchema);
