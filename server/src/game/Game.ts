import { Board, GameStatus, Tile, Winner } from './types';
import { initBoard, isValidMove, checkWin } from './Board';

export class Game {
  public board: Board;
  public currentPlayer: 'red' | 'black';
  public status: GameStatus;
  public winner: Winner;
  public lastPickedTile: Tile | null;
  public players: { red?: string; black?: string };
  public hostSocketId: string | null = null;
  public guestSocketId: string | null = null;
  public nickRed: string = 'Красные';
  public nickBlack: string = 'Чёрные';
  public hostPlayerId: string = '';
  public guestPlayerId: string = '';

  // Токены для переподключения
  public hostToken: string | null = null;
  public guestToken: string | null = null;

  public maxWins: number;
  public scores: { host: number; guest: number };
  public roundFinished: boolean;
  public seriesWinner: 'host' | 'guest' | null;
  private restartVotes: Set<string>;

  // Голоса за полный сброс комнаты
  public resetVotes: Set<string> = new Set();

  // Таймер хода
  public turnStartedAt: number = Date.now();
  public turnDuration: number = 30_000;
  private turnTimer: NodeJS.Timeout | null = null;
  private onTimerExpired: (() => void) | null = null;

  // Последний сделанный ход (для анимации)
  public lastMove: { row: number; col: number } | null = null;

  constructor(maxWins = 1, turnDuration = 30_000) {
    this.board = initBoard();
    this.currentPlayer = 'red';
    this.status = 'waiting';
    this.winner = null;
    this.lastPickedTile = null;
    this.players = {};
    this.maxWins = maxWins;
    this.scores = { host: 0, guest: 0 };
    this.roundFinished = false;
    this.seriesWinner = null;
    this.restartVotes = new Set();
    this.turnDuration = turnDuration;
  }

  setOnTimerExpired(callback: () => void) {
    this.onTimerExpired = callback;
  }

  private clearTurnTimer() {
    if (this.turnTimer) {
      clearTimeout(this.turnTimer);
      this.turnTimer = null;
    }
  }

  private startTurnTimer() {
    this.clearTurnTimer();
    this.turnStartedAt = Date.now();
    this.turnTimer = setTimeout(() => {
      if (this.status === 'playing' && this.onTimerExpired) {
        this.onTimerExpired();
      }
    }, this.turnDuration);
  }

  addPlayer(socketId: string): boolean {
    if (this.players.red && this.players.black) return false;
    if (!this.players.red) {
      this.players.red = socketId;
      this.hostSocketId = socketId;
      return true;
    }
    this.players.black = socketId;
    this.guestSocketId = socketId;
    this.status = 'playing';
    this.startTurnTimer();
    return true;
  }

  // Пропуск хода (по таймеру)
  skipTurn() {
    if (this.status !== 'playing') return;
    const opponent = this.currentPlayer === 'red' ? 'black' : 'red';
    if (!this.hasValidMove()) {
      this.winner = opponent;
      this.handleGameOver();
    } else {
      this.currentPlayer = opponent;
      this.startTurnTimer();
    }
  }

  makeMove(row: number, col: number, playerSocketId: string): boolean {
    if (this.status !== 'playing') return false;
    const playerColor = this.players.red === playerSocketId ? 'red' : 'black';
    if (playerColor !== this.currentPlayer) return false;

    if (!this.lastPickedTile) {
      if (!(row === 0 || row === 3 || col === 0 || col === 3)) return false;
      if (!this.board[row][col] || typeof this.board[row][col] === 'string') return false;
    } else {
      if (!isValidMove(this.board, row, col, this.lastPickedTile)) return false;
    }

    const picked = this.board[row][col] as Tile;
    this.board[row][col] = playerColor;
    this.lastPickedTile = picked;
    this.lastMove = { row, col };

    this.clearTurnTimer();

    if (checkWin(this.board, playerColor)) {
      this.winner = playerColor;
      this.handleGameOver();
      return true;
    }

    const opponent = playerColor === 'red' ? 'black' : 'red';
    if (!this.hasValidMove()) {
      this.winner = playerColor;
      this.handleGameOver();
      return true;
    }

    if (this.isBoardFull()) {
      this.winner = 'draw';
      this.handleGameOver();
      return true;
    }

    this.currentPlayer = opponent;
    this.startTurnTimer();
    return true;
  }

  // Меняем private на public, чтобы вызывать извне при сдаче или авто-завершении
  public handleGameOver() {
    this.clearTurnTimer();
    this.status = 'finished';
    if (this.winner === 'red' || this.winner === 'black') {
      const winnerColor = this.winner;
      const winnerSocket = winnerColor === 'red' ? this.players.red! : this.players.black!;
      if (winnerSocket === this.hostSocketId) {
        this.scores.host++;
      } else if (winnerSocket === this.guestSocketId) {
        this.scores.guest++;
      }
    }
    const winThreshold = Math.ceil(this.maxWins / 2);
    if (this.scores.host >= winThreshold) {
      this.seriesWinner = 'host';
    } else if (this.scores.guest >= winThreshold) {
      this.seriesWinner = 'guest';
    }

    if (this.seriesWinner || this.maxWins === 1) {
      this.roundFinished = false;
    } else {
      this.roundFinished = true;
      this.restartVotes.clear();
    }
  }

  // Продолжение серии (ещё одна игра)
  voteRestart(socketId: string): boolean {
    if (!this.roundFinished || this.seriesWinner) return false;
    if (socketId !== this.players.red && socketId !== this.players.black) return false;
    this.restartVotes.add(socketId);
    if (this.restartVotes.size === 2) {
      this.startNewRound();
      return true;
    }
    return false;
  }

  // Полный сброс комнаты (новая игра с теми же игроками)
  voteReset(socketId: string): boolean {
    if (this.status !== 'finished' && !this.roundFinished && !this.seriesWinner) return false;
    if (socketId !== this.hostSocketId && socketId !== this.guestSocketId) return false;
    this.resetVotes.add(socketId);
    if (this.resetVotes.size === 2) {
      this.fullReset();
      return true;
    }
    return false;
  }

  private fullReset() {
    const maxWins = this.maxWins;
    const turnDuration = this.turnDuration;
    const hostSocket = this.hostSocketId;
    const guestSocket = this.guestSocketId;
    const hostToken = this.hostToken;
    const guestToken = this.guestToken;

    this.board = initBoard();
    this.currentPlayer = 'red';
    this.status = 'playing';
    this.winner = null;
    this.lastPickedTile = null;
    this.players.red = hostSocket ?? undefined;
    this.players.black = guestSocket ?? undefined;
    this.hostSocketId = hostSocket;
    this.guestSocketId = guestSocket;
    this.hostToken = hostToken;
    this.guestToken = guestToken;
    this.maxWins = maxWins;
    this.turnDuration = turnDuration;
    this.scores = { host: 0, guest: 0 };
    this.roundFinished = false;
    this.seriesWinner = null;
    this.restartVotes.clear();
    this.resetVotes.clear();
    this.lastMove = null;
    this.clearTurnTimer();
    this.startTurnTimer();
  }

  startNewRound() {
    this.clearTurnTimer();
    this.swapColors();
    this.board = initBoard();
    this.currentPlayer = 'red';
    this.winner = null;
    this.lastPickedTile = null;
    this.status = 'playing';
    this.roundFinished = false;
    this.restartVotes.clear();
    this.lastMove = null;
    this.startTurnTimer();
  }

  private swapColors() {
    if (this.players.red && this.players.black) {
      const temp = this.players.red;
      this.players.red = this.players.black;
      this.players.black = temp;
    }
  }

  private hasValidMove(): boolean {
    for (let r = 0; r < 4; r++) {
      for (let c = 0; c < 4; c++) {
        const cell = this.board[r][c];
        if (cell && typeof cell !== 'string') {
          if (isValidMove(this.board, r, c, this.lastPickedTile)) return true;
        }
      }
    }
    return false;
  }

  private isBoardFull(): boolean {
    return this.board.every(row => row.every(cell => typeof cell === 'string'));
  }
}