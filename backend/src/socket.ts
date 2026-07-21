import { Server } from 'socket.io';
import http from 'http';
import jwt from 'jsonwebtoken';

let io: Server;

export function initSocket(server: http.Server, allowedOrigins: string[]) {
  io = new Server(server, {
    cors: {
      origin: allowedOrigins,
      methods: ["GET", "POST"]
    }
  });

  io.on('connection', (socket) => {
    // Autenticar o socket via token passado na query ou auth
    const token = socket.handshake.auth.token;
    if (token) {
      try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET || '123456789') as { id: number };
        // Coloca o usuário em uma "sala" única dele
        socket.join(`user_${decoded.id}`);
        console.log(`🔌 Usuário ${decoded.id} conectou via WebSocket`);
      } catch (err) {
        socket.disconnect();
      }
    } else {
      socket.disconnect();
    }
  });
}

export function getIO(): Server {
  if (!io) {
    throw new Error('Socket.io não inicializado!');
  }
  return io;
}
