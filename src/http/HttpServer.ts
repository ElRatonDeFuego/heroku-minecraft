import http from "http";
import { WEBSERVER_PORT } from "../utils/Env";

export const createHttpServer = () => {
  const httpServer = http.createServer((request, response) => {
    console.log(`Received request for ${request.url ?? "??"}`);

    response.writeHead(404, {
      "Content-Type": "text/plain",
    });

    response.end("This is not exactly an HTTP server.\n");
  });

  httpServer.listen(WEBSERVER_PORT, () => {
    console.log(`Socket proxy server is listening on port ${WEBSERVER_PORT}`);
  });

  return httpServer;
};
