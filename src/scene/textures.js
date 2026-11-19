import * as THREE from 'three';

export function seededRandom(seed = 1337) {
  let value = seed >>> 0;
  return () => {
    value += 0x6d2b79f5;
    let x = value;
    x = Math.imul(x ^ (x >>> 15), x | 1);
    x ^= x + Math.imul(x ^ (x >>> 7), x | 61);
    return ((x ^ (x >>> 14)) >>> 0) / 4294967296;
  };
}

function createCanvas(width, height = width) {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  return canvas;
}

function makeTexture(canvas, { srgb = true, repeat = [1, 1], anisotropy = 8 } = {}) {
  const texture = new THREE.CanvasTexture(canvas);
  if (srgb) texture.colorSpace = THREE.SRGBColorSpace;
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.repeat.set(repeat[0], repeat[1]);
  texture.anisotropy = anisotropy;
  texture.needsUpdate = true;
  return texture;
}

function addGrain(ctx, width, height, rng, amount = 20, alpha = 0.14) {
  const image = ctx.getImageData(0, 0, width, height);
  const data = image.data;
  for (let i = 0; i < data.length; i += 4) {
    const n = (rng() - 0.5) * amount;
    data[i] = Math.max(0, Math.min(255, data[i] + n));
    data[i + 1] = Math.max(0, Math.min(255, data[i + 1] + n));
    data[i + 2] = Math.max(0, Math.min(255, data[i + 2] + n));
  }
  ctx.putImageData(image, 0, 0);
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.strokeStyle = '#ffffff';
  ctx.lineWidth = 0.7;
  for (let i = 0; i < width * 0.28; i += 1) {
    const x = rng() * width;
    const y = rng() * height;
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(x + (rng() - 0.5) * 34, y + (rng() - 0.5) * 5);
    ctx.stroke();
  }
  ctx.restore();
}

function drawDragonHead(ctx, x, y, angle, scale, color = '#9d1718', highlight = '#e24632') {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(angle);
  ctx.scale(scale, scale);
  ctx.fillStyle = color;
  ctx.strokeStyle = highlight;
  ctx.lineWidth = 2.5;
  ctx.shadowColor = 'rgba(240, 47, 28, 0.55)';
  ctx.shadowBlur = 12;
  ctx.beginPath();
  ctx.moveTo(-18, 2);
  ctx.quadraticCurveTo(-12, -10, 2, -9);
  ctx.lineTo(12, -7);
  ctx.lineTo(22, -1);
  ctx.lineTo(13, 6);
  ctx.lineTo(2, 8);
  ctx.quadraticCurveTo(-9, 12, -18, 2);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
  ctx.shadowBlur = 0;
  ctx.strokeStyle = '#e6a17c';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(-7, -7);
  ctx.lineTo(-15, -19);
  ctx.moveTo(1, -9);
  ctx.lineTo(-2, -21);
  ctx.stroke();
  ctx.fillStyle = '#f4c27a';
  ctx.beginPath();
  ctx.arc(9, -2, 2.1, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

function drawThreeHeadedDragon(ctx, cx, cy, scale = 1, opacity = 1, withRing = true) {
  ctx.save();
  ctx.globalAlpha = opacity;
  ctx.translate(cx, cy);
  ctx.scale(scale, scale);

  if (withRing) {
    ctx.strokeStyle = '#b28c56';
    ctx.lineWidth = 7;
    ctx.beginPath();
    ctx.arc(0, 0, 205, 0, Math.PI * 2);
    ctx.stroke();
    ctx.strokeStyle = '#4b1010';
    ctx.lineWidth = 3;
    ctx.setLineDash([13, 10]);
    ctx.beginPath();
    ctx.arc(0, 0, 192, 0, Math.PI * 2);
    ctx.stroke();
    ctx.setLineDash([]);
  }

  const red = ctx.createLinearGradient(-170, -180, 180, 190);
  red.addColorStop(0, '#751317');
  red.addColorStop(0.45, '#cf3029');
  red.addColorStop(1, '#5e1115');

  ctx.shadowColor = 'rgba(235, 46, 28, 0.55)';
  ctx.shadowBlur = 28;
  ctx.fillStyle = red;
  ctx.strokeStyle = '#ff6147';
  ctx.lineWidth = 5.5;

  // Broad wing membranes with scalloped trailing edges and visible ribs.
  ctx.lineJoin = 'round';
  const drawWing = (side) => {
    ctx.save();
    ctx.scale(side, 1);
    ctx.beginPath();
    ctx.moveTo(-14, 38);
    ctx.bezierCurveTo(-78, -4, -132, -38, -178, -118);
    ctx.lineTo(-156, -108);
    ctx.lineTo(-168, -80);
    ctx.lineTo(-138, -91);
    ctx.lineTo(-145, -56);
    ctx.lineTo(-109, -70);
    ctx.lineTo(-111, -32);
    ctx.lineTo(-80, -48);
    ctx.lineTo(-60, -10);
    ctx.lineTo(-34, 20);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    ctx.strokeStyle = 'rgba(255, 164, 124, 0.46)';
    ctx.lineWidth = 3;
    [[-156, -108], [-138, -91], [-109, -70], [-80, -48]].forEach(([x, y]) => {
      ctx.beginPath();
      ctx.moveTo(-12, 27);
      ctx.quadraticCurveTo(-86, -28, x, y);
      ctx.stroke();
    });
    ctx.restore();
  };
  drawWing(1);
  drawWing(-1);
  ctx.strokeStyle = '#ff6147';
  ctx.lineWidth = 5.5;

  // Central body and chest shield.
  ctx.beginPath();
  ctx.ellipse(0, 48, 68, 88, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(-46, 10);
  ctx.quadraticCurveTo(0, -22, 46, 10);
  ctx.quadraticCurveTo(38, 40, 0, 46);
  ctx.quadraticCurveTo(-38, 40, -46, 10);
  ctx.fill();
  ctx.stroke();

  // Three thick necks.
  const neck = (x1, y1, x2, y2, x3, y3) => {
    ctx.strokeStyle = '#8e171a';
    ctx.lineWidth = 42;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(0, 12);
    ctx.bezierCurveTo(x1, y1, x2, y2, x3, y3);
    ctx.stroke();
    ctx.strokeStyle = '#dc382e';
    ctx.lineWidth = 8;
    ctx.beginPath();
    ctx.moveTo(0, 8);
    ctx.bezierCurveTo(x1, y1 - 4, x2, y2 - 5, x3, y3 - 6);
    ctx.stroke();
  };

  neck(-76, -16, -102, -72, -116, -108);
  neck(0, -46, 0, -94, 0, -136);
  neck(76, -16, 102, -72, 116, -108);

  drawDragonHead(ctx, -120, -114, -0.55, 1.28);
  drawDragonHead(ctx, 0, -144, 0, 1.34);
  drawDragonHead(ctx, 120, -114, 0.55, 1.28);

  // Tail and scale engraving.
  ctx.shadowBlur = 8;
  ctx.strokeStyle = '#c72a25';
  ctx.lineWidth = 20;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(8, 110);
  ctx.bezierCurveTo(88, 146, 120, 96, 96, 62);
  ctx.bezierCurveTo(78, 38, 48, 52, 56, 78);
  ctx.stroke();

  ctx.strokeStyle = 'rgba(255, 151, 112, 0.38)';
  ctx.lineWidth = 2.5;
  for (let row = 0; row < 5; row += 1) {
    for (let col = -3; col <= 3; col += 1) {
      const x = col * 18 + (row % 2) * 9;
      const y = 8 + row * 20;
      ctx.beginPath();
      ctx.arc(x, y, 8, Math.PI * 0.1, Math.PI * 0.9);
      ctx.stroke();
    }
  }
  ctx.restore();
}

function createSigilTexture(size = 768, anisotropy = 8) {
  const canvas = createCanvas(size);
  const ctx = canvas.getContext('2d');
  const rng = seededRandom(4117);
  const bg = ctx.createRadialGradient(size * 0.5, size * 0.45, 20, size * 0.5, size * 0.5, size * 0.72);
  bg.addColorStop(0, '#242326');
  bg.addColorStop(0.7, '#111014');
  bg.addColorStop(1, '#070608');
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, size, size);

  ctx.save();
  ctx.globalAlpha = 0.12;
  for (let i = 0; i < 140; i += 1) {
    ctx.strokeStyle = rng() > 0.5 ? '#ffffff' : '#b95a43';
    ctx.lineWidth = rng() * 2;
    const x = rng() * size;
    const y = rng() * size;
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(x + (rng() - 0.5) * 90, y + (rng() - 0.5) * 14);
    ctx.stroke();
  }
  ctx.restore();

  drawThreeHeadedDragon(ctx, size / 2, size / 2 + 38, size / 520, 0.94, true);
  addGrain(ctx, size, size, rng, 12, 0.05);
  return makeTexture(canvas, { anisotropy });
}

function createCapeTexture(width = 512, height = 768, anisotropy = 8) {
  const canvas = createCanvas(width, height);
  const ctx = canvas.getContext('2d');
  const rng = seededRandom(90210);
  const grad = ctx.createLinearGradient(0, 0, 0, height);
  grad.addColorStop(0, '#641219');
  grad.addColorStop(0.42, '#3c090e');
  grad.addColorStop(1, '#120609');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, width, height);

  // Broad woven folds.
  for (let i = 0; i < 16; i += 1) {
    const x = (i / 15) * width;
    const fold = ctx.createLinearGradient(x - 25, 0, x + 25, 0);
    fold.addColorStop(0, 'rgba(0,0,0,0)');
    fold.addColorStop(0.5, i % 2 ? 'rgba(255,90,70,0.055)' : 'rgba(0,0,0,0.23)');
    fold.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = fold;
    ctx.fillRect(x - 25, 0, 50, height);
  }

  ctx.save();
  ctx.globalCompositeOperation = 'screen';
  drawThreeHeadedDragon(ctx, width / 2, height * 0.58, width / 690, 0.19, false);
  ctx.restore();

  // Worn embroidered border.
  ctx.strokeStyle = 'rgba(181, 129, 87, 0.5)';
  ctx.lineWidth = 5;
  ctx.setLineDash([18, 14]);
  ctx.strokeRect(18, 18, width - 36, height - 36);
  ctx.setLineDash([]);
  ctx.strokeStyle = 'rgba(110, 10, 15, 0.9)';
  ctx.lineWidth = 12;
  ctx.strokeRect(32, 32, width - 64, height - 64);
  addGrain(ctx, width, height, rng, 15, 0.07);
  return makeTexture(canvas, { anisotropy });
}

function createEngravingTexture(size = 512, anisotropy = 8) {
  const canvas = createCanvas(size);
  const ctx = canvas.getContext('2d');
  ctx.clearRect(0, 0, size, size);
  ctx.strokeStyle = 'rgba(219, 211, 195, 0.78)';
  ctx.lineWidth = 2;
  ctx.shadowColor = 'rgba(255, 225, 180, 0.35)';
  ctx.shadowBlur = 5;

  for (const side of [-1, 1]) {
    ctx.save();
    ctx.translate(size / 2, size / 2);
    ctx.scale(side, 1);
    ctx.beginPath();
    ctx.moveTo(18, 130);
    ctx.bezierCurveTo(60, 70, 135, 75, 150, 125);
    ctx.bezierCurveTo(165, 170, 120, 205, 85, 175);
    ctx.bezierCurveTo(55, 150, 82, 112, 112, 132);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(30, 145);
    ctx.bezierCurveTo(85, 195, 135, 210, 190, 155);
    ctx.bezierCurveTo(210, 135, 220, 108, 228, 76);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(190, 155);
    ctx.quadraticCurveTo(205, 170, 226, 158);
    ctx.quadraticCurveTo(238, 150, 244, 135);
    ctx.stroke();
    for (let i = 0; i < 5; i += 1) {
      ctx.beginPath();
      ctx.arc(65 + i * 25, 165 + Math.sin(i) * 8, 5, 0.15 * Math.PI, 0.85 * Math.PI);
      ctx.stroke();
    }
    ctx.restore();
  }

  ctx.beginPath();
  ctx.moveTo(size / 2, 82);
  ctx.lineTo(size / 2, 430);
  ctx.stroke();
  for (let y = 100; y < 420; y += 34) {
    ctx.beginPath();
    ctx.arc(size / 2, y, 6, 0, Math.PI * 2);
    ctx.stroke();
  }
  return makeTexture(canvas, { anisotropy });
}

function createStoneTexture(size = 512, anisotropy = 8) {
  const canvas = createCanvas(size);
  const ctx = canvas.getContext('2d');
  const rng = seededRandom(7229);
  ctx.fillStyle = '#242326';
  ctx.fillRect(0, 0, size, size);

  const rows = 4;
  const h = size / rows;
  for (let row = 0; row < rows; row += 1) {
    const offset = row % 2 ? -size / 8 : 0;
    for (let col = -1; col < 5; col += 1) {
      const x = offset + col * (size / 4);
      const value = 28 + Math.floor(rng() * 17);
      ctx.fillStyle = `rgb(${value},${value - 1},${value + 1})`;
      ctx.fillRect(x + 3, row * h + 3, size / 4 - 6, h - 6);
      ctx.fillStyle = 'rgba(255,255,255,0.025)';
      ctx.fillRect(x + 4, row * h + 4, size / 4 - 8, 2);
    }
  }

  ctx.strokeStyle = 'rgba(7, 6, 8, 0.65)';
  ctx.lineWidth = 4;
  for (let i = 0; i <= rows; i += 1) {
    ctx.beginPath();
    ctx.moveTo(0, i * h);
    ctx.lineTo(size, i * h);
    ctx.stroke();
  }
  for (let i = 0; i < 45; i += 1) {
    const x = rng() * size;
    const y = rng() * size;
    ctx.strokeStyle = `rgba(5,4,6,${0.1 + rng() * 0.24})`;
    ctx.lineWidth = 0.6 + rng() * 1.4;
    ctx.beginPath();
    ctx.moveTo(x, y);
    for (let k = 0; k < 5; k += 1) ctx.lineTo(x + (rng() - 0.5) * 45 + k * 4, y + (rng() - 0.5) * 45);
    ctx.stroke();
  }
  addGrain(ctx, size, size, rng, 22, 0.07);
  return makeTexture(canvas, { repeat: [4, 4], anisotropy });
}

function createGrainTexture(size = 256, anisotropy = 4) {
  const canvas = createCanvas(size);
  const ctx = canvas.getContext('2d');
  const rng = seededRandom(818);
  ctx.fillStyle = '#8a8a8a';
  ctx.fillRect(0, 0, size, size);
  addGrain(ctx, size, size, rng, 70, 0.25);
  return makeTexture(canvas, { srgb: false, repeat: [3, 3], anisotropy });
}

function createBannerTexture(width = 512, height = 1024, anisotropy = 8) {
  const canvas = createCanvas(width, height);
  const ctx = canvas.getContext('2d');
  const rng = seededRandom(3030);
  ctx.fillStyle = '#101013';
  ctx.fillRect(0, 0, width, height);
  const grad = ctx.createLinearGradient(0, 0, width, 0);
  grad.addColorStop(0, 'rgba(0,0,0,0.55)');
  grad.addColorStop(0.5, 'rgba(255,255,255,0.04)');
  grad.addColorStop(1, 'rgba(0,0,0,0.5)');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, width, height);
  drawThreeHeadedDragon(ctx, width / 2, height * 0.43, width / 500, 0.82, false);
  ctx.strokeStyle = '#7f1f1d';
  ctx.lineWidth = 16;
  ctx.strokeRect(8, 8, width - 16, height - 16);
  addGrain(ctx, width, height, rng, 18, 0.08);
  return makeTexture(canvas, { anisotropy });
}

function createFlameTexture(size = 128, anisotropy = 1) {
  const canvas = createCanvas(size);
  const ctx = canvas.getContext('2d');
  const gradient = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
  gradient.addColorStop(0, 'rgba(255,250,210,1)');
  gradient.addColorStop(0.2, 'rgba(255,176,65,0.95)');
  gradient.addColorStop(0.55, 'rgba(226,56,20,0.42)');
  gradient.addColorStop(1, 'rgba(160,12,8,0)');
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, size, size);
  return makeTexture(canvas, { anisotropy });
}

export function createProceduralTextures(renderer) {
  const anisotropy = Math.min(8, renderer?.capabilities?.getMaxAnisotropy?.() || 4);
  return {
    metalGrain: createGrainTexture(256, anisotropy),
    stone: createStoneTexture(512, anisotropy),
    sigil: createSigilTexture(768, anisotropy),
    cape: createCapeTexture(512, 768, anisotropy),
    engraving: createEngravingTexture(512, anisotropy),
    banner: createBannerTexture(512, 1024, anisotropy),
    flame: createFlameTexture(128, 1),
  };
}
