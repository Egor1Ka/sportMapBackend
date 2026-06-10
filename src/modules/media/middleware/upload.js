import multer from 'multer';
import { getAssetLimits } from '../constants/media.js';
import { httpStatus } from '../../../utils/http/httpStatus.js';

/**
 * Multer middleware с лимитами по типу ассета.
 * Пример: router.post('/photos', uploadFor('playground-photo').single('file'), handler)
 */
export const uploadFor = (assetType) => {
  const limits = getAssetLimits(assetType);
  return multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: limits.maxBytes },
    fileFilter: (_req, file, cb) => {
      if (!limits.mimes.includes(file.mimetype)) {
        const err = new Error(
          `Invalid file format. Allowed: ${limits.mimes.join(', ')}`,
        );
        err.code = 'INVALID_MIME';
        cb(err);
        return;
      }
      cb(null, true);
    },
  });
};

/**
 * Express error-handler для ошибок multer. Должен идти СРАЗУ после
 * uploadFor(...).single('file') в цепочке middleware.
 */
export const handleUploadError = (err, _req, res, next) => {
  if (!err) return next();
  if (err instanceof multer.MulterError) {
    const message =
      err.code === 'LIMIT_FILE_SIZE' ? 'File too large' : err.message || 'Upload error';
    return res.status(httpStatus.BAD_REQUEST).json({
      error: message,
      code: err.code,
      details: { file: { error: message } },
    });
  }
  if (err.code === 'INVALID_MIME') {
    return res.status(httpStatus.BAD_REQUEST).json({
      error: err.message,
      code: err.code,
      details: { file: { error: err.message } },
    });
  }
  return next(err);
};
