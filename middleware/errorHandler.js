// middleware/errorHandler.js
// Simple request logger + global error handler (keeps server.js tiny)

export function requestLogger(req, res, next) {
  const start = Date.now();
  res.on("finish", () => {
    const ms = Date.now() - start;
    console.log(`${req.method} ${req.originalUrl} ${res.statusCode} ${ms}ms`);
  });
  next();
}

// eslint-disable-next-line no-unused-vars
export function globalErrorHandler(err, req, res, next) {
  console.error("Server error:", err);
  res.status(err.status || 500).json({
    success: false,
    error: process.env.NODE_ENV === "production" ? "Internal server error." : err.message,
  });
}

export function notFoundHandler(req, res) {
  res.status(404).json({ success: false, error: `Route ${req.originalUrl} not found.` });
}
