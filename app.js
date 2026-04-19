const introScreen = document.getElementById("intro-screen");
const trainerScreen = document.getElementById("trainer-screen");
const playButton = document.getElementById("play-button");
const closeButton = document.getElementById("close-button");
const toleranceInput = document.getElementById("tolerance-input");
const movementToggle = document.getElementById("movement-toggle");
const feedbackContent = document.getElementById("feedback-content");
const guessForm = document.getElementById("guess-form");
const guessInput = document.getElementById("guess-input");
const stage = document.getElementById("stimulus-stage");
const canvas = document.getElementById("stimulus-canvas");
const ctx = canvas.getContext("2d");
const resizeObserver = new ResizeObserver(() => {
  const resized = resizeCanvas();

  if (!resized) {
    return;
  }

  if (state.active && state.currentStimulus) {
    drawStimulus();
  } else {
    clearCanvas("#f2efe8");
  }
});

const state = {
  active: false,
  tolerance: 0.2,
  movementEnabled: false,
  currentStimulus: null,
  lastResult: null,
  animationFrame: null,
  lastAnimationTime: null,
  viewport: {
    width: 0,
    height: 0,
    ratio: 1,
  },
};

resizeObserver.observe(stage);

const symbolDrawers = {
  circle(context, x, y, size) {
    context.beginPath();
    context.arc(x, y, size * 0.5, 0, Math.PI * 2);
    context.fill();
  },
  square(context, x, y, size) {
    const half = size * 0.5;
    context.fillRect(x - half, y - half, size, size);
  },
  triangle(context, x, y, size) {
    const half = size * 0.58;
    context.beginPath();
    context.moveTo(x, y - half);
    context.lineTo(x + half, y + half);
    context.lineTo(x - half, y + half);
    context.closePath();
    context.fill();
  },
  diamond(context, x, y, size) {
    const half = size * 0.62;
    context.beginPath();
    context.moveTo(x, y - half);
    context.lineTo(x + half, y);
    context.lineTo(x, y + half);
    context.lineTo(x - half, y);
    context.closePath();
    context.fill();
  },
  x(context, x, y, size) {
    const half = size * 0.44;
    context.lineWidth = Math.max(1.5, size * 0.16);
    context.lineCap = "round";
    context.beginPath();
    context.moveTo(x - half, y - half);
    context.lineTo(x + half, y + half);
    context.moveTo(x + half, y - half);
    context.lineTo(x - half, y + half);
    context.stroke();
  },
  line(context, x, y, size, rotation) {
    const half = size * 0.5;
    context.save();
    context.translate(x, y);
    context.rotate(rotation);
    context.lineWidth = Math.max(1.5, size * 0.2);
    context.lineCap = "round";
    context.beginPath();
    context.moveTo(-half, 0);
    context.lineTo(half, 0);
    context.stroke();
    context.restore();
  },
};

playButton.addEventListener("click", startSession);
closeButton.addEventListener("click", stopSession);
guessForm.addEventListener("submit", handleGuessSubmit);
window.addEventListener("resize", handleResize);
window.addEventListener("keydown", (event) => {
  if (event.key === "Escape" && state.active) {
    stopSession();
  }
});

function startSession() {
  const tolerancePercent = clamp(Number.parseFloat(toleranceInput.value) || 20, 1, 100);

  toleranceInput.value = String(tolerancePercent);
  state.tolerance = tolerancePercent / 100;
  state.movementEnabled = movementToggle.checked;
  state.active = true;
  state.lastResult = null;

  introScreen.classList.add("hidden");
  trainerScreen.classList.remove("hidden");
  trainerScreen.setAttribute("aria-hidden", "false");

  renderFeedback();
  scheduleInitialStimulus();
}

function stopSession() {
  stopAnimationLoop();
  state.active = false;
  state.currentStimulus = null;

  trainerScreen.classList.add("hidden");
  trainerScreen.setAttribute("aria-hidden", "true");
  introScreen.classList.remove("hidden");
  clearCanvas("#f2efe8");
}

function handleResize() {
  resizeCanvas();

  if (state.active) {
    drawStimulus();
  } else {
    clearCanvas("#f2efe8");
  }
}

function handleGuessSubmit(event) {
  event.preventDefault();

  if (!state.active || !state.currentStimulus) {
    return;
  }

  const guess = Number.parseInt(guessInput.value, 10);

  if (!Number.isFinite(guess) || guess < 0) {
    guessInput.select();
    return;
  }

  const actual = state.currentStimulus.count;
  const relativeError = Math.abs(guess - actual) / actual;
  const success = relativeError <= state.tolerance;

  state.lastResult = {
    guess,
    actual,
    relativeError,
    success,
  };

  renderFeedback();
  prepareNextStimulus();
  guessInput.value = "";
  guessInput.focus();
}

function prepareNextStimulus() {
  const resized = resizeCanvas();

  if (!resized) {
    return false;
  }

  stopAnimationLoop();
  state.currentStimulus = createStimulus(state.viewport.width, state.viewport.height);
  drawStimulus();
  startAnimationLoop();
  scheduleRedrawBurst();
  return true;
}

function resizeCanvas() {
  const rect = stage.getBoundingClientRect();
  const width = Math.floor(rect.width);
  const height = Math.floor(rect.height);

  if (width <= 0 || height <= 0) {
    state.viewport = { width: 0, height: 0, ratio: window.devicePixelRatio || 1 };
    return false;
  }

  const ratio = window.devicePixelRatio || 1;
  const nextBackingWidth = Math.floor(width * ratio);
  const nextBackingHeight = Math.floor(height * ratio);

  if (canvas.width !== nextBackingWidth || canvas.height !== nextBackingHeight) {
    canvas.width = nextBackingWidth;
    canvas.height = nextBackingHeight;
  }

  state.viewport = { width, height, ratio };
  ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
  return true;
}

function createStimulus(width, height) {
  const count = randomLogInt(20, 2000);
  const background = Math.random() < 0.5 ? "#ffffff" : "#050505";
  const arrangement = sample(["grid", "gridMissing", "jittered", "phyllotaxis"]);
  const symbol = sample(Object.keys(symbolDrawers));
  const palette = createPalette(background);
  const positions = createArrangement(arrangement, count, width, height);
  const movementMode = selectMovementMode(count);
  const particles = createParticles(positions, movementMode, width, height);

  return {
    count,
    background,
    arrangement,
    symbol,
    palette,
    movementMode,
    particles: assignParticleColors(particles, palette),
  };
}

function drawStimulus() {
  if (!state.currentStimulus) {
    return;
  }

  const { background, particles, symbol } = state.currentStimulus;

  clearCanvas(background);

  for (const point of particles) {
    const rotation = point.rotation ?? Math.random() * Math.PI;

    ctx.fillStyle = point.color;
    ctx.strokeStyle = point.color;

    symbolDrawers[symbol](ctx, point.x, point.y, point.size, rotation);
  }
}

function clearCanvas(color) {
  if (state.viewport.width <= 0 || state.viewport.height <= 0) {
    return;
  }

  ctx.save();
  ctx.fillStyle = color;
  ctx.fillRect(0, 0, state.viewport.width, state.viewport.height);
  ctx.restore();
}

function scheduleInitialStimulus(attempt = 0) {
  window.requestAnimationFrame(() => {
    if (!state.active) {
      return;
    }

    const ready = prepareNextStimulus();

    if (!ready && attempt < 8) {
      scheduleInitialStimulus(attempt + 1);
      return;
    }

    guessInput.value = "";
    guessInput.focus();
  });
}

function scheduleRedrawBurst() {
  let remainingFrames = 3;

  function redrawOnFrame() {
    if (!state.active || !state.currentStimulus) {
      return;
    }

    drawStimulus();
    remainingFrames -= 1;

    if (remainingFrames > 0) {
      window.requestAnimationFrame(redrawOnFrame);
    }
  }

  window.requestAnimationFrame(redrawOnFrame);
  window.setTimeout(() => {
    if (!state.active || !state.currentStimulus) {
      return;
    }

    drawStimulus();
  }, 120);
}

function startAnimationLoop() {
  if (!state.active || !state.currentStimulus || state.currentStimulus.movementMode === "stationary") {
    return;
  }

  stopAnimationLoop();
  state.lastAnimationTime = null;

  function animate(timestamp) {
    if (!state.active || !state.currentStimulus || state.currentStimulus.movementMode === "stationary") {
      stopAnimationLoop();
      return;
    }

    if (state.lastAnimationTime === null) {
      state.lastAnimationTime = timestamp;
    }

    const dt = Math.min(0.033, (timestamp - state.lastAnimationTime) / 1000 || 0.016);
    state.lastAnimationTime = timestamp;
    updateStimulusMotion(state.currentStimulus, dt);
    drawStimulus();
    state.animationFrame = window.requestAnimationFrame(animate);
  }

  state.animationFrame = window.requestAnimationFrame(animate);
}

function stopAnimationLoop() {
  if (state.animationFrame !== null) {
    window.cancelAnimationFrame(state.animationFrame);
  }

  state.animationFrame = null;
  state.lastAnimationTime = null;
}

function renderFeedback() {
  const result = state.lastResult;

  if (!result) {
    feedbackContent.className = "feedback empty";
    feedbackContent.innerHTML = "<span>Start a round to begin.</span>";
    return;
  }

  const tolerancePercent = Math.round(state.tolerance * 100);
  const errorPercent = Math.round(result.relativeError * 1000) / 10;
  const outcomeClass = result.success ? "result-success" : "result-fail";
  const outcomeText = result.success ? "Within tolerance" : "Outside tolerance";

  feedbackContent.className = "feedback";
  feedbackContent.innerHTML = `
    <span class="pill ${outcomeClass}">${outcomeText}</span>
    <span class="pill">Guess: ${formatNumber(result.guess)}</span>
    <span class="pill">Actual: ${formatNumber(result.actual)}</span>
    <span class="pill">Error: ${errorPercent}%</span>
    <span class="pill">Tolerance: ${tolerancePercent}%</span>
  `;
}

function createPalette(background) {
  const brightBackground = background === "#ffffff";
  const schemes = brightBackground
    ? [
        { mode: "mono", base: `hsl(0 0% ${randomBetween(8, 22)}%)` },
        {
          mode: "band",
          hueStart: randomBetween(120, 240),
          hueSpan: randomBetween(18, 64),
          saturation: randomBetween(45, 88),
          lightness: randomBetween(18, 42),
        },
        {
          mode: "rainbow",
          saturation: randomBetween(58, 84),
          lightness: randomBetween(24, 44),
        },
      ]
    : [
        { mode: "mono", base: `hsl(0 0% ${randomBetween(78, 96)}%)` },
        {
          mode: "band",
          hueStart: randomBetween(0, 360),
          hueSpan: randomBetween(24, 88),
          saturation: randomBetween(55, 95),
          lightness: randomBetween(60, 78),
        },
        {
          mode: "rainbow",
          saturation: randomBetween(62, 94),
          lightness: randomBetween(60, 76),
        },
      ];

  return sample(schemes);
}

function getPointColor(palette, index, total) {
  if (palette.mode === "mono") {
    return palette.base;
  }

  const t = total <= 1 ? 0.5 : index / (total - 1);

  if (palette.mode === "band") {
    const hue = (palette.hueStart + palette.hueSpan * t + randomBetween(-6, 6)) % 360;
    return `hsl(${hue} ${palette.saturation}% ${palette.lightness}%)`;
  }

  const hue = (t * 360 + randomBetween(-18, 18) + 360) % 360;
  return `hsl(${hue} ${palette.saturation}% ${palette.lightness}%)`;
}

function createArrangement(type, count, width, height) {
  const padding = Math.max(28, Math.min(width, height) * 0.05);
  const usableWidth = Math.max(120, width - padding * 2);
  const usableHeight = Math.max(120, height - padding * 2);

  if (type === "phyllotaxis") {
    return createPhyllotaxisArrangement(count, width, height, padding);
  }

  const sparse = type === "gridMissing";
  const slotCount = sparse ? Math.ceil(count * randomBetween(1.15, 1.45)) : count;
  const aspectRatio = usableWidth / usableHeight;
  const cols = Math.max(1, Math.round(Math.sqrt(slotCount * aspectRatio)));
  const rows = Math.max(1, Math.ceil(slotCount / cols));
  const cellWidth = usableWidth / cols;
  const cellHeight = usableHeight / rows;
  const size = Math.max(3, Math.min(cellWidth, cellHeight) * randomBetween(0.36, 0.58));

  const slots = [];

  for (let row = 0; row < rows; row += 1) {
    for (let col = 0; col < cols; col += 1) {
      if (slots.length >= slotCount) {
        break;
      }

      const baseX = padding + col * cellWidth + cellWidth * 0.5;
      const baseY = padding + row * cellHeight + cellHeight * 0.5;
      const jitter =
        type === "jittered"
          ? {
              x: randomBetween(-cellWidth * 0.24, cellWidth * 0.24),
              y: randomBetween(-cellHeight * 0.24, cellHeight * 0.24),
            }
          : { x: 0, y: 0 };

      slots.push({
        x: baseX + jitter.x,
        y: baseY + jitter.y,
        size,
        rotation: Math.random() * Math.PI,
      });
    }
  }

  shuffle(slots);
  return slots.slice(0, count).map((point, index) => ({ ...point, index }));
}

function createPhyllotaxisArrangement(count, width, height, padding) {
  const centerX = width * 0.5;
  const centerY = height * 0.5;
  const radiusLimit = Math.max(24, Math.min(width, height) * 0.5 - padding);
  const size = Math.max(3, Math.min(24, radiusLimit / Math.sqrt(count) * 1.3));
  const spread = Math.max(size * 0.78, (radiusLimit - size) / Math.sqrt(count));
  const goldenAngle = Math.PI * (3 - Math.sqrt(5));
  const points = [];

  for (let index = 0; index < count; index += 1) {
    const r = spread * Math.sqrt(index + 0.5);
    const theta = index * goldenAngle + randomBetween(-0.06, 0.06);

    points.push({
        x: centerX + Math.cos(theta) * r,
        y: centerY + Math.sin(theta) * r,
        size,
        rotation: theta,
        index: 0,
      });
  }

  shuffle(points);
  return points.map((point, index) => ({ ...point, index }));
}

function selectMovementMode(count) {
  if (!state.movementEnabled) {
    return "stationary";
  }

  const modes = ["stationary", "randomWalk", "bounce", "bounceTurn"];

  if (count <= 260) {
    modes.push("boids");
  }

  return sample(modes);
}

function createParticles(positions, movementMode, width, height) {
  return positions.map((point) => {
    const speed = movementMode === "boids" ? randomBetween(36, 84) : randomBetween(28, 108);
    const angle = Math.random() * Math.PI * 2;

    return {
      ...point,
      homeX: point.x,
      homeY: point.y,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed,
      turnTimer: randomBetween(0.4, 1.8),
      maxSpeed:
        movementMode === "randomWalk"
          ? randomBetween(52, 116)
          : movementMode === "boids"
            ? randomBetween(56, 104)
            : randomBetween(36, 136),
    };
  });
}

function assignParticleColors(particles, palette) {
  return particles.map((particle, index) => ({
    ...particle,
    color: getPointColor(palette, index, particles.length),
  }));
}

function updateStimulusMotion(stimulus, dt) {
  const { movementMode, particles } = stimulus;

  if (movementMode === "randomWalk") {
    for (const particle of particles) {
      const turn = randomBetween(-2.6, 2.6);
      const cos = Math.cos(turn * dt);
      const sin = Math.sin(turn * dt);
      const nextVx = particle.vx * cos - particle.vy * sin;
      const nextVy = particle.vx * sin + particle.vy * cos;

      particle.vx = nextVx + randomBetween(-40, 40) * dt;
      particle.vy = nextVy + randomBetween(-40, 40) * dt;
      limitVelocity(particle);
      particle.x += particle.vx * dt;
      particle.y += particle.vy * dt;
      bounceParticle(particle);
    }

    return;
  }

  if (movementMode === "bounce" || movementMode === "bounceTurn") {
    for (const particle of particles) {
      if (movementMode === "bounceTurn") {
        particle.turnTimer -= dt;

        if (particle.turnTimer <= 0) {
          const angle = Math.atan2(particle.vy, particle.vx) + randomBetween(-1.7, 1.7);
          const speed = Math.max(8, Math.hypot(particle.vx, particle.vy));

          particle.vx = Math.cos(angle) * speed;
          particle.vy = Math.sin(angle) * speed;
          particle.turnTimer = randomBetween(0.5, 2.2);
        }
      }

      particle.x += particle.vx * dt;
      particle.y += particle.vy * dt;
      bounceParticle(particle);
    }

    return;
  }

  if (movementMode === "boids") {
    updateBoids(stimulus, dt);
  }
}

function updateBoids(stimulus, dt) {
  const { particles } = stimulus;
  const sampleSize = Math.min(8, Math.max(4, Math.floor(Math.sqrt(particles.length) / 2)));
  const perception = Math.max(48, Math.min(state.viewport.width, state.viewport.height) * 0.12);
  const separationDistance = perception * 0.42;

  for (let index = 0; index < particles.length; index += 1) {
    const particle = particles[index];
    let cohesionX = 0;
    let cohesionY = 0;
    let alignmentX = 0;
    let alignmentY = 0;
    let separationX = 0;
    let separationY = 0;
    let neighbors = 0;

    for (let offset = 1; offset <= sampleSize; offset += 1) {
      const neighbor = particles[(index + offset * 13) % particles.length];

      if (neighbor === particle) {
        continue;
      }

      const dx = neighbor.x - particle.x;
      const dy = neighbor.y - particle.y;
      const distance = Math.hypot(dx, dy);

      if (distance === 0 || distance > perception) {
        continue;
      }

      cohesionX += neighbor.x;
      cohesionY += neighbor.y;
      alignmentX += neighbor.vx;
      alignmentY += neighbor.vy;
      neighbors += 1;

      if (distance < separationDistance) {
        separationX -= dx / distance;
        separationY -= dy / distance;
      }
    }

    if (neighbors > 0) {
      particle.vx += ((cohesionX / neighbors - particle.x) * 0.036 + alignmentX / neighbors * 0.06) * dt;
      particle.vy += ((cohesionY / neighbors - particle.y) * 0.036 + alignmentY / neighbors * 0.06) * dt;
      particle.vx += separationX * 44 * dt;
      particle.vy += separationY * 44 * dt;
    }

    particle.vx += (particle.homeX - particle.x) * 0.02 * dt;
    particle.vy += (particle.homeY - particle.y) * 0.02 * dt;

    limitVelocity(particle);
  }

  for (const particle of particles) {
    particle.x += particle.vx * dt;
    particle.y += particle.vy * dt;
    bounceParticle(particle);
  }
}

function limitVelocity(particle) {
  const speed = Math.hypot(particle.vx, particle.vy);

  if (speed <= particle.maxSpeed) {
    return;
  }

  const scale = particle.maxSpeed / speed;
  particle.vx *= scale;
  particle.vy *= scale;
}

function bounceParticle(particle) {
  const minX = particle.size * 0.7;
  const maxX = state.viewport.width - particle.size * 0.7;
  const minY = particle.size * 0.7;
  const maxY = state.viewport.height - particle.size * 0.7;

  if (particle.x < minX) {
    particle.x = minX;
    particle.vx = Math.abs(particle.vx);
  } else if (particle.x > maxX) {
    particle.x = maxX;
    particle.vx = -Math.abs(particle.vx);
  }

  if (particle.y < minY) {
    particle.y = minY;
    particle.vy = Math.abs(particle.vy);
  } else if (particle.y > maxY) {
    particle.y = maxY;
    particle.vy = -Math.abs(particle.vy);
  }

  if (Math.abs(particle.vx) + Math.abs(particle.vy) < 1) {
    const angle = Math.random() * Math.PI * 2;
    particle.vx = Math.cos(angle) * particle.maxSpeed * 0.5;
    particle.vy = Math.sin(angle) * particle.maxSpeed * 0.5;
  }
}

function randomLogInt(min, max) {
  const minLog = Math.log(min);
  const maxLog = Math.log(max);
  return Math.round(Math.exp(randomBetween(minLog, maxLog)));
}

function randomBetween(min, max) {
  return min + Math.random() * (max - min);
}

function sample(items) {
  return items[Math.floor(Math.random() * items.length)];
}

function shuffle(items) {
  for (let index = items.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(Math.random() * (index + 1));
    [items[index], items[swapIndex]] = [items[swapIndex], items[index]];
  }

  return items;
}

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function formatNumber(value) {
  return new Intl.NumberFormat().format(value);
}

handleResize();
