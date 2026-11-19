function byId(id) {
  return document.getElementById(id);
}

function formatTime(seconds) {
  const total = Math.max(0, Math.floor(seconds || 0));
  const minutes = Math.floor(total / 60).toString().padStart(2, '0');
  const secs = (total % 60).toString().padStart(2, '0');
  return `${minutes}:${secs}`;
}

export function createHUD(camera) {
  const app = byId('app');
  const hud = byId('hud');
  const loading = byId('loading');
  const screens = {
    title: byId('screen-title'),
    paused: byId('screen-pause'),
    ended: byId('screen-end'),
  };
  const elements = {
    healthFill: byId('health-fill'),
    healthText: byId('health-text'),
    staminaFill: byId('stamina-fill'),
    staminaText: byId('stamina-text'),
    score: byId('score'),
    time: byId('time'),
    fps: byId('fps'),
    sigils: byId('sigils'),
    kills: byId('kills'),
    objective: byId('objective'),
    wavePips: [...document.querySelectorAll('#wave-pips span')],
    combo: byId('combo'),
    message: byId('message'),
    bossBar: byId('boss-bar'),
    bossHealthFill: byId('boss-health-fill'),
    bossHealthText: byId('boss-health-text'),
    damageFlash: byId('damage-flash'),
    floatingLayer: byId('floating-layer'),
    toast: byId('toast'),
    fullscreenBtn: byId('fullscreen-btn'),
    soundBtn: byId('sound-btn'),
    qualityBtn: byId('quality-btn'),
    endEyebrow: byId('end-eyebrow'),
    endTitle: byId('end-title'),
    endCopy: byId('end-copy'),
    endStats: byId('end-stats'),
  };
  const minimap = byId('minimap');
  const ctx = minimap?.getContext('2d');
  let activeScreen = 'title';
  let messageTimer = 0;
  let toastTimer = 0;
  let comboTimer = 0;
  let damageTimer = 0;
  let minimapTimer = 0;
  let lastState = null;
  let fpsSmoothed = 60;

  const reticle = document.createElement('div');
  reticle.className = 'reticle';
  reticle.setAttribute('aria-hidden', 'true');
  hud.appendChild(reticle);

  function hideLoading() {
    loading?.classList.add('is-hidden');
  }

  function setScreen(name) {
    activeScreen = name;
    Object.entries(screens).forEach(([key, element]) => {
      element?.classList.toggle('is-hidden', key !== name);
    });
    const showHud = name === 'playing' || name === 'paused' || name === 'ended';
    hud.classList.toggle('is-hidden', !showHud);
    app.classList.toggle('is-playing', name === 'playing');
    reticle.style.opacity = name === 'playing' ? '1' : '0';
  }

  function setQualityLabel(label) {
    if (elements.qualityBtn) elements.qualityBtn.textContent = `Quality: ${label}`;
  }

  function setFullscreen(active) {
    if (!elements.fullscreenBtn) return;
    elements.fullscreenBtn.textContent = active ? '⛶' : '⛶';
    elements.fullscreenBtn.classList.toggle('is-active', active);
    elements.fullscreenBtn.setAttribute('aria-label', active ? 'Exit fullscreen' : 'Enter fullscreen');
  }

  function setSound(muted) {
    if (!elements.soundBtn) return;
    elements.soundBtn.textContent = muted ? '♪̸' : '♪';
    elements.soundBtn.classList.toggle('is-off', muted);
    elements.soundBtn.setAttribute('aria-label', muted ? 'Unmute sound' : 'Mute sound');
  }

  function message(text, variant = '', duration = 1800) {
    if (!elements.message) return;
    elements.message.textContent = text;
    elements.message.className = `message is-visible${variant ? ` message--${variant}` : ''}`;
    messageTimer = duration / 1000;
  }

  function toast(text, duration = 2200) {
    if (!elements.toast) return;
    elements.toast.textContent = text;
    elements.toast.classList.add('is-visible');
    toastTimer = duration / 1000;
  }

  function setCombo(combo) {
    if (!elements.combo || combo < 2) return;
    elements.combo.textContent = `${combo}× COMBO`;
    elements.combo.classList.add('is-visible');
    comboTimer = 1.25;
  }

  function flashDamage() {
    if (!elements.damageFlash) return;
    elements.damageFlash.classList.add('is-active');
    damageTimer = 0.14;
  }

  function floatText(worldPosition, text, variant = '') {
    if (!camera || !elements.floatingLayer || !worldPosition) return;
    const projected = worldPosition.clone().project(camera);
    if (projected.z < -1 || projected.z > 1) return;
    const element = document.createElement('div');
    element.className = `float-text${variant ? ` float-text--${variant}` : ''}`;
    element.textContent = text;
    const x = Math.max(5, Math.min(95, (projected.x * 0.5 + 0.5) * 100));
    const y = Math.max(7, Math.min(93, (-projected.y * 0.5 + 0.5) * 100));
    element.style.left = `${x}%`;
    element.style.top = `${y}%`;
    elements.floatingLayer.appendChild(element);
    const animation = element.animate([
      { opacity: 0, transform: 'translate(-50%, -25%) scale(0.78)' },
      { opacity: 1, transform: 'translate(-50%, -60%) scale(1.04)', offset: 0.18 },
      { opacity: 0, transform: 'translate(-50%, -155%) scale(0.98)' },
    ], {
      duration: 950,
      easing: 'cubic-bezier(.16,.8,.3,1)',
      fill: 'forwards',
    });
    animation.onfinish = () => element.remove();
    window.setTimeout(() => element.remove(), 1200);
  }

  function setBoss(visible, ratio = 0) {
    if (!elements.bossBar) return;
    elements.bossBar.classList.toggle('is-hidden', !visible);
    const percentage = Math.max(0, Math.min(100, Math.round(ratio * 100)));
    elements.bossHealthFill.style.width = `${percentage}%`;
    elements.bossHealthText.textContent = `${percentage}%`;
  }

  function setObjective(text) {
    if (elements.objective) elements.objective.textContent = text;
  }

  function setWave(index) {
    elements.wavePips.forEach((pip, pipIndex) => {
      pip.classList.toggle('is-active', pipIndex === index);
      pip.classList.toggle('is-complete', pipIndex < index);
    });
  }

  function drawMinimap(state) {
    if (!ctx || !minimap || !state.playerPosition) return;
    const width = minimap.width;
    const height = minimap.height;
    const cx = width / 2;
    const cy = height / 2;
    const radius = 82;
    const arenaRadius = state.arenaRadius || 9.65;
    const scale = radius / arenaRadius;
    const px = (x) => cx + x * scale;
    const py = (z) => cy + z * scale;
    ctx.clearRect(0, 0, width, height);
    ctx.save();
    ctx.beginPath();
    ctx.arc(cx, cy, radius, 0, Math.PI * 2);
    ctx.clip();
    ctx.fillStyle = 'rgba(9,7,11,.94)';
    ctx.fillRect(0, 0, width, height);

    ctx.strokeStyle = 'rgba(212,164,95,.08)';
    ctx.lineWidth = 1;
    for (let r = 3; r < arenaRadius; r += 3) {
      ctx.beginPath();
      ctx.arc(cx, cy, r * scale, 0, Math.PI * 2);
      ctx.stroke();
    }
    ctx.beginPath();
    ctx.moveTo(cx, 0);
    ctx.lineTo(cx, height);
    ctx.moveTo(0, cy);
    ctx.lineTo(width, cy);
    ctx.stroke();

    ctx.fillStyle = 'rgba(160,52,36,.2)';
    ctx.beginPath();
    ctx.arc(cx, cy, 3.7 * scale, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = 'rgba(255,90,50,.24)';
    ctx.stroke();

    ctx.fillStyle = 'rgba(130,120,112,.28)';
    (state.obstacles || []).forEach((obstacle) => {
      ctx.beginPath();
      ctx.arc(px(obstacle.x), py(obstacle.z), Math.max(1.5, obstacle.radius * scale), 0, Math.PI * 2);
      ctx.fill();
    });

    ctx.strokeStyle = 'rgba(255,58,34,.6)';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(cx, py(-9.2), 1.7 * scale, Math.PI, Math.PI * 2);
    ctx.stroke();

    (state.sigils || []).forEach((sigil) => {
      const x = px(sigil.x);
      const y = py(sigil.z);
      ctx.save();
      ctx.translate(x, y);
      ctx.rotate(Math.PI / 4);
      ctx.fillStyle = '#ffd27a';
      ctx.shadowColor = '#ff7a32';
      ctx.shadowBlur = 9;
      ctx.fillRect(-4, -4, 8, 8);
      ctx.restore();
    });

    (state.enemies || []).forEach((enemy) => {
      const x = px(enemy.x);
      const y = py(enemy.z);
      const boss = enemy.type === 'boss';
      ctx.beginPath();
      ctx.arc(x, y, boss ? 7 : enemy.type === 'brute' ? 5 : 4, 0, Math.PI * 2);
      ctx.fillStyle = boss ? '#ffb03e' : '#e33b25';
      ctx.shadowColor = boss ? '#ff8a2a' : '#ff2a18';
      ctx.shadowBlur = boss ? 12 : 6;
      ctx.fill();
      ctx.shadowBlur = 0;
      if (boss) {
        ctx.strokeStyle = '#ffdfa0';
        ctx.lineWidth = 1.5;
        ctx.stroke();
      }
    });

    const x = px(state.playerPosition.x);
    const y = py(state.playerPosition.z);
    const angle = state.playerFacing || 0;
    const fx = Math.sin(angle);
    const fy = Math.cos(angle);
    const rx = -Math.cos(angle);
    const ry = Math.sin(angle);
    ctx.beginPath();
    ctx.moveTo(x + fx * 9, y + fy * 9);
    ctx.lineTo(x - fx * 5 + rx * 5, y - fy * 5 + ry * 5);
    ctx.lineTo(x - fx * 5 - rx * 5, y - fy * 5 - ry * 5);
    ctx.closePath();
    ctx.fillStyle = '#f6e4c4';
    ctx.shadowColor = '#ffd08a';
    ctx.shadowBlur = 10;
    ctx.fill();
    ctx.shadowBlur = 0;
    ctx.restore();

    ctx.strokeStyle = 'rgba(212,164,95,.45)';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.arc(cx, cy, radius, 0, Math.PI * 2);
    ctx.stroke();
    ctx.fillStyle = 'rgba(212,164,95,.7)';
    ctx.font = '700 9px Inter, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('N', cx, 13);
  }

  function showEnd(result) {
    const victory = Boolean(result.victory);
    elements.endEyebrow.textContent = victory ? 'QUEST COMPLETE' : 'QUEST FAILED';
    elements.endTitle.textContent = victory ? 'EMBER REBORN' : 'THE EMBER FADES';
    elements.endCopy.textContent = victory
      ? 'The dragonfire burns bright again. The courtyard belongs to the knight.'
      : 'The Cinder Warden still holds the courtyard. Rise and try again.';
    const stats = [
      ['SCORE', result.score.toLocaleString()],
      ['TIME', formatTime(result.time)],
      ['SIGILS', `${result.sigils} / 6`],
      ['KILLS', result.kills],
      ['WAVE', `${Math.min(3, result.wave + 1)} / 3`],
      ['BEST COMBO', `${result.bestCombo ?? 0}×`],
    ];
    elements.endStats.innerHTML = stats
      .map(([label, value]) => `<div><span>${label}</span><b>${value}</b></div>`)
      .join('');
    setScreen('ended');
  }

  function update(dt, state) {
    lastState = state;
    if (state.fps) fpsSmoothed += (state.fps - fpsSmoothed) * Math.min(1, dt * 3);
    const healthRatio = Math.max(0, Math.min(1, state.health / state.maxHealth));
    const staminaRatio = Math.max(0, Math.min(1, state.stamina / state.maxStamina));
    elements.healthFill.style.width = `${healthRatio * 100}%`;
    elements.healthText.textContent = `${Math.ceil(state.health)}`;
    elements.staminaFill.style.width = `${staminaRatio * 100}%`;
    elements.staminaText.textContent = `${Math.ceil(state.stamina)}`;
    elements.score.textContent = Math.round(state.score).toLocaleString();
    elements.time.textContent = formatTime(state.time);
    elements.fps.textContent = `${Math.round(fpsSmoothed)}`;
    elements.sigils.textContent = `${state.sigilsCollected} / ${state.sigilsTotal}`;
    elements.kills.textContent = `${state.kills}`;
    if (state.objective) setObjective(state.objective);
    setWave(state.waveIndex || 0);
    if (state.bossVisible !== undefined) setBoss(state.bossVisible, state.bossHealth || 0);

    if (messageTimer > 0) {
      messageTimer -= dt;
      if (messageTimer <= 0) elements.message.classList.remove('is-visible');
    }
    if (toastTimer > 0) {
      toastTimer -= dt;
      if (toastTimer <= 0) elements.toast.classList.remove('is-visible');
    }
    if (comboTimer > 0) {
      comboTimer -= dt;
      if (comboTimer <= 0) elements.combo.classList.remove('is-visible');
    }
    if (damageTimer > 0) {
      damageTimer -= dt;
      if (damageTimer <= 0) elements.damageFlash.classList.remove('is-active');
    }
    minimapTimer -= dt;
    if (minimapTimer <= 0) {
      drawMinimap(state);
      minimapTimer = 0.09;
    }
  }

  return {
    hideLoading,
    setScreen,
    setQualityLabel,
    setFullscreen,
    setSound,
    message,
    toast,
    setCombo,
    flashDamage,
    floatText,
    setBoss,
    setObjective,
    setWave,
    showEnd,
    update,
    setCamera(value) { camera = value; },
    getCamera() { return camera; },
    get screen() { return activeScreen; },
    get state() { return lastState; },
  };
}
