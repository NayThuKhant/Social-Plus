const { createServer } = require("http");
const { parse } = require("url");
const next = require("next");
const { Server } = require("socket.io");

const dev = process.env.NODE_ENV !== "production";
const app = next({ dev });
const handle = app.getRequestHandler();

app.prepare().then(() => {
  const httpServer = createServer((req, res) => {
    const parsedUrl = parse(req.url, true);
    handle(req, res, parsedUrl);
  });

  const io = new Server(httpServer, {
    path: "/api/socketio",
    addTrailingSlash: false,
    cors: { origin: "*", credentials: true },
  });

  io.on("connection", (socket) => {
    socket.on("join-conversation", (conversationId) => {
      socket.join(conversationId);
    });

    socket.on("leave-conversation", (conversationId) => {
      socket.leave(conversationId);
    });

    // Personal room so the server can push notifications to a specific user
    socket.on("join-user", (userId) => {
      socket.join(`user:${userId}`);
    });

    socket.on("leave-user", (userId) => {
      socket.leave(`user:${userId}`);
    });

    // ── Call signaling ──────────────────────────────────────────────────────
    socket.on("call:invite", ({ targetUserId, callerId, callerName, callerAvatar, roomName, isVideo, conversationId }) => {
      io.to(`user:${targetUserId}`).emit("call:incoming", {
        callerId, callerName, callerAvatar, roomName, isVideo, conversationId,
      });
    });

    socket.on("call:accept", ({ callerId, calleeId }) => {
      io.to(`user:${callerId}`).emit("call:accepted");
      // Dismiss the ringing modal on every other tab/browser of the same callee account
      if (calleeId) socket.to(`user:${calleeId}`).emit("call:accepted-elsewhere");
    });

    socket.on("call:decline", ({ callerId, calleeId }) => {
      io.to(`user:${callerId}`).emit("call:declined");
      // Dismiss on callee's other tabs
      if (calleeId) socket.to(`user:${calleeId}`).emit("call:declined-elsewhere");
    });

    socket.on("call:end", ({ targetUserId }) => {
      io.to(`user:${targetUserId}`).emit("call:ended");
    });

    socket.on("call:group-invite", ({ targetUserIds, callerId, callerName, callerAvatar, groupName, groupAvatar, roomName, isVideo, conversationId }) => {
      if (!Array.isArray(targetUserIds)) return;
      for (const uid of targetUserIds) {
        io.to(`user:${uid}`).emit("call:incoming", {
          callerId, callerName, callerAvatar, roomName, isVideo, conversationId,
          isGroup: true, groupName, groupAvatar,
        });
      }
    });
  });

  // Make io available to Next.js API routes via global
  global._io = io;

  const port = parseInt(process.env.PORT || "3000", 10);
  httpServer.listen(port, () => {
    console.log(`> Ready on http://localhost:${port}`);
  });
});
