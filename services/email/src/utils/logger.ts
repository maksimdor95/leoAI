/* eslint-disable no-console */

type LogArguments = Array<unknown>;

const formatMessage = (level: string, args: LogArguments): LogArguments => {
  if (args.length === 0) {
    return [level];
  }

  if (typeof args[0] === 'string') {
    return [`${level} ${args[0]}`, ...args.slice(1)];
  }

  return [level, ...args];
};

export const logger = {
  info: (...args: LogArguments) => console.log(...formatMessage('ℹ️', args)),
  warn: (...args: LogArguments) => console.warn(...formatMessage('⚠️', args)),
  error: (...args: LogArguments) => console.error(...formatMessage('❌', args)),
};

export type Logger = typeof logger;
