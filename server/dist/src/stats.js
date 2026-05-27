"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.saveGameResult = saveGameResult;
exports.getPlayerStats = getPlayerStats;
const redis_1 = require("./redis");
async function saveGameResult(result) {
    const hostKey = `okiya:stats:${result.players.host}`;
    const guestKey = `okiya:stats:${result.players.guest}`;
    const json = JSON.stringify(result);
    await redis_1.pubClient.lpush(hostKey, json);
    await redis_1.pubClient.lpush(guestKey, json);
    await redis_1.pubClient.ltrim(hostKey, 0, 99);
    await redis_1.pubClient.ltrim(guestKey, 0, 99);
}
async function getPlayerStats(playerId) {
    const key = `okiya:stats:${playerId}`;
    const data = await redis_1.pubClient.lrange(key, 0, 99);
    const games = data.map((d) => JSON.parse(d));
    let wins = 0, draws = 0;
    games.forEach((g) => {
        const isHost = g.players.host === playerId;
        if (g.winner === 'draw')
            draws++;
        else if ((g.winner === 'host' && isHost) ||
            (g.winner === 'guest' && !isHost))
            wins++;
    });
    return { games: games.length, wins, draws, history: games };
}
