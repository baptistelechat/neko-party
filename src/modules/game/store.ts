import { create } from 'zustand';
import { Game, Player, Round } from './types';
import { storage } from '@/modules/storage/repository';

interface GameStore {
  players: Player[];
  activeGame: Game | null;
  history: Game[];
  isLoading: boolean;
  
  // Actions
  init: () => Promise<void>;
  addPlayer: (name: string) => Promise<void>;
  createGame: (playerIds: string[]) => Promise<void>;
  addRound: (scores: { playerId: string; value: number }[]) => Promise<void>;
  endGame: () => Promise<void>;
}

export const useGameStore = create<GameStore>((set, get) => ({
  players: [],
  activeGame: null,
  history: [],
  isLoading: false,

  init: async () => {
    set({ isLoading: true });
    try {
      const players = await storage.players.getAll();
      const history = await storage.games.getAll();
      set({ players, history, isLoading: false });
    } catch (error) {
      console.error('Failed to init store', error);
      set({ isLoading: false });
    }
  },

  addPlayer: async (name: string) => {
    const newPlayer: Player = {
      id: crypto.randomUUID(),
      name,
      avatar: `https://api.dicebear.com/7.x/avataaars/svg?seed=${name}`,
    };
    await storage.players.add(newPlayer);
    set((state) => ({ players: [...state.players, newPlayer] }));
  },

  createGame: async (playerIds: string[]) => {
    const players = get().players.filter(p => playerIds.includes(p.id));
    const newGame: Game = {
      id: crypto.randomUUID(),
      players,
      rounds: [],
      status: 'active',
      startTime: Date.now(),
    };
    // Save active game state? For now just in memory until saved/updated
    set({ activeGame: newGame });
  },

  addRound: async (scores) => {
    const { activeGame } = get();
    if (!activeGame) return;

    const newRound: Round = {
      id: crypto.randomUUID(),
      scores: scores.map(s => ({ ...s, isConfirmed: true })),
      timestamp: Date.now(),
    };

    const updatedGame = {
      ...activeGame,
      rounds: [...activeGame.rounds, newRound],
    };

    set({ activeGame: updatedGame });
    // Optional: save partial game state to DB if we want persistence during game
  },

  endGame: async () => {
    const { activeGame } = get();
    if (!activeGame) return;

    const completedGame: Game = {
      ...activeGame,
      status: 'completed',
      endTime: Date.now(),
      // Calculate winner logic here if needed
    };

    await storage.games.save(completedGame);
    set((state) => ({
      activeGame: null,
      history: [...state.history, completedGame],
    }));
  },
}));
