"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.saveGameResult = saveGameResult;
exports.getPlayerStats = getPlayerStats;
const redis_1 = require("./redis");
const REDIS_TIMEOUT = 2000; // 2 секунды
function withTimeout(promise, ms) {
    let timer;
    const timeout = new Promise((_, reject) => {
        timer = setTimeout(() => reject(new Error('Redis timeout')), ms);
    });
    return Promise.race([promise, timeout]).finally(() => clearTimeout(timer));
}
async function saveGameResult(result) {
    try {
        const hostKey = `okiya:stats:${result.players.host}`;
        const guestKey = `okiya:stats:${result.players.guest}`;
        const json = JSON.stringify(result);
        await withTimeout(redis_1.pubClient.lpush(hostKey, json), REDIS_TIMEOUT);
        await withTimeout(redis_1.pubClient.lpush(guestKey, json), REDIS_TIMEOUT);
        await withTimeout(redis_1.pubClient.ltrim(hostKey, 0, 99), REDIS_TIMEOUT);
        await withTimeout(redis_1.pubClient.ltrim(guestKey, 0, 99), REDIS_TIMEOUT);
    }
    catch (err) {
        console.error('saveGameResult failed (non‑critical):', err);
    }
}
async function getPlayerStats(playerId) {
    try {
        const key = `okiya:stats:${playerId}`;
        const data = await withTimeout(redis_1.pubClient.lrange(key, 0, 99), REDIS_TIMEOUT);
        const games = data.map((d) => JSON.parse(d));
        let wins = 0, draws = 0;
        games.forEach((g) => {
            const isHost = g.players.host === playerId;
            if (g.winner === 'draw')
                draws++;
            else if ((g.winner === 'host' && isHost) || (g.winner === 'guest' && !isHost))
                wins++;
        });
        return { games: games.length, wins, draws, history: games };
    }
    catch (err) {
        console.error('getPlayerStats failed, returning zeros:', err);
        return { games: 0, wins: 0, draws: 0, history: [] };
    }
}
