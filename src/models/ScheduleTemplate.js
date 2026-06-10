import mongoose from "mongoose";

const { Schema, model } = mongoose;

/** Дни недели */
const WEEKDAYS = ["mon", "tue", "wed", "thu", "fri", "sat", "sun"];

/** Алгоритмы построения сетки слотов */
const SLOT_MODES = ["fixed", "optimal", "dynamic"];

/**
 * Один рабочий интервал: { start: "09:00", end: "13:00" }.
 */
const TimeSlotSchema = new Schema(
  {
    /** Начало интервала в формате "HH:MM" */
    start: { type: String, required: true },

    /** Конец интервала в формате "HH:MM" */
    end: { type: String, required: true },
  },
  { _id: false },
);

/**
 * Рабочие часы одного дня недели.
 */
const WeeklyHoursSchema = new Schema(
  {
    /**
     * День недели: mon | tue | wed | thu | fri | sat | sun.
     */
    day: { type: String, enum: WEEKDAYS, required: true },

    /**
     * false = выходной день, слотов нет.
     */
    enabled: { type: Boolean, default: false },

    /**
     * Рабочие интервалы в этот день. Max 4.
     * Можно несколько: утро 9–13 и вечер 15–19.
     */
    slots: {
      type: [TimeSlotSchema],
      validate: {
        validator: (v) => v.length <= 4,
        message: "Maximum 4 time slots per day allowed",
      },
      default: [],
    },
  },
  { _id: false },
);

const ScheduleTemplateSchema = new Schema(
  {
    /**
     * Чьё расписание.
     */
    staffId: { type: Schema.Types.ObjectId, ref: "User", required: true },

    /**
     * В какой организации.
     * null = solo-специалист.
     */
    orgId: {
      type: Schema.Types.ObjectId,
      ref: "Organization",
      default: null,
    },

    /**
     * В какой точке.
     * null = solo или без точек.
     * Один мастер в двух точках = два шаблона с разными locationId.
     */
    locationId: {
      type: Schema.Types.ObjectId,
      ref: "Location",
      default: null,
    },

    /**
     * С какой даты шаблон действует (UTC).
     * При смене расписания: старый закрывается (validTo = вчера),
     * создаётся новый (validFrom = сегодня).
     */
    validFrom: { type: Date, required: true },

    /**
     * До какой даты включительно. Nullable.
     * null = шаблон актуален прямо сейчас.
     * Старые шаблоны НЕ удаляются — история расписания сохраняется.
     */
    validTo: { type: Date, default: null },

    /**
     * IANA timezone для ЛИЧНОГО расписания (orgId === null).
     * Для орг-расписаний timezone берётся из Organization.timezone.
     * Все HH:MM в weeklyHours интерпретируются в resolved timezone.
     */
    timezone: { type: String, required: false, default: null },

    /**
     * Валюта ЛИЧНОГО расписания (orgId === null).
     * Для орг-расписаний currency берётся из Organization.currency.
     * Используется для отображения сумм в личной статистике.
     */
    currency: { type: String, enum: ["UAH", "USD"], default: "UAH" },

    /**
     * Алгоритм построения сетки слотов:
     * fixed   — сетка строго по шагу, ничего не меняется
     * optimal — сетка + один доп. слот после конца последней брони
     * dynamic — вся сетка пересчитывается от конца последней брони
     */
    slotMode: { type: String, enum: SLOT_MODES, default: "fixed" },

    /**
     * Шаг сетки для этого расписания. Nullable.
     * null = брать из EventType.slotStepMin или durationMin.
     */
    slotStepMin: { type: Number, default: null },

    /**
     * Рабочие часы по дням недели.
     * ВСЕГДА ровно 7 элементов (mon–sun). Bounded.
     */
    weeklyHours: {
      type: [WeeklyHoursSchema],
      validate: {
        validator: (v) => v.length === 7,
        message: "weeklyHours must contain exactly 7 entries (mon–sun)",
      },
      required: true,
    },
  },
  { timestamps: true },
);

ScheduleTemplateSchema.index({ staffId: 1, orgId: 1, locationId: 1, validFrom: 1 });
ScheduleTemplateSchema.index({ staffId: 1, orgId: 1, locationId: 1, validTo: 1 });

export default model("ScheduleTemplate", ScheduleTemplateSchema);
