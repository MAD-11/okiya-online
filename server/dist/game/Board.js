"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.createTiles = createTiles;
exports.initBoard = initBoard;
exports.isValidMove = isValidMove;
exports.checkWin = checkWin;
const PLANTS = ['sakura', 'iris', 'pine', 'maple'];
const SYMBOLS = ['sun', 'bird', 'rain', 'tanzaku'];
function shuffle(arr) {
    const a = [...arr];
    for (let i = a.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
}
function createTiles() {
    const tiles = [];
    for (const plant of PLANTS) {
        for (const symbol of SYMBOLS) {
            tiles.push({ plant, symbol });
        }
    }
    return shuffle(tiles);
}
function initBoard() {
    const tiles = createTiles();
    const board = [];
    for (let r = 0; r < 4; r++) {
        const row = [];
        for (let c = 0; c < 4; c++) {
            row.push(tiles[r * 4 + c]);
        }
        board.push(row);
    }
    return board;
}
function isValidMove(board, row, col, lastPickedTile) {
    const cell = board[row][col];
    if (!cell || typeof cell === 'string')
        return false;
    if (!lastPickedTile)
        return true; // первый ход без проверки совпадения
    const tile = cell;
    return tile.plant === lastPickedTile.plant || tile.symbol === lastPickedTile.symbol;
}
function checkWin(board, player) {
    // 4 в ряд горизонтально
    for (let i = 0; i < 4; i++) {
        if (board[i].every(cell => cell === player))
            return true;
    }
    // 4 в ряд вертикально
    for (let i = 0; i < 4; i++) {
        if (board.every(row => row[i] === player))
            return true;
    }
    // главная диагональ
    if (board.every((row, idx) => row[idx] === player))
        return true;
    // побочная диагональ
    if (board.every((row, idx) => row[3 - idx] === player))
        return true;
    // квадрат 2x2
    for (let r = 0; r < 3; r++) {
        for (let c = 0; c < 3; c++) {
            if (board[r][c] === player &&
                board[r][c + 1] === player &&
                board[r + 1][c] === player &&
                board[r + 1][c + 1] === player) {
                return true;
            }
        }
    }
    return false;
}
