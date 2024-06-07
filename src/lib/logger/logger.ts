import pino from "pino";
import path from "path";
import os from "os";

const dest = path.join(process.cwd(), `pino-logs/log-${os.hostname()}.log`);
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
