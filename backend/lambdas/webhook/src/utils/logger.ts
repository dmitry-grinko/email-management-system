import winston from 'winston';

export const logger = winston.createLogger({
  level: 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.json()
  ),
  transports: [
    new winston.transports.Console()
  ]
});

export const logError = (message: string, error: any, meta?: any) => {
  logger.error(message, {
    error: error instanceof Error ? error.message : error,
    stack: error instanceof Error ? error.stack : undefined,
    ...meta
  });
};

export const logInfo = (message: string, meta?: any) => {
  logger.info(message, meta);
}; 