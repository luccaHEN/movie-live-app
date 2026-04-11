import { useState, useEffect, useRef } from 'react';
import api from '../services/api';
import toast from 'react-hot-toast';

interface SettingsProps {
  token: string;
  user: any;
  setUser: (user: any) => void;
  streamerMode: boolean;
  setStreamerMode: (val: boolean) => void;
}

export default function Settings({ token, user, setUser, streamerMode, setStreamerMode }: SettingsProps) {
  const [name, setName] = useState('');
  const [avatar, setAvatar] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (user) {
      setName(user.name || '');
      setAvatar(user.avatar || '');
    }
  }, [user]);

  // Função para lidar com o upload e converter a imagem para Base64
  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      // Limite de segurança de 2MB para o tamanho da imagem no Banco de Dados
      if (file.size > 2 * 1024 * 1024) {
        toast.error('Por favor, escolha uma imagem de até 2MB.');
        return;
      }
      const reader = new FileReader();
      reader.onloadend = () => {
        setAvatar(reader.result as string); // Salva o Base64 no estado do avatar
      };
      reader.readAsDataURL(file);
    }
  };

  // Função para limpar a imagem/arquivo selecionado
  const handleClearImage = () => {
    setAvatar('');
    if (fileInputRef.current) {
      fileInputRef.current.value = ''; // Reseta o input de arquivo visualmente
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const response = await api.put('/profile', { name, avatar }, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setUser(response.data); // Atualiza o usuário global (o menu lateral vai mudar na hora)
      toast.success('Perfil atualizado com sucesso!');
    } catch (error) {
      toast.error('Erro ao atualizar o perfil.');
    }
  };

  return (
    <div className="login-form" style={{ marginTop: '20px' }}>
      <h2 style={{ marginTop: 0, color: 'var(--primary)', textAlign: 'center' }}>Meu Perfil</h2>
      <form onSubmit={handleSave} style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
        <label className="input-label">Nome de Exibição:
          <input type="text" value={name} onChange={e => setName(e.target.value)} placeholder="Ex: Joãozinho" style={{ marginTop: '5px' }} />
        </label>
        <label className="input-label">Foto de Perfil (URL ou Upload):
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginTop: '5px' }}>
            <input type="text" value={avatar} onChange={e => setAvatar(e.target.value)} placeholder="Cole a URL de uma imagem aqui..." />
            <span style={{ fontSize: '12px', textAlign: 'center', color: '#aaa', fontWeight: 'bold' }}>OU</span>
            {/* Input nativo de arquivo aceitando apenas imagens */}
            <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
              <input type="file" accept="image/*" ref={fileInputRef} onChange={handleImageUpload} style={{ fontSize: '14px', cursor: 'pointer', flex: 1 }} />
              <button type="button" onClick={handleClearImage} className="btn-secondary" style={{ padding: '6px 12px', fontSize: '12px', width: 'auto' }}>Limpar</button>
            </div>
          </div>
        </label>

        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 15px', border: '1px solid var(--input-border)', borderRadius: '8px', marginTop: '5px', backgroundColor: 'var(--bg-color)' }}>
          <div style={{ display: 'flex', flexDirection: 'column', textAlign: 'left', flex: 1, paddingRight: '15px' }}>
            <strong style={{ fontSize: '0.95rem', color: 'var(--text-color)' }}>Modo Streamer</strong>
            <span style={{ fontSize: '0.8rem', color: '#aaa', marginTop: '4px', lineHeight: '1.4' }}>Habilita campos de resgates, notas e agenda.</span>
          </div>
          <label className="checkbox-label" style={{ margin: 0, flexShrink: 0 }}>
            <input 
              type="checkbox" 
              checked={streamerMode} 
              onChange={(e) => {
                setStreamerMode(e.target.checked);
                localStorage.setItem('streamerMode', String(e.target.checked));
                toast.success(`Modo Streamer ${e.target.checked ? 'Ativado' : 'Desativado'}!`);
              }} 
            />
            <span className="toggle-switch"></span>
          </label>
        </div>
        
        {avatar && (
          <div style={{ textAlign: 'center', margin: '10px 0' }}>
            <p style={{ fontSize: '12px', color: '#aaa', margin: '0 0 5px 0' }}>Pré-visualização:</p>
            <img src={avatar} alt="Preview" className="user-avatar" style={{ marginBottom: 0 }} />
          </div>
        )}
        
        <button type="submit" className="btn-success" style={{ marginTop: '15px' }}>Salvar Alterações</button>
      </form>
    </div>
  );
}