export interface Player {
  id: string;
  name: string;
  avatar?: string;
  color?: string;
}

export interface Score {
  playerId: string;
  value: number;
  isConfirmed: boolean;
}

export interface Round {
  id: string;
  scores: Score[];
  timestamp: number;
}

export interface Game {
  id: string;
  players: Player[];
  rounds: Round[];
  status: 'active' | 'completed';
  startTime: number;
  endTime?: number;
  winnerId?: string;
}

export interface GameState {
  players: Player[];
  activeGame: Game | null;
  history: Game[];
}
