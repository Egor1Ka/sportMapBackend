import mongoose from "mongoose";

const { Schema, model } = mongoose;

const LocationSchema = new Schema(
  {
    /**
     * Организация которой принадлежит точка. Обязательное.
     */
    orgId: { type: Schema.Types.ObjectId, ref: "Organization", required: true },

    /**
     * Короткое название для UI: "Вернадського", "Центр".
     * Показывается клиенту при выборе точки.
     */
    name: { type: String, required: true },

    address: {
      /** Улица */
      street: { type: String },

      /** Город */
      city: { type: String },

      /** Страна (ISO 3166-1) */
      country: { type: String },

      /**
       * Широта для карты и геопоиска.
       */
      lat: { type: Number },

      /**
       * Долгота для карты и геопоиска.
       */
      lng: { type: Number },
    },

    /**
     * IANA timezone этой точки.
     * Переопределяет org.settings.defaultTimezone.
     * Нужно потому что компания может работать в двух городах.
     */
    timezone: { type: String },

    /**
     * E.164 телефон конкретной точки.
     */
    phone: { type: String },

    /**
     * Фото точки — показывается клиенту в списке точек.
     */
    photoUrl: { type: String },

    /**
     * false = точка закрыта, бронирования невозможны.
     */
    active: { type: Boolean, default: true },
  },
  { timestamps: true },
);

/**
 * Геоиндекс для поиска ближайших точек на карте.
 */
LocationSchema.index({ "address.lat": 1, "address.lng": 1 }, { sparse: true });

LocationSchema.index({ orgId: 1 });

export default model("Location", LocationSchema);
