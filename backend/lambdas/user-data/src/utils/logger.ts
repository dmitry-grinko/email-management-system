export const logger = {
  info: (message: string, context: Record<string, any> = {}) => {
    console.log(JSON.stringify({ level: 'INFO', message, ...context, timestamp: new Date().toISOString() }));
  },
  error: (message: string, error: any, context: Record<string, any> = {}) => {
    console.error(JSON.stringify({
      level: 'ERROR',
      message,
      error: error instanceof Error ? {
        name: error.name,
        message: error.message,
        stack: error.stack
      } : error,
      ...context,
      timestamp: new Date().toISOString()
    }));
  },
  debug: (message: string, context: Record<string, any> = {}) => {
    console.debug(JSON.stringify({ level: 'DEBUG', message, ...context, timestamp: new Date().toISOString() }));
  }
}; 