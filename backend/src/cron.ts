import cron from 'node-cron';
import axios from 'axios';
import { prisma } from './prisma';

export function initCronJobs() {
  // Roda todos os dias nos horários 00:00, 06:00, 12:00 e 18:00 no fuso de São Paulo
  // Para testar a cada minuto, mude para '* * * * *'
  cron.schedule('0 0,6,12,18 * * *', async () => {
    console.log('⏰ Rodando cron job de notificações...');
    try {
      const hojeStr = new Date().toISOString().split('T')[0];

      // 1. Encontra os filmes marcados para o dia de hoje que ainda não foram assistidos
      const filmesDeHoje = await prisma.movie.findMany({
        where: {
          watchDate: {
            gte: new Date(`${hojeStr}T00:00:00.000Z`),
            lt: new Date(`${hojeStr}T23:59:59.999Z`)
          },
          watched: false
        },
        include: { user: true } // Para sabermos de qual streamer é esse filme
      });

      for (const filme of filmesDeHoje) {
        const streamerName = filme.user.name;
        if (!streamerName) continue;

        // 2. Acha todo mundo (Viewers) que está seguindo o nick desse streamer
        const followers = await prisma.user.findMany({
          where: {
            followedStreamersList: { has: streamerName }
          }
        });

        if (followers.length === 0) continue;

        // Pegamos os Player IDs salvos no banco para enviar a notificação
        const playerIds = followers
          .map(f => f.oneSignalPlayerId)
          .filter((id): id is string => id != null && id !== '');
        if (playerIds.length === 0) continue;

        if (!process.env.ONESIGNAL_APP_ID || !process.env.ONESIGNAL_REST_API_KEY) {
          console.error('❌ ERRO FATAL: Chaves do OneSignal não encontradas no arquivo .env!');
          continue; // Pula para o próximo filme sem travar o servidor
        }

        const appId = process.env.ONESIGNAL_APP_ID.replace(/["']/g, '').trim();
        const apiKey = process.env.ONESIGNAL_REST_API_KEY.replace(/["']/g, '').trim();

        // 3. Dispara a notificação via OneSignal API
        await axios.post(
          'https://onesignal.com/api/v1/notifications',
          {
            app_id: appId,
            include_player_ids: playerIds,
            headings: { "en": "Sessão Pipoca! 🍿", "pt": "Sessão Pipoca! 🍿" },
            contents: { "en": `O filme de hoje de ${streamerName} é ${filme.title}!`, "pt": `O filme de hoje de ${streamerName} é ${filme.title}!` },
            data: { streamerName: streamerName, movieTitle: filme.title, isWatched: false }
          },
          { headers: { Authorization: `Basic ${apiKey}`, 'Accept': 'application/json', 'Content-Type': 'application/json' } }
        );
        console.log(`✅ Notificações enviadas para os seguidores de ${streamerName}`);
      }
    } catch (error: any) {
      console.error('❌ Erro no Cron Job de notificações:', error?.response?.data || error.message);
    }
  }, { scheduled: true, timezone: "America/Sao_Paulo" } as any);
}