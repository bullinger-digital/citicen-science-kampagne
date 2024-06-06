import pino from "pino";
import path from "path";

const dest = path.join(process.cwd(), "pino-logs/log.log");
console.log("Pino destination: ", dest);

export default pino({
  transport: {
    target: "pino/file",
    options: {
      destination: dest,
      mkdir: true,
    },
  },
});
