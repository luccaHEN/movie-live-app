import { Request, Response } from 'express';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import { prisma } from '../prisma';

export class AuthController {
  async login(req: Request, res: Response): Promise<Response | any> {
    const { email, password } = req.body;

    const user = await prisma.user.findUnique({ where: { email } });

    if (!user) {
      return res.status(401).json({ error: 'Credenciais inválidas' });
    }

    const isValidPassword = await bcrypt.compare(password, user.password);

    if (!isValidPassword) {
      return res.status(401).json({ error: 'Credenciais inválidas' });
    }

    const token = jwt.sign({ id: user.id }, process.env.JWT_SECRET as string, {
      expiresIn: '7d',
    });

    return res.json({ user: { id: user.id, email: user.email }, token });
  }

    async register(req: Request, res: Response): Promise<Response | any> {
    const { email, password } = req.body;

    try {
      const hashedPassword = await bcrypt.hash(password, 10);

      // Salva o novo usuário no banco de dados via Prisma
      const user = await prisma.user.create({
        data: {
          email,
          password: hashedPassword,
        },
      });

      return res.status(201).json({ 
        message: 'Usuário criado com sucesso!', 
        user: { id: user.id, email: user.email } 
      });
    } catch (error) {
      console.error('Erro detalhado no registro:', error);
      return res.status(400).json({ error: 'Erro ao criar usuário. O e-mail pode já estar em uso.' });
    }
  }

}