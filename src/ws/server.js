import { WebSocket, WebSocketServer } from "ws";
import { wsArcJet } from "../arcjet.js";

function sendJson(socket, payload) {
  if (socket.readyState != WebSocket.OPEN) {
    return;
  }

  socket.send(JSON.stringify(payload));
}

function broadCast(wss, payload) {
  for (const client of wss.clients) {
    if (client.readyState != WebSocket.OPEN) {
      continue;
    }

    client.send(JSON.stringify(payload));
  }
}

function rejectUpgrade(socket, statusCode, statusMessage) {
  socket.write(
    `HTTP/1.1 ${statusCode} ${statusMessage}\r\n` +
      "Connection: close\r\n" +
      "\r\n"
  );
  socket.destroy();
}

export function attachWebSocketServer(server) {
  // noServer: true — we handle the upgrade ourselves below,
  // so ws doesn't auto-attach to the server's 'upgrade' event.
  const wss = new WebSocketServer({
    noServer: true,
    maxPayload: 1024 * 1024,
  });

  server.on("upgrade", async (req, socket, head) => {
    const { pathname } = new URL(req.url, `http://${req.headers.host}`);

    if (pathname !== "/ws") {
      return rejectUpgrade(socket, 404, "Not Found");
    }

    if (wsArcJet) {
      try {
        const decision = await wsArcJet.protect(req);

        if (decision.isDenied()) {
          if (decision.reason.isRateLimit()) {
            return rejectUpgrade(socket, 429, "Too Many Requests");
          }
          return rejectUpgrade(socket, 403, "Forbidden");
        }
      } catch (e) {
        console.error("WS upgrade error", e);
        return rejectUpgrade(socket, 503, "Service Unavailable");
      }
    }

    wss.handleUpgrade(req, socket, head, (ws) => {
      wss.emit("connection", ws, req);
    });
  });

  wss.on("connection", (socket) => {
    socket.isAlive = true;
    socket.on("pong", () => {
      socket.isAlive = true;
    });

    sendJson(socket, { type: "welcome" });
    socket.on("error", console.error);
  });

  const interval = setInterval(() => {
    wss.clients.forEach((ws) => {
      if (ws.isAlive === false) return ws.terminate();
      ws.isAlive = false;
      ws.ping();
    });
  }, 3000);

  wss.on("close", () => clearInterval(interval));

  function broadcastMatchCreated(match) {
    broadCast(wss, { type: "match_created", data: match });
  }

  return { broadcastMatchCreated };
}