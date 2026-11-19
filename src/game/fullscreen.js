export function createFullscreen(target, onChange = () => {}) {
  const doc = document;
  const element = target || doc.documentElement;

  function activeElement() {
    return doc.fullscreenElement || doc.webkitFullscreenElement || doc.mozFullScreenElement || null;
  }

  function isFullscreen() {
    return activeElement() === element || activeElement() === doc.documentElement;
  }

  function notify() {
    onChange(isFullscreen());
  }

  async function enter() {
    if (isFullscreen()) return true;
    const request = element.requestFullscreen || element.webkitRequestFullscreen || element.mozRequestFullScreen;
    if (!request) return false;
    try {
      let result;
      try {
        result = request.call(element, { navigationUI: 'hide' });
      } catch {
        result = request.call(element);
      }
      if (result && typeof result.then === 'function') await result;
      notify();
      return true;
    } catch {
      return false;
    }
  }

  async function exit() {
    if (!isFullscreen()) return true;
    const exitRequest = doc.exitFullscreen || doc.webkitExitFullscreen || doc.mozCancelFullScreen;
    if (!exitRequest) return false;
    try {
      const result = exitRequest.call(doc);
      if (result && typeof result.then === 'function') await result;
      notify();
      return true;
    } catch {
      return false;
    }
  }

  async function toggle() {
    return isFullscreen() ? exit() : enter();
  }

  function onFullscreenChange() {
    notify();
  }

  doc.addEventListener('fullscreenchange', onFullscreenChange);
  doc.addEventListener('webkitfullscreenchange', onFullscreenChange);
  doc.addEventListener('mozfullscreenchange', onFullscreenChange);
  doc.addEventListener('fullscreenerror', () => onChange(false));

  return {
    enter,
    exit,
    toggle,
    isFullscreen,
    get supported() {
      return Boolean(element.requestFullscreen || element.webkitRequestFullscreen || element.mozRequestFullScreen);
    },
  };
}
