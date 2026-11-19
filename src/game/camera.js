import * as THREE from 'three';

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

export function createThirdPersonCamera(camera, player, input, effects) {
  const targetPosition = new THREE.Vector3();
  const lookTarget = new THREE.Vector3();
  const forward = new THREE.Vector3();
  const right = new THREE.Vector3();
  const shakeOffset = new THREE.Vector3();
  let yaw = Math.PI;
  let pitch = 0.27;
  let zoom = 5.55;
  let fov = 60;
  let initialized = false;

  function computeTargets() {
    forward.set(Math.sin(yaw), 0, Math.cos(yaw));
    right.set(-Math.cos(yaw), 0, Math.sin(yaw));
    const horizontal = Math.cos(pitch) * zoom;
    const height = 2.2 + Math.sin(pitch) * zoom * 0.72;
    targetPosition.copy(player.position)
      .addScaledVector(forward, -horizontal)
      .addScaledVector(right, 0.72);
    targetPosition.y = height + player.verticalOffset * 0.55;
    lookTarget.copy(player.position)
      .addScaledVector(forward, 2.35)
      .addScaledVector(right, 0.14);
    lookTarget.y = 1.42 + player.verticalOffset * 0.8;
  }

  function applyImmediate() {
    computeTargets();
    camera.position.copy(targetPosition);
    camera.lookAt(lookTarget);
    initialized = true;
  }

  function reset() {
    yaw = Math.PI;
    pitch = 0.27;
    zoom = 5.55;
    fov = 60;
    camera.fov = fov;
    camera.updateProjectionMatrix();
    applyImmediate();
  }

  function update(dt, time, options = {}) {
    const step = Math.min(dt, 0.05);
    const look = input.consumeLook();
    if (options.autoOrbit) yaw += step * 0.085;
    const zoomDelta = input.consumeZoom();
    const axis = input.cameraYawAxis;
    yaw -= look.x * 0.0027 + axis * step * 1.55;
    pitch = clamp(pitch + look.y * 0.0019, 0.08, 0.62);
    zoom = clamp(zoom + zoomDelta * 0.0032, 4.35, 7.8);

    computeTargets();
    const follow = 1 - Math.exp(-step * (player.dodging ? 13 : 8.5));
    if (!initialized) applyImmediate();
    else camera.position.lerp(targetPosition, follow);

    const desiredFov = 60 + (player.sprinting ? 4.2 : 0) + (player.dodging ? 2.5 : 0)
      + (player.attackTimer > 0 ? -1.2 : 0);
    fov = THREE.MathUtils.damp(fov, desiredFov, 4.5, step);
    if (Math.abs(camera.fov - fov) > 0.01) {
      camera.fov = fov;
      camera.updateProjectionMatrix();
    }

    const shake = effects?.shake || 0;
    if (shake > 0.001) {
      const amount = shake * 0.12;
      shakeOffset.set(
        (Math.random() - 0.5) * amount,
        (Math.random() - 0.5) * amount * 0.7,
        (Math.random() - 0.5) * amount,
      );
      camera.position.add(shakeOffset);
    }

    // A tiny living-camera drift keeps idle framing from feeling static.
    lookTarget.y += Math.sin(time * 0.55) * 0.015;
    camera.lookAt(lookTarget);
  }

  return {
    update,
    reset,
    get yaw() { return yaw; },
    get pitch() { return pitch; },
    get zoom() { return zoom; },
  };
}
