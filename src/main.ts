import './styles/main.css';
import { startScene } from './rendering/start-scene';

const canvas = document.querySelector<HTMLCanvasElement>('#scene');
if (!canvas) throw new Error('Scene canvas is missing.');

const showError = (error: unknown) => {
  const message = document.querySelector<HTMLParagraphElement>('#error');
  if (message) {
    message.hidden = false;
    message.textContent =
      'The 3D rack could not start. Please use a browser with WebGL 2 enabled.';
  }
  console.error(error);
};

// `/?room=dev` opens the developer room, where new apparatus is built and
// tested before it joins the game. It is loaded only when asked for.
if (new URLSearchParams(location.search).get('room') === 'dev') {
  import('./rendering/dev-room')
    .then(({ startDevRoom }) => {
      const dispose = startDevRoom(canvas);
      if (import.meta.hot) import.meta.hot.dispose(dispose);
    })
    .catch(showError);
} else {
  try {
    const dispose = startScene(canvas);
    if (import.meta.hot) import.meta.hot.dispose(dispose);
  } catch (error) {
    showError(error);
  }
}
