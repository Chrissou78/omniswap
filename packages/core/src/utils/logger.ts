export const logger = {
  info: (message: string, meta?: Record<string, unknown>) => {
    console.log(`[INFO] ${message}`, meta || '');
  },
  error: (message: string, meta?: Record<string, unknown>) => {
    console.error(`[ERROR] ${message}`, meta || '');
  },
  warn: (message: string, meta?: Record<string, unknown>) => {
    console.warn(`[WARN] ${message}`, meta || '');
  },
  debug: (message: string, meta?: Record<string, unknown>) => {
    if (process.env.DEBUG) {
      console.log(`[DEBUG] ${message}`, meta || '');
    }
  },
};

export default logger;
