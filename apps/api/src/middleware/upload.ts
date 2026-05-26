import multer from 'multer';

const MAX_UPLOAD_MB = Number(process.env.MAX_UPLOAD_MB) || 15;

export const imageUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_UPLOAD_MB * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    if (!/^image\/(png|jpe?g|webp|gif)$/.test(file.mimetype)) {
      cb(new Error('Only PNG/JPEG/WEBP/GIF images are accepted'));
      return;
    }
    cb(null, true);
  },
});

export const audioUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_UPLOAD_MB * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    const ok =
      /^audio\/(webm|ogg|wav|mpeg|mp4|x-m4a|mp3)$/.test(file.mimetype) ||
      /^video\/webm$/.test(file.mimetype);
    if (!ok) {
      cb(new Error(`Unsupported audio mimetype: ${file.mimetype}`));
      return;
    }
    cb(null, true);
  },
});
