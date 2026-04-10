import { useState } from 'react';
import api from '../services/api';
import toast from 'react-hot-toast';

interface RegisterUserProps {
  token: string;
}

export default function RegisterUser({ token }: RegisterUserProps) {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    try {
      // Envia a requisição para a sua rota de registro no backend
      await api.post('/register', { name, email, password });
      toast.success(`Usuário ${name} criado com sucesso!`);
      setName('');
      setEmail('');
      setPassword('');
    } catch (error: any) {
      toast.error(error.response?.data?.error || 'Erro ao criar usuário.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="login-form" style={{ marginTop: '20px', maxWidth: '500px', marginLeft: 'auto', marginRight: 'auto' }}>
      <h2 style={{ marginTop: 0, color: 'var(--primary)', textAlign: 'center' }}>Criar Novo Usuário</h2>
      <p style={{ textAlign: 'center', marginBottom: '20px', color: '#aaa', fontSize: '14px' }}>Apenas administradores podem ver esta tela e criar novos acessos.</p>
      <form onSubmit={handleRegister} style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
        <label className="input-label">Nome:
          <input type="text" value={name} onChange={e => setName(e.target.value)} placeholder="Ex: Igão" required style={{ marginTop: '5px' }} />
        </label>
        <label className="input-label">E-mail:
          <input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="Ex: igao@sumasmovie.com" required style={{ marginTop: '5px' }} />
        </label>
        <label className="input-label">Senha:
          <input type="password" value={password} onChange={e => setPassword(e.target.value)} placeholder="Defina uma senha" required style={{ marginTop: '5px' }} />
        </label>
        
        <button type="submit" className="btn-success" style={{ marginTop: '15px' }} disabled={isLoading}>
          {isLoading ? 'Criando...' : 'Cadastrar Usuário'}
        </button>
      </form>
    </div>
  );
}