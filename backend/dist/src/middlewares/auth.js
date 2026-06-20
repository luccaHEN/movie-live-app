"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.isAuthenticated = isAuthenticated;
exports.isAdministrator = isAdministrator;
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
function isAuthenticated(req, res, next) {
    const { authorization } = req.headers;
    if (!authorization) {
        return res.status(401).json({ error: 'Token não fornecido.' });
    }
    const [, token] = authorization.split(' ');
    try {
        const decoded = jsonwebtoken_1.default.verify(token, process.env.JWT_SECRET);
        const { id, isAdmin } = decoded;
        req.userId = id;
        req.userIsAdmin = isAdmin;
        return next();
    }
    catch (error) {
        return res.status(401).json({ error: 'Token inválido ou expirado.' });
    }
}
function isAdministrator(req, res, next) {
    if (!req.userIsAdmin) {
        return res.status(403).json({ error: 'Acesso negado. Requer privilégios de administrador.' });
    }
    return next();
}
