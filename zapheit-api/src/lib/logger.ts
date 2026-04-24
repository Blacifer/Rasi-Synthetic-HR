import winston from 'winston';
import TransportStream from 'winston-transport';

const format = winston.format.combine(
  winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
  winston.format.errors({ stack: true }),
  winston.format.json()
);

const transports: winston.transport[] = [
  new winston.transports.Console({
    format: winston.format.combine(
      winston.format.colorize(),
      winston.format.printf(({ timestamp, level, message, ...meta }) => {
        const metaStr = Object.keys(meta).length ? JSON.stringify(meta, null, 2) : '';
        return `${timestamp} [${level}]: ${message} ${metaStr}`;
      })
    ),
  }),
];

// File transports are only used when LOG_TO_FILE is explicitly set.
// In containerised deployments (Railway, Docker) stdout/stderr is captured
// by the platform — writing to disk wastes space and causes EACCES errors
// when running as a non-root user.
if (process.env.LOG_TO_FILE === 'true') {
  transports.push(
    new winston.transports.File({
      filename: 'logs/error.log',
      level: 'error',
      format,
    }),
    new winston.transports.File({
      filename: 'logs/combined.log',
      format,
    })
  );
}

// Logtail HTTP transport — zero extra packages, fires when LOGTAIL_TOKEN is set.
// Set LOGTAIL_TOKEN in Railway env vars to enable. Drops silently on error so
// the app never crashes due to a logging side-effect.
if (process.env.LOGTAIL_TOKEN) {
  const LOGTAIL_TOKEN = process.env.LOGTAIL_TOKEN;
  class LogtailTransport extends TransportStream {
    private buf: object[] = [];
    private timer: ReturnType<typeof setTimeout> | null = null;

    log(info: any, callback: () => void) {
      this.buf.push({
        dt: new Date().toISOString(),
        level: info.level,
        message: info.message,
        ...Object.fromEntries(
          Object.entries(info).filter(([k]) => !['level', 'message', 'Symbol(level)'].includes(k))
        ),
      });
      if (!this.timer) {
        this.timer = setTimeout(() => this.flush(), 2000);
      }
      callback();
    }

    private flush() {
      this.timer = null;
      const batch = this.buf.splice(0);
      if (!batch.length) return;
      fetch('https://in.logtail.com/', {
        method: 'POST',
        headers: { Authorization: `Bearer ${LOGTAIL_TOKEN}`, 'Content-Type': 'application/json' },
        body: JSON.stringify(batch),
      }).catch(() => null);
    }
  }
  transports.push(new LogtailTransport({ level: 'info' }));
}

export const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format,
  transports,
});

export default logger;
