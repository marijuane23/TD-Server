import multer from 'multer';
import path from 'path';
import { ALLOWED_IMAGE_MIMES, ALLOWED_VIDEO_MIMES, MAX_MEDIA_SIZE_BYTES } from '../utils/validators.js';

const storage = multer.memoryStorage();

// Media upload middleware (max 50MB for photos and short videos)
export const mediaUpload = multer({
  storage,
  limits: {
    fileSize: MAX_MEDIA_SIZE_BYTES, // 50MB
    files: 1,
  },
  fileFilter: (req, file, cb) => {
    const isAllowed = [...ALLOWED_IMAGE_MIMES, ...ALLOWED_VIDEO_MIMES].includes(file.mimetype);
    if (isAllowed) {
      cb(null, true);
    } else {
      cb(new Error(`Unsupported file type: ${file.mimetype}. Only JPG, PNG, WEBP, MP4, and WEBM are allowed.`));
    }
  },
});

// Excel upload middleware for admin teacher import (max 10MB)
export const excelUpload = multer({
  storage,
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB
    files: 1,
  },
  fileFilter: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    const isExcel = ext === '.xlsx' || file.mimetype === 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
    if (isExcel) {
      cb(null, true);
    } else {
      cb(new Error('Invalid file type. Please upload a valid .xlsx spreadsheet.'));
    }
  },
});

// Photo upload middleware for teacher portraits (max 10MB, images only)
export const photoUpload = multer({
  storage,
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB
    files: 1,
  },
  fileFilter: (req, file, cb) => {
    if (ALLOWED_IMAGE_MIMES.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error(`Unsupported image type: ${file.mimetype}. Only JPG, PNG, and WEBP are allowed.`));
    }
  },
});

