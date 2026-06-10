import mongoose from "mongoose";

const { Schema, model } = mongoose;

/** Допустимые роли в системе (про доступ к интерфейсу, не про услуги) */
const MEMBERSHIP_ROLES = ["owner", "admin", "member"];

/** Допустимые статусы членства */
const MEMBERSHIP_STATUSES = ["active", "invited", "suspended", "left"];

const MembershipSchema = new Schema(
  {
    /**
     * Пользователь.
     */
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true },

    /**
     * Организация.
     */
    orgId: {
      type: Schema.Types.ObjectId,
      ref: "Organization",
      required: true,
    },

    /**
     * Роль в системе (про доступ к интерфейсу, не про услуги):
     * owner  — создатель, платит за подписку, может удалить орг
     * admin  — управляет командой, услугами, расписанием всех
     * member — видит только своё расписание и свои брони
     */
    role: { type: String, enum: MEMBERSHIP_ROLES, required: true },

    /**
     * Должность в этой орг (про бизнес-логику, не про доступ):
     * "Старший барбер", "Колорист", "Стажёр".
     * Определяет какие услуги может вести сотрудник.
     * null если должности не используются.
     */
    positionId: {
      type: Schema.Types.ObjectId,
      ref: "Position",
      default: null,
    },

    /**
     * В каких точках работает сотрудник.
     * Пустой массив = работает во всех точках орг.
     * Bounded max 10.
     */
    locationIds: {
      type: [{ type: Schema.Types.ObjectId, ref: "Location" }],
      validate: {
        validator: (v) => v.length <= 10,
        message: "Maximum 10 locations allowed",
      },
      default: [],
    },

    /**
     * active    — работает
     * invited   — получил email-приглашение, ещё не принял
     * suspended — временно заблокирован
     * left      — покинул организацию
     */
    status: {
      type: String,
      enum: MEMBERSHIP_STATUSES,
      default: "invited",
    },

    /**
     * Кто пригласил. Nullable.
     */
    invitedBy: { type: Schema.Types.ObjectId, ref: "User", default: null },

    /**
     * Краткое описание сотрудника в этой организации.
     */
    bio: { type: String, default: null },

    /**
     * Имя сотрудника внутри этой организации.
     * Если null — используется User.name (глобальное имя).
     * Max 100 символов.
     */
    displayName: {
      type: String,
      default: null,
      maxlength: 100,
    },

    /**
     * Per-org аватарка юзера. Если пусто — фронт показывает букву (фолбэк).
     * URL уже с прибитыми Cloudinary трансформациями (c_fill,g_face,w_400,h_400).
     */
    avatar: { type: String, default: "" },
  },
  { timestamps: true },
);

/**
 * Нельзя дважды в одну орг.
 */
MembershipSchema.index({ userId: 1, orgId: 1 }, { unique: true });

export default model("Membership", MembershipSchema);
