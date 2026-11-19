const MOVEMENT_KEYS = new Set([
  'KeyW', 'KeyA', 'KeyS', 'KeyD', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight',
]);
const PREVENT_KEYS = new Set([
  ...MOVEMENT_KEYS, 'Space', 'ShiftLeft', 'ShiftRight', 'AltLeft', 'AltRight',
  'KeyJ', 'KeyK', 'KeyL', 'KeyQ', 'KeyE', 'KeyF', 'KeyM', 'KeyP', 'Escape',
]);

export function createInput(canvas, callbacks = {}) {
  const keys = new Set();
  const queuedActions = new Set();
  const heldShieldButtons = new Set();
  const joystick = document.getElementById('joystick');
  const joystickKnob = document.getElementById('joystick-knob');
  const actionButtons = [...document.querySelectorAll('[data-action]')];
  let enabled = false;
  let pointerLocked = false;
  let middleDragging = false;
  let mouseRight = false;
  let lastMouseX = 0;
  let lastMouseY = 0;
  let lookX = 0;
  let lookY = 0;
  let zoomDelta = 0;
  let joystickPointerId = null;
  let joystickVector = { x: 0, y: 0 };
  let touchCameraPointerId = null;
  let touchCameraX = 0;
  let touchCameraY = 0;
  let touchCameraStartX = 0;
  let touchCameraStartY = 0;
  let touchCameraMoved = false;

  function queueAction(name) {
    if (!enabled) return;
    queuedActions.add(name);
  }

  function consumeAction(name) {
    if (!queuedActions.has(name)) return false;
    queuedActions.delete(name);
    return true;
  }

  function consumeLook() {
    const result = { x: lookX, y: lookY };
    lookX = 0;
    lookY = 0;
    return result;
  }

  function consumeZoom() {
    const result = zoomDelta;
    zoomDelta = 0;
    return result;
  }

  function resetJoystick() {
    joystickPointerId = null;
    joystickVector = { x: 0, y: 0 };
    if (joystickKnob) {
      joystickKnob.style.left = '50%';
      joystickKnob.style.top = '50%';
    }
  }

  function clear() {
    keys.clear();
    queuedActions.clear();
    heldShieldButtons.clear();
    middleDragging = false;
    mouseRight = false;
    lookX = 0;
    lookY = 0;
    zoomDelta = 0;
    resetJoystick();
    actionButtons.forEach((button) => button.classList.remove('is-pressed'));
  }

  function onKeyDown(event) {
    const code = event.code;
    if (PREVENT_KEYS.has(code)) event.preventDefault();
    keys.add(code);
    if (event.repeat) return;
    if (code === 'Escape' || code === 'KeyP') {
      callbacks.onPause?.();
      return;
    }
    if (code === 'KeyF') {
      callbacks.onFullscreen?.();
      return;
    }
    if (code === 'KeyM') {
      callbacks.onMute?.();
      return;
    }
    if (code === 'Enter') {
      callbacks.onEnter?.();
      return;
    }
    if (!enabled) return;
    if (code === 'KeyJ') queueAction('attack');
    if (code === 'KeyK') queueAction('shieldBash');
    if (code === 'KeyL' || code === 'AltLeft' || code === 'AltRight') queueAction('dodge');
    if (code === 'Space') queueAction('jump');
  }

  function onKeyUp(event) {
    keys.delete(event.code);
    if (PREVENT_KEYS.has(event.code)) event.preventDefault();
  }

  function onMouseMove(event) {
    if (pointerLocked) {
      lookX += event.movementX || 0;
      lookY += event.movementY || 0;
      return;
    }
    if (middleDragging) {
      lookX += event.clientX - lastMouseX;
      lookY += event.clientY - lastMouseY;
      lastMouseX = event.clientX;
      lastMouseY = event.clientY;
    }
  }

  function onCanvasPointerDown(event) {
    if (!enabled) return;
    if (event.pointerType === 'touch') {
      if (event.clientX > window.innerWidth * 0.42) {
        touchCameraPointerId = event.pointerId;
        touchCameraX = event.clientX;
        touchCameraY = event.clientY;
        touchCameraStartX = event.clientX;
        touchCameraStartY = event.clientY;
        touchCameraMoved = false;
        canvas.setPointerCapture?.(event.pointerId);
      }
      return;
    }
    if (event.button === 0) queueAction('attack');
    if (event.button === 1) {
      middleDragging = true;
      lastMouseX = event.clientX;
      lastMouseY = event.clientY;
      canvas.setPointerCapture?.(event.pointerId);
      event.preventDefault();
    }
    if (event.button === 2) {
      mouseRight = true;
      queueAction('shieldBash');
    }
  }

  function onCanvasPointerMove(event) {
    if (event.pointerId !== touchCameraPointerId) return;
    const dx = event.clientX - touchCameraX;
    const dy = event.clientY - touchCameraY;
    lookX += dx * 1.35;
    lookY += dy * 1.35;
    touchCameraX = event.clientX;
    touchCameraY = event.clientY;
    if (Math.hypot(event.clientX - touchCameraStartX, event.clientY - touchCameraStartY) > 9) {
      touchCameraMoved = true;
    }
  }

  function onCanvasPointerUp(event) {
    if (event.pointerId === touchCameraPointerId) {
      if (!touchCameraMoved) queueAction('attack');
      touchCameraPointerId = null;
      canvas.releasePointerCapture?.(event.pointerId);
      return;
    }
    if (middleDragging && event.button === 1) middleDragging = false;
    if (mouseRight && event.button === 2) mouseRight = false;
  }

  function onWheel(event) {
    if (!enabled) return;
    event.preventDefault();
    zoomDelta += event.deltaY;
  }

  function onJoystickDown(event) {
    if (!enabled || joystickPointerId !== null) return;
    event.preventDefault();
    joystickPointerId = event.pointerId;
    joystick?.setPointerCapture?.(event.pointerId);
    updateJoystick(event);
  }

  function updateJoystick(event) {
    if (!joystick || event.pointerId !== joystickPointerId) return;
    const rect = joystick.getBoundingClientRect();
    const centerX = rect.left + rect.width / 2;
    const centerY = rect.top + rect.height / 2;
    const maxRadius = rect.width * 0.36;
    let dx = event.clientX - centerX;
    let dy = event.clientY - centerY;
    const distance = Math.hypot(dx, dy);
    if (distance > maxRadius) {
      dx *= maxRadius / distance;
      dy *= maxRadius / distance;
    }
    joystickVector = { x: dx / maxRadius, y: -dy / maxRadius };
    if (joystickKnob) {
      joystickKnob.style.left = `${50 + (dx / rect.width) * 100}%`;
      joystickKnob.style.top = `${50 + (dy / rect.height) * 100}%`;
    }
  }

  function onJoystickMove(event) {
    if (event.pointerId === joystickPointerId) {
      event.preventDefault();
      updateJoystick(event);
    }
  }

  function onJoystickUp(event) {
    if (event.pointerId === joystickPointerId) {
      event.preventDefault();
      joystick?.releasePointerCapture?.(event.pointerId);
      resetJoystick();
    }
  }

  function onActionDown(event) {
    if (!enabled) return;
    event.preventDefault();
    const button = event.currentTarget;
    const action = button.dataset.action;
    button.classList.add('is-pressed');
    button.setPointerCapture?.(event.pointerId);
    if (action === 'shield') {
      heldShieldButtons.add(button);
      queueAction('shieldBash');
    } else {
      queueAction(action);
    }
  }

  function onActionUp(event) {
    const button = event.currentTarget;
    button.classList.remove('is-pressed');
    heldShieldButtons.delete(button);
    button.releasePointerCapture?.(event.pointerId);
  }

  function onPointerLockChange() {
    pointerLocked = document.pointerLockElement === canvas;
    callbacks.onPointerLockChange?.(pointerLocked);
  }

  function requestPointerLock() {
    if (!canvas.requestPointerLock) {
      callbacks.onPointerLockError?.('unsupported');
      return false;
    }
    try {
      const result = canvas.requestPointerLock();
      if (result && typeof result.catch === 'function') {
        result.catch(() => callbacks.onPointerLockError?.('denied'));
      }
      return true;
    } catch {
      callbacks.onPointerLockError?.('denied');
      return false;
    }
  }

  function exitPointerLock() {
    if (document.pointerLockElement === canvas && document.exitPointerLock) {
      try { document.exitPointerLock(); } catch { /* browser-dependent */ }
    }
  }

  window.addEventListener('keydown', onKeyDown, { passive: false });
  window.addEventListener('keyup', onKeyUp, { passive: false });
  window.addEventListener('blur', clear);
  document.addEventListener('mousemove', onMouseMove);
  document.addEventListener('pointerlockchange', onPointerLockChange);
  canvas.addEventListener('pointerdown', onCanvasPointerDown);
  canvas.addEventListener('pointermove', onCanvasPointerMove);
  canvas.addEventListener('pointerup', onCanvasPointerUp);
  canvas.addEventListener('pointercancel', onCanvasPointerUp);
  canvas.addEventListener('wheel', onWheel, { passive: false });
  canvas.addEventListener('contextmenu', (event) => event.preventDefault());
  if (joystick) {
    joystick.addEventListener('pointerdown', onJoystickDown);
    joystick.addEventListener('pointermove', onJoystickMove);
    joystick.addEventListener('pointerup', onJoystickUp);
    joystick.addEventListener('pointercancel', onJoystickUp);
  }
  actionButtons.forEach((button) => {
    button.addEventListener('pointerdown', onActionDown);
    button.addEventListener('pointerup', onActionUp);
    button.addEventListener('pointercancel', onActionUp);
  });

  return {
    consumeAction,
    consumeLook,
    consumeZoom,
    clear,
    requestPointerLock,
    exitPointerLock,
    get enabled() { return enabled; },
    set enabled(value) {
      enabled = Boolean(value);
      if (!enabled) clear();
    },
    get pointerLocked() { return pointerLocked; },
    get shieldHeld() {
      return enabled && (keys.has('KeyK') || mouseRight || heldShieldButtons.size > 0);
    },
    get sprint() {
      if (!enabled) return false;
      const joystickSprint = Math.hypot(joystickVector.x, joystickVector.y) > 0.86;
      return keys.has('ShiftLeft') || keys.has('ShiftRight') || joystickSprint;
    },
    get cameraYawAxis() {
      if (!enabled) return 0;
      return (keys.has('KeyE') ? 1 : 0) - (keys.has('KeyQ') ? 1 : 0);
    },
    get movement() {
      if (!enabled) return { x: 0, y: 0, magnitude: 0 };
      let x = 0;
      let y = 0;
      if (keys.has('KeyA') || keys.has('ArrowLeft')) x -= 1;
      if (keys.has('KeyD') || keys.has('ArrowRight')) x += 1;
      if (keys.has('KeyW') || keys.has('ArrowUp')) y += 1;
      if (keys.has('KeyS') || keys.has('ArrowDown')) y -= 1;
      x += joystickVector.x;
      y += joystickVector.y;
      const magnitude = Math.hypot(x, y);
      if (magnitude > 1) {
        x /= magnitude;
        y /= magnitude;
      }
      return { x, y, magnitude: Math.min(1, magnitude) };
    },
  };
}
