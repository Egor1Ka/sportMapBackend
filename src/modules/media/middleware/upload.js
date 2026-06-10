// src/modules/media/middleware/upload.js
import multer from "multer";
import { getAssetLimits } from "../constants/media.js";
import { httpResponse } from "../../../shared/utils/http/httpResponse.js";
import { userStatus } from "../../../shared/utils/http/httpStatus.js";

/**
 * Создаёт multer middleware с лимитами по типу ассета.
 * Использование: router.post('/avatar', authMiddleware, uploadFor('user-avatar').single('file'), handler)
 */
export const uploadFor = (assetType) => {
  const limits = getAssetLimits(assetType);
  return multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: limits.maxBytes },
    fileFilter: (_req, file, cb) => {
      if (!limits.mimes.includes(file.mimetype)) {
        const err = new Error(
          `Invalid file format. Allowed: ${limits.mimes.join(", ")}`,
        );
        err.code = "INVALID_MIME";
        cb(err);
        return;
      }
      cb(null, true);
    },
  });
};

/**
 * Express error-handler для ошибок multer. Превращает их в стандартный
 * validationError формат через httpResponse.
 *
 * Должен идти СРАЗУ после `uploadFor(...).single('file')` в цепочке middleware.
 */
export const handleUploadError = (err, _req, res, next) => {
  if (!err) return next();
  if (err instanceof multer.MulterError) {
    const message =
      err.code === "LIMIT_FILE_SIZE" ? "File too large" : err.message || "Upload error";
    return httpResponse(res, userStatus.VALIDATION_ERROR, {
      file: { error: message },
    });
  }
  if (err.code === "INVALID_MIME") {
    return httpResponse(res, userStatus.VALIDATION_ERROR, {
      file: { error: err.message },
    });
  }
  return next(err);
};
