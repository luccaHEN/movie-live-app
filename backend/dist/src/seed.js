"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const bcrypt_1 = __importDefault(require("bcrypt"));
const fs_1 = __importDefault(require("fs"));
const path_1 = __importDefault(require("path"));
const csv_parser_1 = __importDefault(require("csv-parser"));
const prisma_1 = require("./prisma");
// ID DO USUÁRIO ESTIPULADO
const USER_ID = 4;
const TMDB_TOKEN = process.env.TMDB_TOKEN;
async function searchTMDB(title) {
    if (!TMDB_TOKEN)
        return null;
    try {
        // Limpa o título para melhorar a busca no TMDB (remove sufixos do CSV e caracteres quebrados)
        const cleanTitle = title
            .split(/ 1\/2\/3| 1 e 2| 1 e 3| \(Saga\)| \(Trilogia\)/i)[0]
            .replace(/\uFFFD/g, '')
            .trim();
        const response = await fetch(`https://api.themoviedb.org/3/search/movie?language=pt-BR&query=${encodeURIComponent(cleanTitle)}`, {
            headers: {
                Authorization: `Bearer ${TMDB_TOKEN}`,
                accept: 'application/json'
            }
        });
        const data = await response.json();
        if (data.results && data.results.length > 0) {
            const movie = data.results[0]; // Pega o primeiro resultado (mais relevante)
            return {
                tmdbId: movie.id,
                poster: movie.poster_path
            };
        }
    }
    catch (error) {
        console.error(`❌ Erro ao buscar ${title} no TMDB:`, error);
    }
    return null;
}
async function main() {
    // 1. GERAÇÃO/VERIFICAÇÃO DO ADMIN
    const adminEmail = process.env.ADMIN_EMAIL || 'admin@sumasmovie.com';
    const adminPassword = process.env.ADMIN_PASSWORD;
    if (!adminPassword) {
        console.error('❌ ERRO: A variável ADMIN_PASSWORD não está definida no arquivo .env');
        process.exit(1);
    }
    // Gera o hash da senha (nunca salve em texto puro!)
    const hashedPassword = await bcrypt_1.default.hash(adminPassword, 10);
    const admin = await prisma_1.prisma.user.upsert({
        where: { email: adminEmail },
        update: { password: hashedPassword, isAdmin: true },
        create: {
            email: adminEmail,
            password: hashedPassword,
            name: 'Igão',
            isAdmin: true,
        },
    });
    console.log('✅ Usuário Admin criado/verificado:', admin.email);
    // 2. INJEÇÃO DOS FILMES DO CSV
    if (!TMDB_TOKEN) {
        console.error('❌ ERRO: TMDB_TOKEN não encontrada no arquivo .env do backend.');
        console.error('O script foi abortado para evitar salvar os filmes sem capa no banco.');
        process.exit(1);
    }
    console.log('🗑️ Apagando todos os filmes antigos do banco de dados...');
    await prisma_1.prisma.movie.deleteMany();
    console.log('✅ Banco de dados limpo com sucesso!');
    const results = [];
    const csvPath = path_1.default.resolve(__dirname, '../movies_seed.csv');
    if (fs_1.default.existsSync(csvPath)) {
        console.log('Lendo o arquivo CSV e iniciando buscas no TMDB...');
        await new Promise((resolve, reject) => {
            fs_1.default.createReadStream(csvPath)
                .pipe((0, csv_parser_1.default)())
                .on('data', (data) => results.push(data))
                .on('error', reject)
                .on('end', async () => {
                console.log(`🎬 Foram encontrados ${results.length} filmes. Importando para o UserID: ${USER_ID}...`);
                for (const row of results) {
                    const tmdbData = await searchTMDB(row.title);
                    let finalTmdbId = tmdbData?.tmdbId || null;
                    let finalPoster = tmdbData?.poster || null;
                    // Se o filme foi encontrado, garante que esse ID já não foi salvo antes para evitar Crash (Unique Constraint)
                    if (finalTmdbId) {
                        const existingMovie = await prisma_1.prisma.movie.findFirst({
                            where: { tmdbId: finalTmdbId, userId: USER_ID }
                        });
                        if (existingMovie) {
                            console.log(`⚠️ Conflito no filme "${row.title}". O ID do TMDB retornado já foi salvo antes. Inserindo sem o ID para evitar erro, mas mantendo a capa.`);
                            finalTmdbId = null;
                        }
                    }
                    await prisma_1.prisma.movie.create({
                        data: {
                            title: row.title,
                            watched: row.watched === 'true',
                            watchDate: row.watchDate ? new Date(row.watchDate) : null,
                            streamerRating: row.streamerRating && row.streamerRating !== 'NaN' ? parseFloat(row.streamerRating) : null,
                            chatRating: row.chatRating && row.chatRating !== 'NaN' ? parseFloat(row.chatRating) : null,
                            requestedBy: row.requestedBy || null,
                            userId: USER_ID,
                            tmdbId: finalTmdbId,
                            poster: finalPoster,
                        }
                    });
                    console.log(`Filme "${row.title}" inserido! ${tmdbData ? '✅ TMDB Encontrado' : '❌ TMDB Não Encontrado'}`);
                    // Pequeno delay (250ms) entre buscas para não tomar bloqueio (Rate Limit) da API do TMDB
                    await new Promise(r => setTimeout(r, 250));
                }
                console.log('🎉 Seed de filmes finalizado com sucesso!');
                resolve();
            });
        });
    }
}
main().catch(e => { console.error(e); process.exit(1); }).finally(async () => { await prisma_1.prisma.$disconnect(); });
