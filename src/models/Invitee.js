import mongoose from "mongoose";

const { Schema, model } = mongoose;

const InviteeSchema = new Schema(
  {
    /**
     * Имя клиента. Обязательное всегда.
     */
    name: { type: String, required: true },

    /**
     * Email клиента. Опциональный.
     * Поле просто отсутствует, если не задано.
     * Уникальность обеспечивается partial-индексом ниже —
     * он индексирует ТОЛЬКО строковые значения, поэтому
     * несколько инвайти без email сосуществуют без конфликта.
     */
    email: { type: String },

    /**
     * E.164 формат: "+380501234567". Опциональный.
     * Уникальность через partial-индекс (см. ниже).
     */
    phone: { type: String },

    /**
     * ISO 3166-1 ("UA"). Nullable.
     * Сохраняем для предзаполнения флага страны
     * при следующем бронировании этого клиента.
     */
    phoneCountry: { type: String, default: null },

    /**
     * IANA timezone. Определяется из браузера при первом бронировании.
     * Используется для показа времени в письмах клиенту.
     */
    timezone: { type: String },

    /**
     * Nullable.
     * null = обычный клиент без аккаунта специалиста.
     * Заполняется если специалист сам записывается к кому-то.
     */
    userId: { type: Schema.Types.ObjectId, ref: "User", default: null },
  },
  { timestamps: true },
);

// Уникальные partial-индексы: индексируются только строковые значения.
// null/undefined в индекс не попадают, поэтому несколько инвайти
// без email или без phone не конфликтуют по unique-ограничению.
InviteeSchema.index(
  { email: 1 },
  { unique: true, partialFilterExpression: { email: { $type: "string" } } },
);
InviteeSchema.index(
  { phone: 1 },
  { unique: true, partialFilterExpression: { phone: { $type: "string" } } },
);

export default model("Invitee", InviteeSchema);
