import { backupServer } from "./backup/BackupServer";
import { createHttpServer } from "./http/HttpServer";
import { createWebSocketServer } from "./webSocket/WebSocketServer";

const LastArgumentOnCommandLine = process.argv[process.argv.length - 1];

if (LastArgumentOnCommandLine === "retrieveAllFilesFromBackup") {
  backupServer
    .retrieveEverything()
    .then(() => {
      console.log("Exiting backup tool.");
      process.exit(0);
    })
    .catch((error) => {
      console.log(error);

      process.exit(1);
    });
} else if (LastArgumentOnCommandLine === "saveWorldAndConfigToBackup") {
  backupServer
    .saveWorldAndConfig()
    .then(() => {
      console.log("Exiting backup tool.");
      process.exit(0);
    })
    .catch((error) => {
      console.log(error);

      process.exit(1);
    });
} else {
  const httpServer = createHttpServer();

  setInterval(() => {
    backupServer.saveWorldAndConfig().catch(() => {
      // prevent unhandled exception
    });
  }, 4 * 60 * 1000); // every 4mn

  createWebSocketServer({ httpServer });
}
