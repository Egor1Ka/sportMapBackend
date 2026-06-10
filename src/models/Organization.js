import mongoose from "mongoose";

const { Schema, model } = mongoose;

const isValidIanaTimezone = (v) => {
  try {
    return !!v && Intl.supportedValuesOf("timeZone").includes(v);
  } catch {
    return false;
  }
};

const OrganizationSchema = new Schema(
  {
    /**
     * Отображаемое название организации.
     */
    name: { type: String, required: true },

    /**
     * IANA timezone ("Europe/Kyiv").
     * Обязательное поле на уровне организации — дефолт для новых сотрудников
     * и для движка слотов когда у специалиста нет своего шаблона расписания.
     * Задаётся при создании орги, не имеет server-side fallback.
     */
    timezone: {
      type: String,
      required: true,
      validate: {
        validator: isValidIanaTimezone,
        message: "Invalid IANA timezone",
      },
    },

    /**
     * Валюта организации.
     */
    currency: { type: String, enum: ["UAH", "USD"], default: "UAH" },

    /**
     * Описание организации (публичное).
     */
    description: { type: String, default: null },

    /**
     * Адрес организации.
     */
    address: { type: String, default: null },

    /**
     * Контактный телефон.
     */
    phone: { type: String, default: null },

    /**
     * Вебсайт организации.
     */
    website: { type: String, default: null },

    /**
     * Активна ли организация. false — подписка истекла.
     */
    active: { type: Boolean, default: true },

    settings: {
      /**
       * ISO 3166-1 ("UA").
       * Дефолтный код страны в телефонном инпуте на странице записи клиента.
       */
      defaultCountry: { type: String, default: "UA" },

      /**
       * HEX. Цвет бренда на публичной странице записи.
       */
      brandColor: { type: String },

      /**
       * URL логотипа организации.
       */
      logoUrl: { type: String },

      /**
       * Скрыть "Powered by Slotix" на публичной странице.
       */
      hideBranding: { type: Boolean, default: false },
    },

    /**
     * Дефолтный статус для новых бронирований в организации.
     */
    defaultBookingStatusId: {
      type: Schema.Types.ObjectId,
      ref: "BookingStatus",
      default: null,
    },
  },
  { timestamps: true },
);

export default model("Organization", OrganizationSchema);
