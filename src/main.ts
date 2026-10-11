import './styles/main.css';
import { startScene } from './rendering/start-scene';

const canvas = document.querySelector<HTMLCanvasElement>('#scene');
if (!canvas) throw new Error('Scene canvas is missing.');

try {
  const dispose = startScene(canvas);
  if (import.meta.hot) import.meta.hot.dispose(dispose);
} catch (error) {
  const message = document.querySelector<HTMLParagraphElement>('#error');
  if (message) {
    message.hidden = false;
    message.textContent =
      'The 3D rack could not start. Please use a browser with WebGL 2 enabled.';
  }
  console.error(error);
}
