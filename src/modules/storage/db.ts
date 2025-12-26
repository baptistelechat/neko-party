import { openDB, DBSchema, IDBPDatabase } from 'idb';
import { Game, Player } from '@/modules/game/types';

interface NekoPartyDB extends DBSchema {
  players: {
    key: string;
    value: Player;
  };
  games: {
    key: string;
    value: Game;
    indexes: { 'by-date': number };
  };
  settings: {
    key: string;
    value: { id: string; theme: 'light' | 'dark'; soundEnabled: boolean };
  };
}

const DB_NAME = 'neko-party-db';
const DB_VERSION = 1;

let dbPromise: Promise<IDBPDatabase<NekoPartyDB>>;

export const initDB = () => {
  if (!dbPromise) {
    dbPromise = openDB<NekoPartyDB>(DB_NAME, DB_VERSION, {
      upgrade(db) {
        if (!db.objectStoreNames.contains('players')) {
          db.createObjectStore('players', { keyPath: 'id' });
        }
        if (!db.objectStoreNames.contains('games')) {
          const gameStore = db.createObjectStore('games', { keyPath: 'id' });
          gameStore.createIndex('by-date', 'startTime');
        }
        if (!db.objectStoreNames.contains('settings')) {
          db.createObjectStore('settings', { keyPath: 'id' });
        }
      },
    });
  }
  return dbPromise;
};

export const getDB = () => {
  if (!dbPromise) {
    return initDB();
  }
  return dbPromise;
};
