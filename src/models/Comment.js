import mongoose from "mongoose";

const { Schema, model } = mongoose;

const TARGET_TYPES = ["EventType", "User", "Membership"];

const CommentSchema = new Schema(
  {
    authorId: { type: Schema.Types.ObjectId, ref: "User", required: true },
    targetType: { type: String, enum: TARGET_TYPES, required: true },
    targetId: { type: Schema.Types.ObjectId, required: true },
    body: {
      type: String,
      required: true,
      minlength: 1,
      maxlength: 1000,
    },
  },
  { timestamps: true },
);

CommentSchema.index({ targetType: 1, targetId: 1, createdAt: -1 });
CommentSchema.index({ authorId: 1 });

export { TARGET_TYPES };
export default model("Comment", CommentSchema);
