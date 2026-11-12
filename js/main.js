import { App } from './ui/app.js';

function webglAvailable() {
  try {
    const c = document.createElement('canvas');
    return !!(c.getContext('webgl2') || c.getContext('webgl'));
  } catch {
    return false;
  }
}

if (!webglAvailable()) {
  document.getElementById('main').innerHTML = '<div class="card"><h3>3D not available</h3><p class="muted">Your browser has WebGL turned off. The 2D game still works, but 3D views will not open.</p></div>';
}
window.addEventListener('unhandledrejection', (e) => {
  console.error('Unhandled:', e.reason?.stack || e.reason);
  window.hf?.toast?.(`Something went wrong: ${e.reason?.message || e.reason}`, 'bad');
});
window.hf = new App();
window.__ready = true;
