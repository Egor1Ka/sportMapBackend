import mongoose from "mongoose";

const { Schema, model } = mongoose;

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
 * Переопределение графика на конкретную дату.
 *
 * ВАЖНО: `slots[].start` / `slots[].end` — HH:MM в timezone активного
 * ScheduleTemplate этого staff/org/location на момент чтения.
 * Override не хранит свой timezone — если tz шаблона меняется,
 * интерпретация override'ов меняется тоже.
 */
const ScheduleOverrideSchema = new Schema(
  {
    /**
     * Чьё расписание.
     */
    staffId: { type: Schema.Types.ObjectId, ref: "User", required: true },

    /**
     * В какой организации.
     */
    orgId: {
      type: Schema.Types.ObjectId,
      ref: "Organization",
      default: null,
    },

    /**
     * В какой точке.
     */
    locationId: {
      type: Schema.Types.ObjectId,
      ref: "Location",
      default: null,
    },

    /**
     * Конкретный день (UTC midnight). 1 документ = 1 день.
     */
    date: { type: Date, required: true },

    /**
     * false = выходной (игнорируем weeklyHours из шаблона).
     * true  = особые часы (используем slots).
     */
    enabled: { type: Boolean, required: true },

    /**
     * Рабочие часы в этот день. Пустой если enabled=false.
     */
    slots: { type: [TimeSlotSchema], default: [] },

    /**
     * Причина исключения. Для аналитики.
     */
    reason: { type: String, default: null },
  },
  {
    timestamps: { createdAt: true, updatedAt: false },
  },
);

/**
 * Override НИКОГДА не удаляется — исторический факт.
 * Через год можно узнать "почему 8 апр был выходным".
 */
ScheduleOverrideSchema.index(
  { staffId: 1, orgId: 1, locationId: 1, date: 1 },
  { unique: true },
);

export default model("ScheduleOverride", ScheduleOverrideSchema);
