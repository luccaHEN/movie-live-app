import tmi from 'tmi.js';
import { prisma } from '../prisma';
import { getIO } from '../socket';

interface VoteSession {
  movieId: number;
  channel: string;
  votes: Map<string, number>;  // twitchUsername -> rating (0-10)
  client: tmi.Client;
  startedAt: Date;
  timeout: NodeJS.Timeout;
}

// Map of userId -> active VoteSession
const activeSessions = new Map<number, VoteSession>();

export async function startVoting(userId: number, movieId: number, twitchChannel: string): Promise<{ success: boolean; error?: string }> {
  // Verifica se já existe uma votação ativa para este usuário
  if (activeSessions.has(userId)) {
    return { success: false, error: 'Já existe uma votação ativa. Encerre a atual primeiro.' };
  }

  // Cria o cliente tmi.js
  const clientOptions: tmi.Options = {
    channels: [twitchChannel]
  };

  // Se o usuário tiver configurado o robô no .env, usamos a identidade para ele poder falar
  if (process.env.TWITCH_BOT_USERNAME && process.env.TWITCH_BOT_TOKEN) {
    clientOptions.identity = {
      username: process.env.TWITCH_BOT_USERNAME,
      password: process.env.TWITCH_BOT_TOKEN
    };
  }

  const client = new tmi.Client(clientOptions);

  const votes = new Map<string, number>();

  // Escuta as mensagens
  client.on('message', (channel, tags, message, self) => {
    if (self) return;
    const trimmed = message.trim().toLowerCase();
    // Procura por !nota seguido por um número
    const match = trimmed.match(/^!nota\s+(\d+([.,]\d{1,2})?)$/);
    if (!match) return;
    
    let rating = parseFloat(match[1].replace(',', '.'));
    if (isNaN(rating) || rating < 0 || rating > 10) return;
    
    // Arredonda a nota para intervalos de 0.5 (ex: 8.2 vira 8.0, 8.3 vira 8.5)
    // Isso é essencial para que o cálculo de "Nota Mais Votada" consiga agrupar os votos quebrados
    rating = Math.round(rating * 2) / 2;
    
    const username = tags['display-name'] || tags.username || 'anonymous';
    // Cada espectador só pode votar uma vez (o último voto prevalece)
    votes.set(username, rating);

    // Avisa o frontend instantaneamente!
    try {
      const io = getIO();
      const votesObj: Record<string, number> = {};
      votes.forEach((val, key) => { votesObj[key] = val; });
      io.to(`user_${userId}`).emit('voteUpdate', { totalVotes: votes.size, votes: votesObj });
    } catch (e) {
      // Ignora erro se socket não estiver pronto
    }
  });

  try {
    await client.connect();
    
    // Se o bot estiver logado, ele avisa no chat
    if (process.env.TWITCH_BOT_USERNAME) {
      const movie = await prisma.movie.findUnique({ where: { id: movieId } });
      const movieTitle = movie ? movie.title : 'o filme';
      client.action(twitchChannel, `📣 Votação aberta para: ${movieTitle.toUpperCase()}! Digite !nota seguido de um número (ex: !nota 8.5) para votar.`);
    }
  } catch (err) {
    return { success: false, error: 'Não foi possível conectar ao canal da Twitch. Verifique o nome do canal.' };
  }

  // Trava de segurança: Auto-encerra após 3 minutos
  const timeout = setTimeout(async () => {
    const result = await stopVoting(userId);
    if (result.success && result.average !== null && result.movieId) {
      try {
        await prisma.movie.update({
          where: { id: result.movieId },
          data: { chatRating: result.average }
        });
      } catch (e) { console.error('Erro no auto-save:', e); }
    }
    try {
      const io = getIO();
      io.to(`user_${userId}`).emit('voteClosed', result);
    } catch(e) {}
  }, 3 * 60 * 1000);

  activeSessions.set(userId, {
    movieId,
    channel: twitchChannel,
    votes,
    client,
    startedAt: new Date(),
    timeout
  });

  return { success: true };
}

export async function stopVoting(userId: number): Promise<{ success: boolean; average: number | null; totalVotes: number; votes?: Record<string, number>; error?: string; movieId?: number }> {
  const session = activeSessions.get(userId);
  if (!session) {
    return { success: false, average: null, totalVotes: 0, error: 'Nenhuma votação ativa encontrada.' };
  }

  // Cancela o timeout de segurança
  clearTimeout(session.timeout);

  // Calcula a nota mais votada (Moda) em vez da média
  const voteValues = Array.from(session.votes.values());
  const totalVotes = voteValues.length;
  let average: number | null = null; // Mantemos o nome 'average' para não quebrar a API, mas será a moda

  if (totalVotes > 0) {
    const frequency: Record<number, number> = {};
    let maxFreq = 0;
    
    voteValues.forEach(val => {
      frequency[val] = (frequency[val] || 0) + 1;
      if (frequency[val] > maxFreq) {
        maxFreq = frequency[val];
      }
    });

    // Encontra as notas mais frequentes
    const mostVotedNotes = Object.keys(frequency)
      .map(Number)
      .filter(val => frequency[val] === maxFreq);
    
    // Em caso de empate, faz a média das notas empatadas
    if (mostVotedNotes.length === 1) {
      average = mostVotedNotes[0];
    } else {
      const sum = mostVotedNotes.reduce((a, b) => a + b, 0);
      average = parseFloat((sum / mostVotedNotes.length).toFixed(2));
    }
  }

  // Se o bot estiver logado e teve votos, avisa o resultado no chat ANTES de desconectar
  if (process.env.TWITCH_BOT_USERNAME && average !== null) {
    session.client.action(session.channel, `📣 Votação encerrada! A nota final dada pelo chat foi: ${average.toFixed(1)}`);
  }

  // Desconecta da Twitch
  try {
    await session.client.disconnect();
  } catch (e) {
    // ignora erros de desconexão
  }

  // Converte o mapa de votos para um objeto simples para a resposta
  const votesObj: Record<string, number> = {};
  session.votes.forEach((val, key) => { votesObj[key] = val; });

  const movieId = session.movieId;

  // Remove a sessão
  activeSessions.delete(userId);

  return { success: true, average, totalVotes, votes: votesObj, movieId };
}

export function getVotingStatus(userId: number): { active: boolean; movieId?: number; channel?: string; totalVotes?: number; startedAt?: Date; votes?: Record<string, number> } {
  const session = activeSessions.get(userId);
  if (!session) {
    return { active: false };
  }
  
  const votesObj: Record<string, number> = {};
  session.votes.forEach((val, key) => { votesObj[key] = val; });

  return {
    active: true,
    movieId: session.movieId,
    channel: session.channel,
    totalVotes: session.votes.size,
    startedAt: session.startedAt,
    votes: votesObj
  };
}
