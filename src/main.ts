import { Game } from './app/Game';

const container = document.getElementById('game-container');
if (!container) {
  throw new Error('Missing #game-container element');
}

new Game(container);
console.log('Celtest initialized');
