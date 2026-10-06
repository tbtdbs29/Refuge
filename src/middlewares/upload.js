import multer from 'multer';
import { config } from '../config/index.js';
import { ValidationError } from '../utils/errors.js';

const uploader = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: config.maxUploadBytes, files: 12, fields: 80 },
  // Non-image files are skipped (not fatal) so the rest of the form is still parsed and can be re-shown.
  fileFilter(req, file, callback) {
    if (!/^image\//.test(file.mimetype)) {
      req.uploadError = 'Seules les images sont acceptées (JPEG, PNG, WebP, HEIC).';
      return callback(null, false);
    }
    callback(null, true);
  },
});

/**
 * Upload problems are recorded on req.uploadError instead of failing the request,
 * so form controllers can re-render the form with the volunteer's input (see assertUploadOk).
 */
function wrap(middleware) {
  return (req, res, next) =>
    middleware(req, res, (error) => {
      if (error instanceof multer.MulterError) {
        req.uploadError = error.code === 'LIMIT_FILE_SIZE' ? 'Image trop lourde (12 Mo maximum).' : 'Envoi de fichiers refusé.';
        req.files = [];
        req.file = undefined;
        req.body ??= {};
        return next();
      }
      next(error);
    });
}

export function assertUploadOk(req) {
  if (req.uploadError) throw new ValidationError({ photo: req.uploadError });
}

export const uploadPhotos = wrap(uploader.array('photos', 12));
export const uploadCover = wrap(uploader.single('cover'));
