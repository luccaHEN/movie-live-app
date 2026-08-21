"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.initSocket = initSocket;
exports.getIO = getIO;
const socket_io_1 = require("socket.io");
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
let io;
function initSocket(server, allowedOrigins) {
    io = new socket_io_1.Server(server, {
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
                const decoded = jsonwebtoken_1.default.verify(token, process.env.JWT_SECRET);
                // Coloca o usuário em uma "sala" única dele
                socket.join(`user_${decoded.id}`);
                console.log(`🔌 Usuário ${decoded.id} conectou via WebSocket`);
            }
            catch (err) {
                socket.disconnect();
            }
        }
        else {
            socket.disconnect();
        }
    });
}
function getIO() {
    if (!io) {
        throw new Error('Socket.io não inicializado!');
    }
    return io;
}
