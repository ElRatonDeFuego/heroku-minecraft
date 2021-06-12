import net from "net";
import { client as WebSocketClient, connection } from "websocket";

const Host = process.argv[2];

const Url = `ws://${Host}/tunnel`;

const localTcpServer = net.createServer((localConnectionFromTcpClient) => {
  const localWsClient = new WebSocketClient();
  let localConnectionToWsServer: connection | undefined;
  const buffer: Array<Buffer> = [];

  localConnectionFromTcpClient.on("data", (data) => {
    if (!localConnectionToWsServer || buffer.length > 0) {
      console.log(`Buffering TCP Data: ${data.toString()}`);

      buffer.push(data);

      return;
    }

    localConnectionToWsServer.send(data);
  });

  localConnectionFromTcpClient.on("close", () => {
    console.log("TCP socket closed");

    if (localConnectionToWsServer) {
      localConnectionToWsServer.close();

      return;
    }

    localConnectionToWsServer = undefined;
  });

  localWsClient.on("connect", (connectionToWsServer) => {
    console.log("WebSocket connected");

    localConnectionToWsServer = connectionToWsServer;

    while (buffer.length > 0) {
      const data = buffer.shift();

      if (data) {
        console.log(
          `Flushing buffered data over WebSocket: ${data.toString()}`
        );
        localConnectionToWsServer.send(data);
      }
    }

    // eslint-disable-next-line no-null/no-null
    if (localConnectionFromTcpClient === null) {
      localConnectionToWsServer.close();

      return;
    }

    localConnectionToWsServer.on("message", (msg) => {
      if (msg.type === "utf8") {
        if (msg.utf8Data !== undefined) {
          const data = JSON.parse(msg.utf8Data) as {
            details: unknown;
            status: string;
          };

          if (data.status === "error") {
            console.log(data.details);
            console.log("Closing WebSocket because of an error");

            localConnectionToWsServer?.close();
          }
        }
      } else if (msg.binaryData) {
        localConnectionFromTcpClient.write(msg.binaryData);
      }
    });

    return localConnectionToWsServer.on("close", (reasonCode, description) => {
      console.log(`WebSocket closed: ${reasonCode} - ${description}`);

      localConnectionFromTcpClient.destroy();
    });
  });

  localWsClient.on("connectFailed", (err) => {
    console.log(`WebSocket connection failed: ${err.toString()}`);

    localConnectionFromTcpClient.destroy();
  });

  console.log(`Attempting to open WebSockets connection to ${Url}`);

  localWsClient.connect(Url);
});

localTcpServer.on("error", (err: Error) => {
  console.log(`Local Error: ${err.toString()}`);
});

localTcpServer.listen(25565, "0.0.0.0", () => {
  const addr = localTcpServer.address();

  // eslint-disable-next-line no-null/no-null
  if (addr !== null && typeof addr !== "string") {
    console.log(`TCP server listening on ${addr.address}:${addr.port}`);
  }
});
