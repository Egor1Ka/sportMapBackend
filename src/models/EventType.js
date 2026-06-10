import mongoose from "mongoose";

const { Schema, model } = mongoose;

/** Тип услуги */
const EVENT_TYPE_TYPES = ["solo", "org"];

/** Политика назначения персонала для org-услуг */
const STAFF_POLICIES = ["any", "by_position", "specific"];

/** Провайдеры видеозвонков */
const CONFERENCE_PROVIDERS = ["google_meet", "zoom", "teams", "custom", "none"];

/**
 * Настройка одного поля формы бронирования.
 */
const BookingFieldSchema = new Schema(
  {
    /** Показывать ли поле клиенту */
    enabled: { type: Boolean, default: false },

    /** Обязательное ли поле */
    required: { type: Boolean, default: false },
  },
  { _id: false },
);

const EventTypeSchema = new Schema(
  {
    /**
     * Чья услуга.
     * null если type='org' (услуга принадлежит организации).
     */
    userId: { type: Schema.Types.ObjectId, ref: "User", default: null },

    /**
     * Организация.
     * null если solo-специалист.
     */
    orgId: {
      type: Schema.Types.ObjectId,
      ref: "Organization",
      default: null,
    },

    /**
     * URL услуги: /anna/consult-60.
     * Генерируется из name при создании, хранится — при переименовании
     * услуги ссылки клиентов не ломаются.
     * Уникален в рамках userId.
     */
    slug: { type: String, required: true },

    /**
     * Название услуги (показывается клиенту).
     */
    name: { type: String, required: true },

    /**
     * Описание услуги (показывается клиенту).
     */
    description: { type: String, default: null },

    /**
     * Длина сессии в минутах. Min 5, max 480.
     * КЛЮЧЕВОЕ ПОЛЕ: движок слотов нарезает временную сетку
     * именно по этому значению.
     */
    durationMin: { type: Number, required: true, min: 5, max: 480 },

    /**
     * solo — личная услуга конкретного userId.
     *        Клиент записывается только к этому специалисту.
     * org  — услуга организации, userId=null.
     *        Клиент выбирает услугу → потом выбирает специалиста.
     */
    type: { type: String, enum: EVENT_TYPE_TYPES, required: true },

    /**
     * Используется только если type='org':
     * any          — любой active member организации может вести
     * by_position  — только сотрудники с должностью из assignedPositions
     * specific     — только конкретные люди из assignedStaff
     */
    staffPolicy: { type: String, enum: STAFF_POLICIES, default: "any" },

    /**
     * Какие должности могут вести эту услугу.
     * Используется только если staffPolicy='by_position'.
     * Bounded max 10.
     */
    assignedPositions: {
      type: [{ type: Schema.Types.ObjectId, ref: "Position" }],
      validate: {
        validator: (v) => v.length <= 10,
        message: "Maximum 10 assigned positions allowed",
      },
      default: [],
    },

    /**
     * Конкретные специалисты которые могут вести услугу.
     * При уходе специалиста — убирать через $pull.
     * Используется только если staffPolicy='specific'.
     * Bounded max 20.
     */
    assignedStaff: {
      type: [{ type: Schema.Types.ObjectId, ref: "User" }],
      validate: {
        validator: (v) => v.length <= 20,
        message: "Maximum 20 assigned staff allowed",
      },
      default: [],
    },

    /**
     * В каких точках доступна услуга.
     * Пустой массив = во всех точках орг.
     */
    locationIds: {
      type: [{ type: Schema.Types.ObjectId, ref: "Location" }],
      default: [],
    },

    /**
     * false = услуга скрыта, новые брони невозможны.
     * Старые брони остаются.
     */
    active: { type: Boolean, default: true },

    /**
     * HEX. Цвет карточки в журнале записи специалиста.
     */
    color: { type: String },

    /**
     * URL фото услуги. Заполняется через POST /api/event-types/:id/photo.
     * Пустая строка = нет фото, фронт показывает fallback-букву.
     */
    image: { type: String, default: "" },

    price: {
      /**
       * Цена в ЦЕНТАХ. Integer, никогда float.
       * 5000 = ₴50.00. 0 = бесплатно.
       * Валюта НЕ хранится здесь — резолвится через ScheduleTemplate.currency
       * (для личных услуг) или Organization.currency (для оргшних).
       */
      amount: { type: Number, default: 0 },

      /**
       * Stripe Price ID для чекаута.
       */
      stripeId: { type: String },
    },

    /**
     * Настройка полей формы бронирования.
     * Правило: email.enabled и phone.enabled не могут быть оба false —
     * некуда слать уведомление о брони.
     */
    bookingFields: {
      email: { type: BookingFieldSchema, default: () => ({ enabled: true, required: true }) },
      phone: { type: BookingFieldSchema, default: () => ({ enabled: false, required: false }) },
      notes: { type: BookingFieldSchema, default: () => ({ enabled: false, required: false }) },
    },

    conference: {
      /**
       * Видеозвонок: google_meet | zoom | teams | custom | none.
       */
      provider: {
        type: String,
        enum: CONFERENCE_PROVIDERS,
        default: "none",
      },

      /**
       * Фиксированная ссылка если provider=custom.
       */
      customUrl: { type: String },
    },

    /**
     * Минут буфера ПОСЛЕ встречи.
     * В это время следующий слот клиентам недоступен.
     */
    bufferAfter: { type: Number, default: 0 },

    /**
     * Минут минимального уведомления.
     * Клиент не может записаться позже чем за N минут до начала.
     */
    minNotice: { type: Number, default: 0 },

    /**
     * Шаг временной сетки для клиента в минутах. Nullable.
     * null = шаг равен durationMin (дефолт).
     * 60 = слоты всегда по часам (10:00, 11:00) независимо от длины услуги.
     */
    slotStepMin: { type: Number, default: null },
  },
  { timestamps: true },
);

EventTypeSchema.index({ userId: 1, slug: 1 }, { unique: true });
EventTypeSchema.index({ orgId: 1 });

export default model("EventType", EventTypeSchema);
