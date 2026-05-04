import { Request, Response } from 'express';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import { prisma } from '../prisma';

export class AuthController {
  async login(req: Request, res: Response): Promise<Response | any> {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ error: 'E-mail e senha são obrigatórios.' });
    }

    try {
      const user = await prisma.user.findUnique({ where: { email } });

      if (!user) {
        return res.status(401).json({ error: 'Credenciais inválidas' });
      }

      const isValidPassword = await bcrypt.compare(password, user.password);

      if (!isValidPassword) {
        return res.status(401).json({ error: 'Credenciais inválidas' });
      }

      // Usamos (user as any) para forçar o TypeScript a ignorar a tipagem antiga
      const token = jwt.sign({ id: user.id, isAdmin: (user as any).isAdmin }, process.env.JWT_SECRET as string, {
        expiresIn: '7d',
      });

      // Remove a senha do objeto do usuário antes de enviar a resposta
      const { password: _, ...userWithoutPassword } = user;

      return res.json({ user: userWithoutPassword, token });
    } catch (error) {
      console.error('Erro detalhado no login:', error);
      return res.status(500).json({ error: 'Erro interno ao tentar fazer login.' });
    }
  }

    async register(req: Request, res: Response): Promise<Response | any> {
    const { email, password, name } = req.body;

    try {
      const hashedPassword = await bcrypt.hash(password, 10);

      // Salva o novo usuário no banco de dados via Prisma
      const newUser = await prisma.user.create({
        data: {
          email,
          password: hashedPassword,
          name,
          // Novos usuários criados pela API nunca são administradores por padrão
          isAdmin: false as any,
        } as any, // Ignora o erro de tipagem no objeto data
      });

      const { password: _, ...userWithoutPassword } = newUser;

      return res.status(201).json({ message: 'Usuário criado com sucesso!', user: userWithoutPassword });
    } catch (error) {
      console.error('Erro detalhado no registro:', error);
      return res.status(400).json({ error: 'Erro ao criar usuário. O e-mail pode já estar em uso.' });
    }
  }

}