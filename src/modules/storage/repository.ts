import { getDB } from './db';
import { Game, Player } from '@/modules/game/types';

export const storage = {
  players: {
    getAll: async (): Promise<Player[]> => {
      const db = await getDB();
      return db.getAll('players');
    },
    add: async (player: Player): Promise<string> => {
      const db = await getDB();
      await db.put('players', player);
      return player.id;
    },
    delete: async (id: string): Promise<void> => {
      const db = await getDB();
      await db.delete('players', id);
    },
  },
  games: {
    getAll: async (): Promise<Game[]> => {
      const db = await getDB();
      return db.getAllFromIndex('games', 'by-date');
    },
    save: async (game: Game): Promise<void> => {
      const db = await getDB();
      await db.put('games', game);
    },
    get: async (id: string): Promise<Game | undefined> => {
      const db = await getDB();
      return db.get('games', id);
    },
  },
};
