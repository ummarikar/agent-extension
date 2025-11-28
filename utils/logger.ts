import pino from "pino";

const isDevelopment = import.meta.env.MODE === "development";
export const logger = pino({});
// export const logger = pino({
//   level: isDevelopment ? 'debug' : 'error',
//   browser: {
//     asObject: false,
//     write: {
//       debug: (...args) => console.log(...args),
//       info: (...args) => console.info(...args),
//       warn: (...args) => console.warn(...args),
//       error: (...args) => console.error(...args),
//     },
//   },
// });
