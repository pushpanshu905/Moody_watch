const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const path = require("path");

const app = express();
const server = http.createServer(app);
const io = new Server(server);

app.use(express.static(path.join(__dirname, "public")));

const rooms = {};
const MAX_USERS = 4;

io.on("connection", (socket) => {
  console.log("User connected:", socket.id);

  socket.on("create-room", () => {
    const roomId = Math.random().toString(36).substring(2, 8).toUpperCase();
    rooms[roomId] = { users: [socket.id], video: "", playing: false, time: 0 };
    socket.join(roomId);
    socket.roomId = roomId;
    socket.emit("room-created", { roomId });
    console.log("Room created:", roomId);
  });

  socket.on("join-room", ({ roomId }) => {
    const room = rooms[roomId.toUpperCase()];

    if (!room) {
      socket.emit("error", { message: "Room not found! Check the code." });
      return;
    }

    // 4 user limit check
    if (room.users.length >= MAX_USERS) {
      socket.emit("error", { message: "⚠️ This room is full! Maximum 4 users allowed in free plan. Upgrade to Premium for ₹50 to add more!" });
      return;
    }

    room.users.push(socket.id);
    socket.join(roomId.toUpperCase());
    socket.roomId = roomId.toUpperCase();
    socket.emit("room-joined", { roomId: roomId.toUpperCase(), video: room.video, playing: room.playing, time: room.time });
    socket.to(roomId.toUpperCase()).emit("user-joined", { message: "A friend joined! 🎉" });
    
    // Warn if room is now full
    if (room.users.length === MAX_USERS) {
      io.to(roomId.toUpperCase()).emit("room-full", { message: "Room is now full! (4/4 users)" });
    }
  });

  socket.on("video-url", ({ roomId, url }) => {
    if (rooms[roomId]) rooms[roomId].video = url;
    socket.to(roomId).emit("video-url", { url });
  });

  socket.on("play", ({ roomId, time }) => {
    if (rooms[roomId]) { rooms[roomId].playing = true; rooms[roomId].time = time; }
    socket.to(roomId).emit("play", { time });
  });

  socket.on("pause", ({ roomId, time }) => {
    if (rooms[roomId]) { rooms[roomId].playing = false; rooms[roomId].time = time; }
    socket.to(roomId).emit("pause", { time });
  });

  socket.on("chat", ({ roomId, message, name }) => {
    socket.to(roomId).emit("chat", { message, name });
  });

  socket.on("reaction", ({ roomId, emoji }) => {
    socket.to(roomId).emit("reaction", { emoji });
  });

  socket.on("disconnect", () => {
    const roomId = socket.roomId;
    if (roomId && rooms[roomId]) {
      rooms[roomId].users = rooms[roomId].users.filter(id => id !== socket.id);
      socket.to(roomId).emit("user-left", { message: "Your friend left 😢" });
      if (rooms[roomId].users.length === 0) delete rooms[roomId];
    }
  });
});

server.listen(3000, () => {
  console.log("MoodWatch running at: http://localhost:3000");
});