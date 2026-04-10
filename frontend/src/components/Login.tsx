import { useState } from 'react';
import api from '../services/api';
import toast from 'react-hot-toast';
import bgImage from '../assets/sumiugemeos.png';

interface LoginProps {
  onLoginSuccess: (token: string) => void;
}

export default function Login({ onLoginSuccess }: LoginProps) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const response = await api.post('/login', { email, password });
      const { token } = response.data;
      localStorage.setItem('token', token);
      toast.success('Login realizado com sucesso!');
      onLoginSuccess(token); // Avisa o App.tsx que o login deu certo!
    } catch (error: any) {
      const errorMessage = error.response?.data?.error || 'Erro ao conectar com o servidor.';
      toast.error(errorMessage);
    }
  };

  return (
    <div 
      className="login-container"
      style={{
        backgroundImage: `linear-gradient(rgba(0, 0, 0, 0.6), rgba(0, 0, 0, 0.6)), url(${bgImage})`,
        backgroundSize: 'cover',
        backgroundPosition: '40% 40%',
        backgroundRepeat: 'no-repeat',
        minHeight: '100vh'
      }}
    >
      <h1 className="app-title" style={{ marginBottom: '40px' }}>Sealflix</h1>
      
      <form onSubmit={handleLogin} className="login-form">
        <input type="email" placeholder="Digite seu email" value={email} onChange={e => setEmail(e.target.value)} required />
        <input type="password" placeholder="Digite sua senha" value={password} onChange={e => setPassword(e.target.value)} required />
        <button type="submit" className="btn-primary" style={{ padding: '12px', fontSize: '16px', marginTop: '10px' }}>
          Entrar
        </button>
      </form>
    </div>
  );
}