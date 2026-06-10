import mongoose from "mongoose";

const { Schema, model } = mongoose;

const PositionSchema = new Schema(
  {
    /**
     * Организация.
     */
    orgId: {
      type: Schema.Types.ObjectId,
      ref: "Organization",
      required: true,
    },

    /**
     * Название должности: "Старший барбер", "Колорист", "Стажёр".
     */
    name: { type: String, required: true },

    /**
     * Числовой грейд для сортировки: 0=стажёр, 1=junior, 2=senior.
     * Только для отображения, не влияет на бизнес-логику.
     */
    level: { type: Number, default: 0 },

    /**
     * HEX. Цвет метки в журнале и admin-панели.
     */
    color: { type: String },

    /**
     * false = нельзя назначить новым сотрудникам.
     * Существующие memberships с этой должностью остаются.
     */
    active: { type: Boolean, default: true },
  },
  { timestamps: true },
);

PositionSchema.index({ orgId: 1 });

export default model("Position", PositionSchema);
