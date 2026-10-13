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

// Rooms retain their apparatus state while only the current room draws.
type RoomHandle = (() => void) & {
  enter?: (from: string | null) => void;
  suspend?: () => void;
  resume?: () => void;
};
const rooms = new Map<string, { root: HTMLElement; handle: RoomHandle }>();
let current: string | undefined;
let revision = 0;
const resetEffects = async () => {
  const { ps1Uniforms } = await import('./rendering/ps1-material');
  ps1Uniforms.roomLight.value = 1;
  ps1Uniforms.plantLight.value = 1;
  ps1Uniforms.channels.value.set(1, 1, 1);
  ps1Uniforms.warp.value = 0;
  ps1Uniforms.warpField.value.set(0, 0, 0, 0);
  ps1Uniforms.precision.value.set(0, 0, 0);
  ps1Uniforms.pi.value = Math.PI;
  ps1Uniforms.linearTarget.value = 0;
};
const openRoom = async () => {
  const ownRevision = ++revision;
  const params = new URLSearchParams(location.search);
  const requested = params.get('room');
  const room =
    requested && ['dev', 'dev1', 'dev2', 'dev3'].includes(requested)
      ? requested
      : 'corridor';
  let start: (canvas: HTMLCanvasElement) => RoomHandle;
  if (room === 'dev3')
    start = (await import('./rendering/gen1-room')).startGen1Room;
  else if (room === 'dev2')
    start = (await import('./rendering/placeholder-room')).startPlaceholderRoom;
  else if (room === 'dev1')
    start = (await import('./rendering/effects-room')).startEffectsRoom;
  else if (room === 'dev')
    start = (await import('./rendering/dev-room')).startDevRoom;
  else start = startScene;
  await resetEffects();
  if (ownRevision !== revision) return;
  if (document.pointerLockElement) document.exitPointerLock();
  window.dispatchEvent(new Event('blur'));
  if (current) {
    const old = rooms.get(current)!;
    old.handle.suspend?.();
    old.root.hidden = true;
  }
  current = room;
  let loaded = rooms.get(room);
  if (!loaded) {
    const root = document.createElement('section');
    root.setAttribute(
      'aria-label',
      room === 'corridor' ? 'Laboratory and main corridor' : `Room ${room}`,
    );
    Object.assign(root.style, { position: 'absolute', inset: '0' });
    const surface = canvas.cloneNode() as HTMLCanvasElement;
    surface.id = 'scene';
    surface.hidden = false;
    surface.style.display = 'block';
    surface.setAttribute(
      'aria-label',
      room === 'corridor'
        ? 'Laboratory and corridor'
        : `Development room ${room}`,
    );
    canvas.parentElement!.append(root);
    root.append(surface);
    canvas.hidden = true;
    canvas.style.display = 'none';
    canvas.id = 'scene-template';
    loaded = { root, handle: start(surface) };
    rooms.set(room, loaded);
  }
  for (const [id, entry] of rooms) {
    entry.root.hidden = id !== room;
    const surface = entry.root.querySelector('canvas');
    if (surface) surface.id = id === room ? 'scene' : `scene-${id}`;
  }
  loaded.root.hidden = false;
  loaded.handle.enter?.(params.get('from'));
  loaded.handle.resume?.();
};
const travel = (event: Event) => {
  const { to, from } = (event as CustomEvent<{ to: string; from: string }>)
    .detail;
  if (!['corridor', 'dev', 'dev1', 'dev2', 'dev3'].includes(to)) return;
  const url = new URL(location.href);
  url.search = '';
  if (to === 'corridor') url.searchParams.set('view', 'corridor');
  else url.searchParams.set('room', to);
  url.searchParams.set('from', from);
  history.pushState(null, '', url);
  void openRoom().catch(showError);
};
const popstate = () => {
  void openRoom().catch(showError);
};
window.addEventListener('vx3-room', travel);
window.addEventListener('popstate', popstate);
void openRoom().catch(showError);
if (import.meta.hot)
  import.meta.hot.dispose(() => {
    revision++;
    for (const entry of rooms.values()) {
      entry.handle();
      entry.root.remove();
    }
    canvas.hidden = false;
    canvas.style.display = 'block';
    window.removeEventListener('vx3-room', travel);
    window.removeEventListener('popstate', popstate);
  });
