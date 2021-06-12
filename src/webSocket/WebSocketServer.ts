import net from "net";
// eslint-disable-next-line node/no-deprecated-api
import { parse as urlParse } from "url";
import { IServerConfig, server as WebSocketServer } from "websocket";
import { MINECRAFT_SERVER_HOST, MINECRAFT_SERVER_PORT } from "../utils/Env";

export const createWebSocketServer = ({
  httpServer,
}: {
  httpServer: IServerConfig["httpServer"];
}) => {
  const webSocketServer = new WebSocketServer({
    autoAcceptConnections: false,
    httpServer,
  });

  return webSocketServer.on("request", (request) => {
    // eslint-disable-next-line deprecation/deprecation
    const url = urlParse(request.resource, true);

    const args = url.pathname?.split("/").slice(1) ?? [];

    const action = args.shift();

    if (action !== undefined && action !== "tunnel") {
      console.log(`Rejecting request for ${action} with 404`);

      request.reject(404);

      return;
    }

    console.log(
      `Trying to create a TCP to WebSocket tunnel for ${MINECRAFT_SERVER_HOST}:${MINECRAFT_SERVER_PORT}`
    );

    const webSocketConnection = request.accept();

    console.log(
      `${webSocketConnection.remoteAddress} connected - Protocol Version ${webSocketConnection.webSocketVersion}`
    );

    const tcpSocketConnection = new net.Socket();

    tcpSocketConnection.on("error", (err) => {
      webSocketConnection.send(
        JSON.stringify({
          details: `Upstream socket error; ${err.toString()}`,
          status: "error",
        })
      );
    });

    // eslint-disable-next-line @typescript-eslint/unbound-method
    tcpSocketConnection.on("data", webSocketConnection.send);

    // eslint-disable-next-line @typescript-eslint/unbound-method
    tcpSocketConnection.on("close", webSocketConnection.close);

    tcpSocketConnection.connect(
      MINECRAFT_SERVER_PORT,
      MINECRAFT_SERVER_HOST,
      () => {
        webSocketConnection.on("message", (msg) => {
          if (msg.type === "utf8") {
            console.log(`received utf-8 message: ${msg.utf8Data ?? "??"}`);

            return;
          }

          if (!msg.binaryData) {
            return;
          }

          return tcpSocketConnection.write(msg.binaryData);
        });

        console.log(
          `Upstream socket connected for ${webSocketConnection.remoteAddress}`
        );

        webSocketConnection.send(
          JSON.stringify({
            details: "Upstream socket connected",
            status: "ready",
          })
        );
      }
    );

    webSocketConnection.on("close", () => {
      tcpSocketConnection.destroy();

      console.log(`${webSocketConnection.remoteAddress} disconnected`);
    });
  });
};
