for (const viewer of document.querySelectorAll('[data-device-viewer]')) {
  const canvas = viewer.querySelector('canvas');
  const image = viewer.querySelector('img');
  const launch = viewer.querySelector('[data-launch]');
  const tools = viewer.querySelector('[data-model-tools]');
  const hint = viewer.querySelector('[data-model-hint]');
  const power = viewer.querySelector('[data-model-power]');
  let device = null;
  let busy = false;

  function showPhoto() {
    device?.dispose();
    device = null;
    canvas.hidden = true;
    image.hidden = false;
    tools.hidden = true;
    launch.hidden = false;
    hint.textContent = '';
    launch.focus();
  }

  launch.addEventListener('click', async () => {
    if (busy || device) return;
    busy = true;
    launch.disabled = true;
    hint.textContent = 'Открываем модель…';
    try {
      const { mountDevice } = await import('./device3d.js?v=2');
      canvas.hidden = false;
      device = mountDevice(canvas, {
        reducedMotion: matchMedia('(prefers-reduced-motion: reduce)').matches,
        onChange(state) {
          power.setAttribute('aria-pressed', String(state.on));
        }
      });
      image.hidden = true;
      launch.hidden = true;
      tools.hidden = false;
      power.setAttribute('aria-pressed', 'false');
      hint.textContent = 'Потяните модель, чтобы повернуть. Кнопки на корпусе нажимаются.';
      canvas.focus({ preventScroll: true });
    } catch {
      canvas.hidden = true;
      hint.textContent = 'В этом браузере доступно фото прибора.';
    } finally {
      busy = false;
      launch.disabled = false;
    }
  });

  viewer.querySelector('[data-model-left]').addEventListener('click', () => device?.rotate(-Math.PI / 6));
  viewer.querySelector('[data-model-right]').addEventListener('click', () => device?.rotate(Math.PI / 6));
  power.addEventListener('click', () => device?.press('power'));
  viewer.querySelector('[data-model-photo]').addEventListener('click', showPhoto);
  canvas.addEventListener('keydown', event => {
    if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight') return;
    event.preventDefault();
    device?.rotate(event.key === 'ArrowLeft' ? -Math.PI / 6 : Math.PI / 6);
  });
}
