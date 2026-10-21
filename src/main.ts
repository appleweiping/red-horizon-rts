import './style.css';
import { Game } from './game';
import { Menu } from './ui/menu';
import { AudioEngine } from './audio/audio';
import { Announcer } from './audio/announcer';

const canvas = document.getElementById('viewport') as HTMLCanvasElement;
const sidebar = document.getElementById('sidebar')!;
const messagesEl = document.getElementById('messages')!;
const menuEl = document.getElementById('menu')!;

const audio = new AudioEngine();
const announcer = new Announcer();

// browsers require a user gesture before audio may start
window.addEventListener('pointerdown', () => audio.unlock(), { once: true });
window.addEventListener('keydown', () => audio.unlock(), { once: true });

let game: Game | null = null;

const menu = new Menu(menuEl, (config) => {
  game = new Game(config, canvas, sidebar, messagesEl, menuEl, audio, announcer);
});

menu.showMain();

// expose for the browser console / E2E automation
declare global {
  interface Window {
    __rh: { game: () => Game | null };
  }
}
window.__rh = { game: () => game };
