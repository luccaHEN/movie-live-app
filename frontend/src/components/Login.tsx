import { useState } from 'react';
import api from '../services/api';
import toast from 'react-hot-toast';
import bgImage from '../assets/login.jpg';
// Salve suas imagens na pasta src/assets e importe elas aqui:
import print1 from '../assets/print1.png'; // Substitua pelo nome real da sua imagem
import print2 from '../assets/print2.png';
import print3 from '../assets/print3.png';

interface LoginProps {
  onLoginSuccess: (token: string) => void;
}

export default function Login({ onLoginSuccess }: LoginProps) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [selectedImage, setSelectedImage] = useState<string | null>(null);

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
    <div style={{ height: '100vh', overflowY: 'auto', scrollBehavior: 'smooth' }}>
      {/* Menu de Navegação Fixo */}
      <nav style={{ position: 'fixed', top: 0, left: 0, right: 0, padding: '20px 5%', display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between', alignItems: 'center', background: 'rgba(10, 10, 10, 0.9)', backdropFilter: 'blur(10px)', zIndex: 1000, borderBottom: '1px solid #333' }}>
        <img src="/seal.png" alt="Sumasflix" style={{ height: '40px', objectFit: 'contain' }} />
        <div style={{ display: 'flex', gap: '30px' }}>
          <a href="#inicio" className="nav-link">Início</a>
          <a href="#prints" className="nav-link">Apresentação</a>
        </div>
      </nav>

      {/* Seção Principal de Início */}
      <div id="inicio" className="landing-wrapper" style={{ backgroundImage: `url(${bgImage})`, backgroundSize: 'cover', backgroundPosition: 'center', backgroundAttachment: 'fixed' }}>
        <div className="landing-container" style={{ marginTop: '50px' }}>
        
        {/* Lado Esquerdo - Apresentação (Visível para o Público) */}
        <div className="landing-features">
          <h1 style={{ color: 'var(--primary)', fontSize: '3rem', marginBottom: '10px', marginTop: 0, textTransform: 'uppercase', letterSpacing: '2px', textShadow: '2px 2px 4px rgba(0,0,0,0.5)' }}>Sumasflix</h1>
          <p style={{ color: '#ccc', fontSize: '1.1rem', marginBottom: '30px', lineHeight: '1.5' }}>
            A plataforma definitiva para organizar sessões de filmes de streamers. Acompanhe, interaja e decida o que assistir com o seu chat.
          </p>
          
          <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: '20px' }}>
            <li style={{ display: 'flex', alignItems: 'center', gap: '15px', fontSize: '1.05rem', color: '#e5e5e5' }}>
              <span style={{ fontSize: '1.8rem', width: '35px', textAlign: 'center' }}>🎬</span> <span>Busca de catálogo avançada via integração <strong>TMDB</strong></span>
            </li>
            <li style={{ display: 'flex', alignItems: 'center', gap: '15px', fontSize: '1.05rem', color: '#e5e5e5' }}>
              <span style={{ fontSize: '1.8rem', width: '35px', textAlign: 'center' }}>🍿</span> <span>Organização de <strong>Meus Filmes</strong> com filtros, ordenação e status</span>
            </li>
            <li style={{ display: 'flex', alignItems: 'center', gap: '15px', fontSize: '1.05rem', color: '#e5e5e5' }}>
              <span style={{ fontSize: '1.8rem', width: '35px', textAlign: 'center' }}>🏆</span> <span>Pódio de resgates, métricas e <strong>Hall da Fama</strong></span>
            </li>
            <li style={{ display: 'flex', alignItems: 'center', gap: '15px', fontSize: '1.05rem', color: '#e5e5e5' }}>
              <span style={{ fontSize: '1.8rem', width: '35px', textAlign: 'center' }}>🚀</span> <span><strong>Listas públicas</strong> (URL) para os espectadores acompanharem a programação</span>
            </li>
          </ul>
        </div>

        {/* Lado Direito - Login (Acesso Restrito) */}
        <div className="landing-login">
          <h2 style={{ marginTop: 0, color: '#fff', textAlign: 'center', marginBottom: '10px' }}>Acesso Restrito</h2>
          <p style={{ textAlign: 'center', color: '#888', fontSize: '0.85rem', marginBottom: '25px', lineHeight: '1.4' }}>
            Apenas administradores podem convidar novos usuários. Se você já tem uma conta, faça o login abaixo.
          </p>
          
          <form onSubmit={handleLogin} style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
            <input type="email" placeholder="Seu e-mail cadastrado" value={email} onChange={e => setEmail(e.target.value)} required style={{ padding: '12px' }} />
            <input type="password" placeholder="Sua senha secreta" value={password} onChange={e => setPassword(e.target.value)} required style={{ padding: '12px' }} />
            <button type="submit" className="btn-primary" style={{ padding: '12px', fontSize: '16px', marginTop: '10px', width: '100%' }}>
              Entrar no Painel
            </button>
          </form>
        </div>
        
        </div>
      </div>

      {/* Seção de Prints da Aplicação (Vitrine) */}
      <div id="prints" style={{ minHeight: '100vh', padding: '100px 5%', backgroundColor: 'var(--bg-color)', position: 'relative', zIndex: 2, display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
        <h2 style={{ color: 'var(--primary)', fontSize: '2.5rem', marginBottom: '15px', textTransform: 'uppercase', letterSpacing: '1px', textAlign: 'center' }}>Por dentro do App</h2>
        <p style={{ color: '#aaa', fontSize: '1.1rem', marginBottom: '50px', maxWidth: '800px', textAlign: 'center', lineHeight: '1.5' }}>Confira algumas capturas de tela mostrando as principais funcionalidades e a interface da plataforma em ação.</p>
        
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(400px, 1fr))', gap: '40px', width: '100%', maxWidth: '1400px' }}>
          <img src={print1} alt="Print 1 - Dashboard" onClick={() => setSelectedImage(print1)} style={{ width: '100%', borderRadius: '12px', boxShadow: '0 10px 20px rgba(0,0,0,0.5)', border: '1px solid #333', cursor: 'pointer', transition: 'transform 0.2s' }} onMouseEnter={e => e.currentTarget.style.transform = 'scale(1.03)'} onMouseLeave={e => e.currentTarget.style.transform = 'scale(1)'} />
          <img src={print2} alt="Print 2 - Roleta" onClick={() => setSelectedImage(print2)} style={{ width: '100%', borderRadius: '12px', boxShadow: '0 10px 20px rgba(0,0,0,0.5)', border: '1px solid #333', cursor: 'pointer', transition: 'transform 0.2s' }} onMouseEnter={e => e.currentTarget.style.transform = 'scale(1.03)'} onMouseLeave={e => e.currentTarget.style.transform = 'scale(1)'} />
          <img src={print3} alt="Print 3 - Hall da Fama" onClick={() => setSelectedImage(print3)} style={{ width: '100%', borderRadius: '12px', boxShadow: '0 10px 20px rgba(0,0,0,0.5)', border: '1px solid #333', cursor: 'pointer', transition: 'transform 0.2s' }} onMouseEnter={e => e.currentTarget.style.transform = 'scale(1.03)'} onMouseLeave={e => e.currentTarget.style.transform = 'scale(1)'} />
        </div>
      </div>

      {/* Modal / Lightbox para ver as imagens em tela cheia */}
      {selectedImage && (
        <div style={{ position: 'fixed', top: 0, left: 0, width: '100vw', height: '100vh', backgroundColor: 'rgba(0,0,0,0.85)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 9999, cursor: 'zoom-out', backdropFilter: 'blur(5px)' }} onClick={() => setSelectedImage(null)}>
          <img src={selectedImage} alt="Fullscreen View" style={{ maxWidth: '90%', maxHeight: '90%', borderRadius: '12px', boxShadow: '0 10px 40px rgba(0,0,0,0.8)', objectFit: 'contain', cursor: 'default' }} onClick={e => e.stopPropagation()} />
          <button onClick={() => setSelectedImage(null)} style={{ position: 'absolute', top: '20px', right: '30px', background: 'rgba(0,0,0,0.5)', border: 'none', color: '#fff', fontSize: '2.5rem', cursor: 'pointer', width: '50px', height: '50px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'background 0.2s' }} onMouseEnter={e => e.currentTarget.style.backgroundColor = 'rgba(255,255,255,0.2)'} onMouseLeave={e => e.currentTarget.style.backgroundColor = 'rgba(0,0,0,0.5)'}>&times;</button>
        </div>
      )}
    </div>
  );
}