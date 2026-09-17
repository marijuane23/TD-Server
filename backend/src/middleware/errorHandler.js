import multer from 'multer';

export function errorHandler(err, req, res, next) {
  // Multer specific errors
  if (err instanceof multer.MulterError) {
    if (err.code === 'LIMIT_FILE_SIZE') {
      return res.status(413).json({
        error: 'File too large. Maximum file upload size is 50MB.',
      });
    }
    return res.status(400).json({
      error: `Upload error: ${err.message}`,
    });
  }

  // File filter errors or explicit client errors
  if (err.message && (err.message.includes('Unsupported file type') || err.message.includes('Invalid file type'))) {
    return res.status(400).json({
      error: err.message,
    });
  }

  const status = err.status || 500;
  if (status >= 500) {
    console.error('[Internal Error Handler]', err);
  }

  res.status(status).json({
    error: err.message || 'Internal server error',
  });
}

export function notFoundHandler(req, res) {
  res.status(404).json({
    error: `Route not found: ${req.method} ${req.originalUrl}`,
  });
}
