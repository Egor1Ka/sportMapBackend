import mongoose from "mongoose";

const { Schema, model } = mongoose;

const TARGET_TYPES = ["EventType", "User", "Membership"];

const RatingSchema = new Schema(
  {
    /** Автор оценки. Всегда User. */
    authorId: { type: Schema.Types.ObjectId, ref: "User", required: true },

    /** Тип сущности, на которую поставлена оценка. */
    targetType: { type: String, enum: TARGET_TYPES, required: true },

    /** ObjectId сущности (без ref — полиморфно). */
    targetId: { type: Schema.Types.ObjectId, required: true },

    /** Оценка 1..5, целое. */
    value: {
      type: Number,
      required: true,
      min: 1,
      max: 5,
      validate: {
        validator: Number.isInteger,
        message: "value must be integer 1-5",
      },
    },
  },
  { timestamps: true },
);

// Один рейтинг от юзера на сущность.
RatingSchema.index(
  { authorId: 1, targetType: 1, targetId: 1 },
  { unique: true },
);

// Для агрегаций avg/count.
RatingSchema.index({ targetType: 1, targetId: 1 });

export { TARGET_TYPES };
export default model("Rating", RatingSchema);
