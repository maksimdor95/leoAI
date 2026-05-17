/* eslint-disable no-console */

type LogArguments = Array<unknown>;

export const logger = {
  info: (...args: LogArguments) => console.log('ℹ️', ...args),
  warn: (...args: LogArguments) => console.warn('⚠️', ...args),
  error: (...args: LogArguments) => console.error('❌', ...args),
};
