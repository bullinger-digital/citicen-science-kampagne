import pino from "pino";

export default pino({
  transport: {
    target: "pino/file",
    options: {
      destination: "./pino-logs/log.log",
      mkdir: true,
    },
  },
});
