const LOG_LEVELS = { DEBUG: 0, INFO: 1, WARN: 2, ERROR: 3 };

class Logger {
  constructor(level) {
    this.level = LOG_LEVELS[level] ?? LOG_LEVELS.DEBUG;
  }

  debug(...args) {
    if (this.level <= LOG_LEVELS.DEBUG) console.log('[DEBUG]', ...args);
  }

  info(...args) {
    if (this.level <= LOG_LEVELS.INFO) console.log('[INFO]', ...args);
  }

  warn(...args) {
    if (this.level <= LOG_LEVELS.WARN) console.warn('[WARN]', ...args);
  }

  error(...args) {
    if (this.level <= LOG_LEVELS.ERROR) console.error('[ERROR]', ...args);
  }
}

const level = process.env.LOG_LEVEL || (process.env.NODE_ENV === 'production' ? 'INFO' : 'DEBUG');
module.exports = new Logger(level);
