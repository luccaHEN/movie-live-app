import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';

interface TokenPayload {
  id: number;
  isAdmin: boolean;
  iat: number;
  exp: number;
}

export function isAuthenticated(req: Request, res: Response, next: NextFunction): void | Response | any {
  const { authorization } = req.headers;

  if (!authorization) {
    return res.status(401).json({ error: 'Token não fornecido.' });
  }

  const [, token] = authorization.split(' ');

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET as string);
    const { id, isAdmin } = decoded as TokenPayload;
    
    (req as any).userId = id;
    (req as any).userIsAdmin = isAdmin;
    
    return next();
  } catch (error) {
    return res.status(401).json({ error: 'Token inválido ou expirado.' });
  }
}

export function isAdministrator(req: Request, res: Response, next: NextFunction): void | Response | any {
  if (!(req as any).userIsAdmin) {
    return res.status(403).json({ error: 'Acesso negado. Requer privilégios de administrador.' });
  }
  return next();
}
