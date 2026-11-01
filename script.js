/**
 * Pixaura — Focused Pixel Art Studio, Animation Timeline, Image Converter & Community Gallery
 */

const PALETTES = {
  verge: [
    '#131313', '#3cffd0', '#5200ff', '#ffe600',
    '#ff2a85', '#ff5500', '#3860be', '#ffffff',
    '#949494', '#2d2d2d', '#309875', '#1eaedb'
  ],
  pixaura: [
    '#14161a', '#334155', '#f43f5e', '#fbbf24',
    '#38bdf8', '#10b981', '#6366f1', '#f97316',
    '#a855f7', '#ec4899', '#ffffff', '#94a3b8'
  ],
  pico8: [
    '#000000', '#1D2B53', '#7E2553', '#008751',
    '#AB5236', '#5F574F', '#C2C3C7', '#FFF1E8',
    '#FF004D', '#FFA300', '#FFEC27', '#29ADFF'
  ],
  sunset: [
    '#141026', '#2b1b47', '#562359', '#8c3160',
    '#c44658', '#eb6f5b', '#f9a363', '#fed981',
    '#fff6c5', '#3d737f', '#244557', '#132433'
  ],
  gameboy: [
    '#0f380f', '#306230', '#8bac0f', '#9bbc0f',
    '#1a4c20', '#4f7a28', '#b7cf4f', '#e0f8d0'
  ]
};

const TOOL_LABELS = {
  pencil: 'Pencil (B)',
  eraser: 'Eraser (E)',
  fill: 'Bucket (G)',
  eyedropper: 'Picker (I)',
  line: 'Line (L)',
  rect: 'Rect (R)',
  circle: 'Circle (C)',
  mirror: 'Mirror (M)'
};

// Optional Subtle UI Sound (Off by default for distraction-free focus)
let sfxEnabled = false;
let audioCtx = null;

function playSfx(type = 'blip') {
  if (!sfxEnabled) return;
  try {
    if (!audioCtx) {
      const AudioContextClass = window.AudioContext || window.webkitAudioContext;
      if (!AudioContextClass) return;
      audioCtx = new AudioContextClass();
    }
    if (audioCtx.state === 'suspended') audioCtx.resume();

    const now = audioCtx.currentTime;
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    osc.connect(gain);
    gain.connect(audioCtx.destination);

    osc.type = 'sine';
    if (type === 'blip') {
      osc.frequency.setValueAtTime(520, now);
      gain.gain.setValueAtTime(0.025, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.045);
      osc.start(now);
      osc.stop(now + 0.045);
    } else if (type === 'coin') {
      osc.frequency.setValueAtTime(660, now);
      osc.frequency.setValueAtTime(880, now + 0.05);
      gain.gain.setValueAtTime(0.03, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.14);
      osc.start(now);
      osc.stop(now + 0.14);
    }
  } catch (_) {
    // Ignore audio context restrictions
  }
}

// Studio State
const studioState = {
  size: 32,
  tool: 'pencil',
  activeColor: '#3cffd0',
  palette: [...PALETTES.verge],
  brushSize: 1,
  fillShapes: false,
  showGrid: true,
  onionSkin: false,
  zoom: 100,
  fps: 8,
  loopMode: 'forward',
  isPlaying: true,
  activeLayerIndex: 2,
  activeFrameIndex: 0,
  layers: [],
  frames: [],
  undoStack: [],
  redoStack: [],
  isDragging: false,
  dragStart: null,
  hoverCoord: null,
  previewPixels: null
};

// Community & Workspace State
const appData = {
  filterCategory: 'all',
  filterFormat: 'all',
  filterSort: 'trending',
  searchQuery: '',
  activeWorkspaceTab: 'drafts',
  activeDetailPostId: null,
  detailPlaying: true,
  posts: [],
  drafts: [
    { id: 'draft-1', title: 'Disco Duck', template: 'duck', spec: '32×32 · 6 Frames · 3 Layers', updated: 'Just now' },
    { id: 'draft-2', title: 'Sunset River', template: 'sunset', spec: '32×32 · 4 Frames · 3 Layers', updated: '1 hr ago' },
    { id: 'draft-3', title: 'King Slime', template: 'slime', spec: '32×32 · 6 Frames · 3 Layers', updated: 'Yesterday' },
    { id: 'draft-4', title: 'Night Mage', template: 'goblin', spec: '32×32 · 4 Frames · 3 Layers', updated: '3 days ago' }
  ],
  references: [
    { id: 'ref-1', title: 'night-skyline.png', sample: 'cyberCity', spec: '1024×1024 → 32×32 (Bayer 4×4)' },
    { id: 'ref-2', title: 'fuji-sunset.jpg', sample: 'sunsetMountain', spec: '800×800 → 32×32 (12 Colors)' },
    { id: 'ref-3', title: 'mecha-unit.webp', sample: 'mechaPortrait', spec: '512×512 → 32×32 (Floyd-Steinberg)' }
  ]
};

// Procedural Pixel Art Generator for Starter Templates & Community Gallery
function generateTemplateProject(type, size = 32) {
  const layers = [
    { id: 'layer-bg', name: 'Background', visible: true, opacity: 100 },
    { id: 'layer-mid', name: 'Character / Main', visible: true, opacity: 100 },
    { id: 'layer-fg', name: 'Details & FX', visible: true, opacity: 100 }
  ];

  const makeGrid = () => new Array(size * size).fill(null);
  const setPx = (grid, x, y, color) => {
    if (x >= 0 && x < size && y >= 0 && y < size) {
      grid[y * size + x] = color;
    }
  };
  const fillRect = (grid, x0, y0, w, h, color) => {
    for (let y = y0; y < y0 + h; y++) {
      for (let x = x0; x < x0 + w; x++) setPx(grid, x, y, color);
    }
  };
  const fillCircle = (grid, cx, cy, r, color) => {
    for (let y = cy - r; y <= cy + r; y++) {
      for (let x = cx - r; x <= cx + r; x++) {
        if ((x - cx) * (x - cx) + (y - cy) * (y - cy) <= r * r) setPx(grid, x, y, color);
      }
    }
  };

  const frameCount = type === 'sword' ? 1 : (type === 'duck' || type === 'slime') ? 6 : 4;
  const frames = [];

  for (let f = 0; f < frameCount; f++) {
    const bg = makeGrid();
    const mid = makeGrid();
    const fg = makeGrid();

    if (type === 'duck') {
      fillRect(bg, 0, 0, size, size, '#181b22');
      fillRect(bg, 15, 0, 2, 3, '#64748b');
      fillCircle(bg, 16, 5, 3, f % 2 === 0 ? '#38bdf8' : '#f43f5e');
      setPx(bg, 15, 4, '#ffffff');
      const tileColors = ['#f43f5e', '#38bdf8', '#fbbf24', '#10b981'];
      for (let tx = 0; tx < size; tx += 8) {
        const c = tileColors[(tx / 8 + f) % tileColors.length];
        fillRect(bg, tx, 26, 8, 6, c);
        fillRect(bg, tx + 1, 27, 6, 4, '#1e222b');
      }

      const bob = [0, -1, -2, 0, -1, 1][f % 6];
      const wingUp = f % 2 === 0;
      fillRect(mid, 9, 17 + bob, 13, 7, '#fbbf24');
      fillRect(mid, 8, 18 + bob, 14, 5, '#fbbf24');
      fillRect(mid, 6, 16 + bob, 3, 3, '#fbbf24');
      fillRect(mid, 13, 10 + bob, 9, 8, '#fbbf24');
      fillRect(mid, 21, 13 + bob, 6, 2, '#f97316');
      fillRect(mid, 21, 15 + bob + (f % 2), 5, 1, '#f97316');
      if (wingUp) {
        fillRect(mid, 12, 14 + bob, 5, 4, '#f59e0b');
      } else {
        fillRect(mid, 12, 18 + bob, 6, 4, '#f59e0b');
      }
      fillRect(mid, 12, 24, 2, 3, '#f97316');
      fillRect(mid, 18, 24 - (f % 2), 2, 3, '#f97316');

      // Sunglasses
      fillRect(fg, 13, 12 + bob, 9, 2, '#0f172a');
      fillRect(fg, 16, 13 + bob, 2, 2, '#0f172a');
      fillRect(fg, 20, 13 + bob, 2, 2, '#0f172a');
      setPx(fg, 16, 12 + bob, '#38bdf8');
      setPx(fg, 20, 12 + bob, '#38bdf8');
    } else if (type === 'goblin') {
      fillRect(bg, 0, 0, size, size, '#14161a');
      fillRect(bg, 0, 26, size, 6, '#1e293b');
      const jitter = f % 2 === 0 ? 0 : 1;

      fillRect(mid, 6, 10 + jitter, 16, 2, '#6366f1');
      fillRect(mid, 10, 6 + jitter, 9, 4, '#6366f1');
      fillRect(mid, 12, 3 + jitter, 5, 3, '#818cf8');
      fillRect(mid, 10, 9 + jitter, 9, 1, '#fbbf24');

      fillRect(mid, 10, 12 + jitter, 9, 6, '#10b981');
      fillRect(mid, 6, 13 + jitter, 4, 2, '#10b981');
      fillRect(mid, 19, 13 + jitter, 4, 2, '#10b981');
      fillRect(fg, 11, 13 + jitter, 3, 3, '#ffffff');
      fillRect(fg, 16, 13 + jitter, 3, 3, '#ffffff');
      setPx(fg, 12, 14 + jitter, '#0f172a');
      setPx(fg, 17, 14 + jitter, '#0f172a');

      fillRect(mid, 9, 18, 11, 8, '#312e81');
      fillRect(fg, 21, 17 - jitter, 6, 7, '#f8fafc');
      fillRect(fg, 27, 18 - jitter, 2, 4, '#f8fafc');
      fillRect(fg, 22, 19 - jitter, 4, 3, '#f43f5e');
      setPx(fg, 23, 14 - (f % 3), '#38bdf8');
      setPx(fg, 25, 13 - ((f + 1) % 3), '#fbbf24');
    } else if (type === 'slime') {
      fillRect(bg, 0, 26, size, 6, '#1e293b');
      const bounceY = [0, -2, -5, -6, -3, 0][f % 6];
      const squashW = [14, 12, 10, 10, 12, 16][f % 6];
      const squashH = [10, 11, 13, 12, 11, 8][f % 6];
      const x0 = Math.floor((size - squashW) / 2);
      const y0 = 26 - squashH + bounceY;

      fillRect(mid, x0, y0 + 2, squashW, squashH - 2, '#059669');
      fillRect(mid, x0 + 1, y0, squashW - 2, squashH, '#10b981');
      setPx(fg, x0 + 3, y0 + 4, '#0f172a');
      setPx(fg, x0 + 3, y0 + 5, '#0f172a');
      setPx(fg, x0 + squashW - 4, y0 + 4, '#0f172a');
      setPx(fg, x0 + squashW - 4, y0 + 5, '#0f172a');
      const cx = Math.floor(size / 2) - 3;
      const cy = y0 - 3;
      fillRect(fg, cx, cy + 1, 7, 2, '#fbbf24');
      setPx(fg, cx, cy, '#fbbf24');
      setPx(fg, cx + 3, cy, '#f43f5e');
      setPx(fg, cx + 6, cy, '#fbbf24');
    } else if (type === 'cat') {
      fillRect(bg, 0, 0, size, size, '#14161a');
      const bob = f % 2;
      fillRect(mid, 8, 7 + bob, 4, 5, '#64748b');
      fillRect(mid, 20, 7 + bob, 4, 5, '#64748b');
      fillRect(mid, 9, 8 + bob, 2, 3, '#f43f5e');
      fillRect(mid, 21, 8 + bob, 2, 3, '#f43f5e');
      fillRect(mid, 8, 11 + bob, 16, 11, '#cbd5e1');
      fillRect(mid, 10, 22, 12, 6, '#94a3b8');
      const beamColor = f % 2 === 0 ? '#38bdf8' : '#f43f5e';
      fillRect(fg, 10, 14 + bob, 4, 2, beamColor);
      fillRect(fg, 18, 14 + bob, 4, 2, beamColor);
      fillRect(fg, 5, 17 + bob, 3, 1, '#f8fafc');
      fillRect(fg, 24, 17 + bob, 3, 1, '#f8fafc');
    } else if (type === 'sunset') {
      for (let y = 0; y < size; y++) {
        const c = y < 7 ? '#141026' : y < 13 ? '#2b1b47' : y < 18 ? '#8c3160' : y < 22 ? '#eb6f5b' : '#1e293b';
        fillRect(bg, 0, y, size, 1, c);
      }
      const sunY = 13 + (f % 2 === 0 ? 0 : 1);
      fillCircle(bg, 16, sunY, 5, '#fed981');
      for (let x = 0; x < size; x++) {
        const peak1 = 15 + Math.abs(((x + 4) % 16) - 8);
        for (let y = peak1; y < 22; y++) setPx(mid, x, y, '#244557');
      }
      for (let y = 22; y < size; y++) {
        const waveWidth = 4 + Math.floor((y - 22) * 0.7);
        const offset = ((y + f) % 3) - 1;
        fillRect(fg, 16 - Math.floor(waveWidth / 2) + offset, y, waveWidth, 1, y % 2 === 0 ? '#fed981' : '#eb6f5b');
      }
    } else if (type === 'sword') {
      fillRect(bg, 0, 0, size, size, '#14161a');
      fillCircle(bg, 16, 16, 11, '#1e293b');
      for (let i = 0; i < 16; i++) {
        const x = 9 + i;
        const y = 22 - i;
        setPx(mid, x, y, '#38bdf8');
        setPx(mid, x - 1, y, '#ffffff');
        setPx(mid, x, y + 1, '#6366f1');
      }
      fillRect(fg, 6, 20, 7, 2, '#fbbf24');
      fillRect(fg, 6, 23, 3, 3, '#f43f5e');
    } else {
      setPx(mid, Math.floor(size / 2), Math.floor(size / 2), '#6366f1');
    }

    frames.push({
      id: `frame-${f + 1}`,
      cels: {
        'layer-bg': bg,
        'layer-mid': mid,
        'layer-fg': fg
      }
    });
  }

  return { layers, frames, size };
}

// Composite a specific frame into a flat color array
function compositeFrame(project, frameIndex) {
  const { size, layers, frames } = project;
  const frame = frames[frameIndex] || frames[0];
  const out = new Array(size * size).fill(null);
  if (!frame) return out;

  layers.forEach((layer) => {
    if (!layer.visible) return;
    const cel = frame.cels[layer.id];
    if (!cel) return;
    for (let i = 0; i < cel.length; i++) {
      if (cel[i]) {
        out[i] = cel[i];
      }
    }
  });
  return out;
}

// Render a flat pixel array onto a <canvas>
function renderPixelArrayToCanvas(canvas, pixels, size, options = {}) {
  if (!canvas) return;
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');
  ctx.clearRect(0, 0, size, size);

  if (options.onionPrev) {
    ctx.globalAlpha = 0.25;
    for (let i = 0; i < options.onionPrev.length; i++) {
      if (options.onionPrev[i]) {
        const x = i % size;
        const y = Math.floor(i / size);
        ctx.fillStyle = '#f43f5e';
        ctx.fillRect(x, y, 1, 1);
      }
    }
  }

  if (options.onionNext) {
    ctx.globalAlpha = 0.22;
    for (let i = 0; i < options.onionNext.length; i++) {
      if (options.onionNext[i]) {
        const x = i % size;
        const y = Math.floor(i / size);
        ctx.fillStyle = '#38bdf8';
        ctx.fillRect(x, y, 1, 1);
      }
    }
  }

  ctx.globalAlpha = 1;
  for (let i = 0; i < pixels.length; i++) {
    const color = pixels[i];
    if (color) {
      const x = i % size;
      const y = Math.floor(i / size);
      ctx.fillStyle = color;
      ctx.fillRect(x, y, 1, 1);
    }
  }

  if (options.previewPixels) {
    ctx.globalAlpha = 0.85;
    options.previewPixels.forEach(({ x, y, color }) => {
      if (x >= 0 && x < size && y >= 0 && y < size) {
        ctx.fillStyle = color;
        ctx.fillRect(x, y, 1, 1);
      }
    });
    ctx.globalAlpha = 1;
  }

  if (options.hoverCoord) {
    const { x, y } = options.hoverCoord;
    ctx.fillStyle = 'rgba(255, 255, 255, 0.35)';
    ctx.fillRect(x, y, 1, 1);
  }
}

// Initialize Community Gallery Posts
function initCommunityPosts() {
  const duckProj = generateTemplateProject('duck', 32);
  const goblinProj = generateTemplateProject('goblin', 32);
  const slimeProj = generateTemplateProject('slime', 32);
  const catProj = generateTemplateProject('cat', 32);
  const sunsetProj = generateTemplateProject('sunset', 32);
  const swordProj = generateTemplateProject('sword', 32);

  appData.posts = [
    {
      id: 'post-1',
      title: 'Disco Duck',
      creator: 'DiscoDuck',
      handle: '@discoduck',
      avatar: 'DD',
      category: 'Characters',
      isAnimated: true,
      following: true,
      fps: 10,
      likes: 942,
      liked: false,
      bookmarked: true,
      template: 'duck',
      project: duckProj,
      palette: ['#181b22', '#fbbf24', '#f97316', '#f43f5e', '#38bdf8', '#10b981'],
      tags: ['duck', 'disco', 'character', 'animated'],
      description: '6-frame dancing duck sprite with pixel sunglasses and a disco tile floor.',
      comments: [
        { author: '@hexmage', text: 'Super clean 6-frame bounce cycle!' },
        { author: '@slimecraft', text: 'Love the color contrast on the dancefloor tiles.' }
      ]
    },
    {
      id: 'post-2',
      title: 'Night Code Mage',
      creator: 'HexMage',
      handle: '@hexmage',
      avatar: 'HM',
      category: 'Characters',
      isAnimated: true,
      following: true,
      fps: 8,
      likes: 764,
      liked: true,
      bookmarked: false,
      template: 'goblin',
      project: goblinProj,
      palette: ['#14161a', '#6366f1', '#10b981', '#f43f5e', '#fbbf24', '#ffffff'],
      tags: ['wizard', 'mage', 'character', 'coffee'],
      description: 'Late-night pixel wizard fueled by coffee and arcane sparks.',
      comments: [
        { author: '@calpixel', text: 'The steam animation on the mug is a great detail.' }
      ]
    },
    {
      id: 'post-3',
      title: 'King Slime Bounce',
      creator: 'SlimeCraft',
      handle: '@slimecraft',
      avatar: 'SC',
      category: 'Game Assets',
      isAnimated: true,
      following: false,
      fps: 12,
      likes: 830,
      liked: false,
      bookmarked: true,
      template: 'slime',
      project: slimeProj,
      palette: ['#1e293b', '#059669', '#10b981', '#fbbf24', '#f43f5e'],
      tags: ['slime', 'rpg', 'bounce', 'sprite'],
      description: 'Squash-and-stretch RPG slime boss idle loop ready for game engines.',
      comments: []
    },
    {
      id: 'post-4',
      title: 'Cyber Cat Unit',
      creator: 'NekoByte',
      handle: '@nekobyte',
      avatar: 'NB',
      category: 'Cyberpunk',
      isAnimated: true,
      following: true,
      fps: 10,
      likes: 695,
      liked: false,
      bookmarked: false,
      template: 'cat',
      project: catProj,
      palette: ['#14161a', '#cbd5e1', '#f43f5e', '#38bdf8', '#ffffff'],
      tags: ['cat', 'cyberpunk', 'visor', 'mecha'],
      description: '32×32 cybernetic cat portrait with alternating neon visor glow.',
      comments: []
    },
    {
      id: 'post-5',
      title: 'Crystal Aether Blade',
      creator: 'LootGoblin',
      handle: '@lootgoblin',
      avatar: 'LG',
      category: 'Game Assets',
      isAnimated: false,
      following: false,
      fps: 1,
      likes: 518,
      liked: false,
      bookmarked: false,
      template: 'sword',
      project: swordProj,
      palette: ['#14161a', '#1e293b', '#38bdf8', '#6366f1', '#fbbf24'],
      tags: ['sword', 'weapon', 'icon', 'rpg'],
      description: 'Crisp 32×32 inventory weapon icon.',
      comments: []
    },
    {
      id: 'post-6',
      title: 'Sunset Shrine River',
      creator: 'VinylQuest',
      handle: '@vinylquest',
      avatar: 'VQ',
      category: 'Scenery',
      isAnimated: true,
      following: true,
      fps: 6,
      likes: 890,
      liked: false,
      bookmarked: false,
      template: 'sunset',
      project: sunsetProj,
      palette: ['#141026', '#8c3160', '#eb6f5b', '#fed981', '#244557'],
      tags: ['sunset', 'scenery', 'lofi', 'water'],
      description: 'Warm sunset reflection study animated across 4 frames.',
      comments: []
    }
  ];
}

// Subtle Toast Helper
function showToast(message) {
  const container = document.getElementById('toastContainer');
  if (!container) return;
  const toast = document.createElement('div');
  toast.className = 'toast';
  toast.textContent = message;
  container.appendChild(toast);
  setTimeout(() => {
    toast.remove();
  }, 2600);
}

// Load a template into the active Studio state
function loadStudioTemplate(templateName, customSize = null) {
  const size = customSize || studioState.size;
  const generated = generateTemplateProject(templateName, size);
  studioState.size = generated.size;
  studioState.layers = generated.layers;
  studioState.frames = generated.frames;
  studioState.activeLayerIndex = generated.layers.length - 1;
  studioState.activeFrameIndex = 0;
  studioState.undoStack = [];
  studioState.redoStack = [];

  const titleMap = {
    duck: 'Disco Duck',
    goblin: 'Night Mage',
    slime: 'King Slime',
    cat: 'Cyber Cat',
    sunset: 'Sunset River',
    sword: 'Crystal Sword',
    blank: 'Untitled Sprite'
  };
  const titleInput = document.getElementById('studioProjectTitle');
  if (titleInput && titleMap[templateName]) {
    titleInput.value = titleMap[templateName];
  }

  syncStudioUI();
}

// Save snapshot for Undo/Redo
function pushUndoSnapshot() {
  const snapshot = JSON.stringify({
    layers: studioState.layers,
    frames: studioState.frames,
    activeLayerIndex: studioState.activeLayerIndex,
    activeFrameIndex: studioState.activeFrameIndex
  });
  studioState.undoStack.push(snapshot);
  if (studioState.undoStack.length > 50) {
    studioState.undoStack.shift();
  }
  studioState.redoStack = [];
}

function performUndo() {
  if (studioState.undoStack.length === 0) {
    showToast('Nothing to undo');
    return;
  }
  playSfx('blip');
  const current = JSON.stringify({
    layers: studioState.layers,
    frames: studioState.frames,
    activeLayerIndex: studioState.activeLayerIndex,
    activeFrameIndex: studioState.activeFrameIndex
  });
  studioState.redoStack.push(current);
  const prev = JSON.parse(studioState.undoStack.pop());
  studioState.layers = prev.layers;
  studioState.frames = prev.frames;
  studioState.activeLayerIndex = prev.activeLayerIndex;
  studioState.activeFrameIndex = prev.activeFrameIndex;
  syncStudioUI();
}

function performRedo() {
  if (studioState.redoStack.length === 0) {
    showToast('Nothing to redo');
    return;
  }
  playSfx('blip');
  const current = JSON.stringify({
    layers: studioState.layers,
    frames: studioState.frames,
    activeLayerIndex: studioState.activeLayerIndex,
    activeFrameIndex: studioState.activeFrameIndex
  });
  studioState.undoStack.push(current);
  const next = JSON.parse(studioState.redoStack.pop());
  studioState.layers = next.layers;
  studioState.frames = next.frames;
  studioState.activeLayerIndex = next.activeLayerIndex;
  studioState.activeFrameIndex = next.activeFrameIndex;
  syncStudioUI();
}

// Stamp a cute mini pixel duck onto Active Layer
function stampPartySprite() {
  pushUndoSnapshot();
  playSfx('coin');
  const activeLayer = studioState.layers[studioState.activeLayerIndex];
  const cel = studioState.frames[studioState.activeFrameIndex].cels[activeLayer.id];
  const size = studioState.size;
  const ox = Math.floor(Math.random() * (size - 10)) + 2;
  const oy = Math.floor(Math.random() * (size - 10)) + 2;

  const miniDuck = [
    [0, 0, '#fbbf24', '#fbbf24', '#fbbf24', 0, 0],
    [0, '#fbbf24', '#fbbf24', '#0f172a', '#fbbf24', '#f97316', '#f97316'],
    [0, 0, '#fbbf24', '#fbbf24', '#fbbf24', 0, 0],
    ['#fbbf24', '#fbbf24', '#fbbf24', '#f59e0b', '#fbbf24', '#fbbf24', 0],
    [0, '#fbbf24', '#fbbf24', '#fbbf24', '#fbbf24', 0, 0],
    [0, 0, '#f97316', 0, '#f97316', 0, 0]
  ];

  for (let r = 0; r < miniDuck.length; r++) {
    for (let c = 0; c < miniDuck[r].length; c++) {
      const hex = miniDuck[r][c];
      if (hex && ox + c < size && oy + r < size) {
        cel[(oy + r) * size + (ox + c)] = hex;
      }
    }
  }
  syncStudioUI();
  showToast('Stamped mini sprite on active layer');
}

// Pixel Geometry Algorithms
function getBrushPoints(cx, cy, brushSize, mirror = false, gridSize = 32) {
  const pts = [];
  const half = Math.floor(brushSize / 2);
  for (let dy = -half; dy < brushSize - half; dy++) {
    for (let dx = -half; dx < brushSize - half; dx++) {
      const px = cx + dx;
      const py = cy + dy;
      pts.push({ x: px, y: py });
      if (mirror) {
        pts.push({ x: gridSize - 1 - px, y: py });
      }
    }
  }
  return pts;
}

function getBresenhamLinePoints(x0, y0, x1, y1) {
  const pts = [];
  let dx = Math.abs(x1 - x0);
  let dy = -Math.abs(y1 - y0);
  const sx = x0 < x1 ? 1 : -1;
  const sy = y0 < y1 ? 1 : -1;
  let err = dx + dy;

  while (true) {
    pts.push({ x: x0, y: y0 });
    if (x0 === x1 && y0 === y1) break;
    const e2 = 2 * err;
    if (e2 >= dy) {
      err += dy;
      x0 += sx;
    }
    if (e2 <= dx) {
      err += dx;
      y0 += sy;
    }
  }
  return pts;
}

function getRectPoints(x0, y0, x1, y1, filled = false) {
  const pts = [];
  const minX = Math.min(x0, x1);
  const maxX = Math.max(x0, x1);
  const minY = Math.min(y0, y1);
  const maxY = Math.max(y0, y1);
  for (let y = minY; y <= maxY; y++) {
    for (let x = minX; x <= maxX; x++) {
      if (filled || y === minY || y === maxY || x === minX || x === maxX) {
        pts.push({ x, y });
      }
    }
  }
  return pts;
}

function getCirclePoints(x0, y0, x1, y1, filled = false) {
  const pts = [];
  const rx = Math.floor(Math.abs(x1 - x0) / 2);
  const ry = Math.floor(Math.abs(y1 - y0) / 2);
  const cx = Math.floor((x0 + x1) / 2);
  const cy = Math.floor((y0 + y1) / 2);
  const r = Math.max(rx, ry);
  if (r === 0) return [{ x: cx, y: cy }];

  for (let y = cy - r; y <= cy + r; y++) {
    for (let x = cx - r; x <= cx + r; x++) {
      const distSq = (x - cx) * (x - cx) + (y - cy) * (y - cy);
      if (filled) {
        if (distSq <= r * r) pts.push({ x, y });
      } else {
        if (Math.abs(Math.sqrt(distSq) - r) < 0.75) pts.push({ x, y });
      }
    }
  }
  return pts;
}

function floodFillCel(cel, size, startX, startY, fillColor, globalReplace = false) {
  const startIdx = startY * size + startX;
  const targetColor = cel[startIdx];
  if (targetColor === fillColor) return;

  if (globalReplace) {
    for (let i = 0; i < cel.length; i++) {
      if (cel[i] === targetColor) cel[i] = fillColor;
    }
    return;
  }

  const visited = new Uint8Array(size * size);
  const queue = [{ x: startX, y: startY }];
  visited[startIdx] = 1;

  while (queue.length > 0) {
    const { x, y } = queue.shift();
    const idx = y * size + x;
    cel[idx] = fillColor;

    const neighbors = [
      { x: x + 1, y },
      { x: x - 1, y },
      { x, y: y + 1 },
      { x, y: y - 1 }
    ];
    for (const n of neighbors) {
      if (n.x >= 0 && n.x < size && n.y >= 0 && n.y < size) {
        const nIdx = n.y * size + n.x;
        if (!visited[nIdx] && cel[nIdx] === targetColor) {
          visited[nIdx] = 1;
          queue.push(n);
        }
      }
    }
  }
}

// Render Main Editor Canvas
function renderEditorCanvas() {
  const editorCanvas = document.getElementById('editorCanvas');
  if (!editorCanvas) return;

  const { size, frames, activeFrameIndex, onionSkin } = studioState;
  const composite = compositeFrame(studioState, activeFrameIndex);

  let onionPrev = null;
  let onionNext = null;
  if (onionSkin && frames.length > 1) {
    const prevIdx = (activeFrameIndex - 1 + frames.length) % frames.length;
    const nextIdx = (activeFrameIndex + 1) % frames.length;
    onionPrev = compositeFrame(studioState, prevIdx);
    onionNext = compositeFrame(studioState, nextIdx);
  }

  renderPixelArrayToCanvas(editorCanvas, composite, size, {
    onionPrev,
    onionNext,
    previewPixels: studioState.previewPixels,
    hoverCoord: studioState.hoverCoord
  });

  const stageBox = document.getElementById('canvasStageBox');
  if (stageBox) {
    const basePx = Math.round(448 * (studioState.zoom / 100));
    stageBox.style.width = `${basePx}px`;
    stageBox.style.height = `${basePx}px`;
  }
}

// Sync All Studio UI Controls
function syncStudioUI() {
  const activeLayer = studioState.layers[studioState.activeLayerIndex] || studioState.layers[0];
  document.getElementById('canvasDimReadout').textContent = `${studioState.size} × ${studioState.size} px`;
  document.getElementById('activeLayerReadout').textContent = `Layer: ${activeLayer ? activeLayer.name : 'None'}`;
  document.getElementById('activeFrameReadout').textContent = `Frame ${studioState.activeFrameIndex + 1} / ${studioState.frames.length}`;
  document.getElementById('frameCountBadge').textContent = `${studioState.frames.length} Frames`;
  document.getElementById('previewFpsBadge').textContent = `${studioState.fps} FPS`;
  document.getElementById('fpsReadout').textContent = `${studioState.fps} FPS`;

  // Palette swatches
  const paletteContainer = document.getElementById('paletteContainer');
  if (paletteContainer) {
    paletteContainer.innerHTML = '';
    studioState.palette.forEach((hex) => {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = `swatch ${hex.toLowerCase() === studioState.activeColor.toLowerCase() ? 'active' : ''}`;
      btn.style.setProperty('--swatch', hex);
      btn.title = hex.toUpperCase();
      btn.setAttribute('aria-label', `Select color ${hex}`);
      btn.addEventListener('click', () => {
        playSfx('blip');
        studioState.activeColor = hex;
        document.getElementById('customColorPicker').value = hex;
        document.getElementById('activeColorHex').textContent = hex.toUpperCase();
        syncStudioUI();
      });
      paletteContainer.appendChild(btn);
    });
  }

  // Layers list
  const layerList = document.getElementById('layerListContainer');
  if (layerList) {
    layerList.innerHTML = '';
    for (let i = studioState.layers.length - 1; i >= 0; i--) {
      const layer = studioState.layers[i];
      const li = document.createElement('li');
      li.className = `layer-item ${i === studioState.activeLayerIndex ? 'active' : ''}`;
      li.innerHTML = `
        <div class="layer-item-left">
          <button type="button" class="layer-vis-btn" data-vis="${i}" title="Toggle visibility" aria-label="Toggle visibility for ${layer.name}">
            ${
              layer.visible
                ? '<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>'
                : '<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" opacity="0.45"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94"/><line x1="1" y1="1" x2="23" y2="23"/></svg>'
            }
          </button>
          <span>${layer.name}</span>
        </div>
        <div>
          <button type="button" class="layer-del-btn" data-del="${i}" title="Delete layer" aria-label="Delete ${layer.name}">
            <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
          </button>
        </div>
      `;
      li.addEventListener('click', (e) => {
        if (e.target.closest('[data-vis]') || e.target.closest('[data-del]')) return;
        playSfx('blip');
        studioState.activeLayerIndex = i;
        syncStudioUI();
      });
      layerList.appendChild(li);
    }

    layerList.querySelectorAll('[data-vis]').forEach((btn) => {
      btn.addEventListener('click', () => {
        playSfx('blip');
        const idx = Number(btn.dataset.vis);
        studioState.layers[idx].visible = !studioState.layers[idx].visible;
        syncStudioUI();
      });
    });

    layerList.querySelectorAll('[data-del]').forEach((btn) => {
      btn.addEventListener('click', () => {
        if (studioState.layers.length <= 1) {
          showToast('Minimum 1 layer required');
          return;
        }
        pushUndoSnapshot();
        const idx = Number(btn.dataset.del);
        const removed = studioState.layers.splice(idx, 1)[0];
        studioState.frames.forEach((f) => delete f.cels[removed.id]);
        studioState.activeLayerIndex = Math.max(0, studioState.activeLayerIndex - 1);
        syncStudioUI();
      });
    });
  }

  // Timeline Frames strip
  const framesContainer = document.getElementById('timelineFramesContainer');
  if (framesContainer) {
    framesContainer.innerHTML = '';
    studioState.frames.forEach((frame, idx) => {
      const card = document.createElement('button');
      card.type = 'button';
      card.className = `frame-card ${idx === studioState.activeFrameIndex ? 'active' : ''}`;
      const thumbCanvas = document.createElement('canvas');
      const pixels = compositeFrame(studioState, idx);
      renderPixelArrayToCanvas(thumbCanvas, pixels, studioState.size);
      const label = document.createElement('span');
      label.textContent = `${idx + 1}`;
      card.appendChild(thumbCanvas);
      card.appendChild(label);
      card.addEventListener('click', () => {
        playSfx('blip');
        studioState.activeFrameIndex = idx;
        syncStudioUI();
      });
      framesContainer.appendChild(card);
    });
  }

  renderEditorCanvas();
}

// Setup Interactive Canvas Pointer Events
function bindStudioCanvasEvents() {
  const canvas = document.getElementById('editorCanvas');
  if (!canvas) return;

  const getCoordFromEvent = (e) => {
    const rect = canvas.getBoundingClientRect();
    const x = Math.floor(((e.clientX - rect.left) / rect.width) * studioState.size);
    const y = Math.floor(((e.clientY - rect.top) / rect.height) * studioState.size);
    return {
      x: Math.max(0, Math.min(studioState.size - 1, x)),
      y: Math.max(0, Math.min(studioState.size - 1, y))
    };
  };

  const applyImmediateTool = (x, y) => {
    const activeLayer = studioState.layers[studioState.activeLayerIndex];
    if (!activeLayer || !activeLayer.visible) return;
    const frame = studioState.frames[studioState.activeFrameIndex];
    const cel = frame.cels[activeLayer.id];

    if (studioState.tool === 'pencil' || studioState.tool === 'mirror') {
      const pts = getBrushPoints(x, y, studioState.brushSize, studioState.tool === 'mirror', studioState.size);
      pts.forEach((p) => {
        if (p.x >= 0 && p.x < studioState.size && p.y >= 0 && p.y < studioState.size) {
          cel[p.y * studioState.size + p.x] = studioState.activeColor;
        }
      });
    } else if (studioState.tool === 'eraser') {
      const pts = getBrushPoints(x, y, studioState.brushSize, false, studioState.size);
      pts.forEach((p) => {
        if (p.x >= 0 && p.x < studioState.size && p.y >= 0 && p.y < studioState.size) {
          cel[p.y * studioState.size + p.x] = null;
        }
      });
    } else if (studioState.tool === 'fill') {
      floodFillCel(cel, studioState.size, x, y, studioState.activeColor, studioState.fillShapes);
    } else if (studioState.tool === 'eyedropper') {
      const composite = compositeFrame(studioState, studioState.activeFrameIndex);
      const sampled = composite[y * studioState.size + x];
      if (sampled) {
        studioState.activeColor = sampled;
        document.getElementById('customColorPicker').value = sampled;
        document.getElementById('activeColorHex').textContent = sampled.toUpperCase();
        showToast(`Picked ${sampled.toUpperCase()}`);
      }
    }
  };

  canvas.addEventListener('pointerdown', (e) => {
    e.preventDefault();
    const coord = getCoordFromEvent(e);
    pushUndoSnapshot();
    studioState.isDragging = true;
    studioState.dragStart = coord;
    playSfx('blip');

    if (['pencil', 'eraser', 'fill', 'eyedropper', 'mirror'].includes(studioState.tool)) {
      applyImmediateTool(coord.x, coord.y);
      syncStudioUI();
    }
  });

  canvas.addEventListener('pointermove', (e) => {
    const coord = getCoordFromEvent(e);
    studioState.hoverCoord = coord;
    document.getElementById('cursorCoordReadout').textContent = `X: ${coord.x}, Y: ${coord.y}`;

    if (!studioState.isDragging) {
      renderEditorCanvas();
      return;
    }

    if (['pencil', 'eraser', 'mirror'].includes(studioState.tool)) {
      applyImmediateTool(coord.x, coord.y);
      renderEditorCanvas();
    } else if (['line', 'rect', 'circle'].includes(studioState.tool) && studioState.dragStart) {
      let shapePts = [];
      if (studioState.tool === 'line') {
        shapePts = getBresenhamLinePoints(studioState.dragStart.x, studioState.dragStart.y, coord.x, coord.y);
      } else if (studioState.tool === 'rect') {
        shapePts = getRectPoints(studioState.dragStart.x, studioState.dragStart.y, coord.x, coord.y, studioState.fillShapes);
      } else if (studioState.tool === 'circle') {
        shapePts = getCirclePoints(studioState.dragStart.x, studioState.dragStart.y, coord.x, coord.y, studioState.fillShapes);
      }
      studioState.previewPixels = shapePts.map((p) => ({ x: p.x, y: p.y, color: studioState.activeColor }));
      renderEditorCanvas();
    }
  });

  window.addEventListener('pointerup', () => {
    if (!studioState.isDragging) return;
    if (studioState.previewPixels && studioState.previewPixels.length > 0) {
      const activeLayer = studioState.layers[studioState.activeLayerIndex];
      const frame = studioState.frames[studioState.activeFrameIndex];
      const cel = frame.cels[activeLayer.id];
      studioState.previewPixels.forEach(({ x, y, color }) => {
        if (x >= 0 && x < studioState.size && y >= 0 && y < studioState.size) {
          cel[y * studioState.size + x] = color;
        }
      });
      studioState.previewPixels = null;
    }
    studioState.isDragging = false;
    studioState.dragStart = null;
    syncStudioUI();
  });

  canvas.addEventListener('pointerleave', () => {
    studioState.hoverCoord = null;
    document.getElementById('cursorCoordReadout').textContent = 'X: --, Y: --';
    renderEditorCanvas();
  });
}

// Render Community Explore Gallery Cards
function renderGalleryGrid() {
  const grid = document.getElementById('galleryGrid');
  if (!grid) return;

  const filtered = appData.posts
    .filter((post) => {
      if (appData.filterCategory !== 'all' && post.category.toLowerCase() !== appData.filterCategory.toLowerCase()) {
        return false;
      }
      if (appData.filterFormat === 'animated' && !post.isAnimated) return false;
      if (appData.filterFormat === 'static' && post.isAnimated) return false;
      if (appData.filterSort === 'following' && !post.following) return false;
      if (appData.searchQuery.trim() !== '') {
        const q = appData.searchQuery.toLowerCase().replace('#', '');
        const matchTitle = post.title.toLowerCase().includes(q);
        const matchCreator = post.creator.toLowerCase().includes(q);
        const matchTags = post.tags.some((t) => t.toLowerCase().includes(q));
        if (!matchTitle && !matchCreator && !matchTags) return false;
      }
      return true;
    })
    .sort((a, b) => (appData.filterSort === 'trending' ? b.likes - a.likes : 0));

  grid.innerHTML = '';

  const tileStyles = [
    '', // #131313 + 1px solid #ffffff hairline
    'stream-tile-mint',
    'stream-tile-ultraviolet',
    '',
    'stream-tile-yellow',
    'stream-tile-white'
  ];
  const streamTimes = ['16:20 UTC', '15:42 UTC', '14:18 UTC', '13:05 UTC', '11:50 UTC', '09:30 UTC'];

  filtered.forEach((post, idx) => {
    const article = document.createElement('article');
    const tileVariant = tileStyles[idx % tileStyles.length];
    article.className = `art-card ${tileVariant}`.trim();
    const timestamp = streamTimes[idx % streamTimes.length];
    article.innerHTML = `
      <div class="stream-card-rail-head">
        <span class="mono-timestamp">COMMIT // ${timestamp}</span>
        <span class="mono-timestamp">${post.category.toUpperCase()}</span>
      </div>
      <div class="art-thumb-wrap" data-inspect="${post.id}">
        <div class="card-badges-top">
          <span class="format-pill">${post.isAnimated ? `GIF · ${post.project.frames.length}F` : 'PNG'}</span>
          <span class="format-pill">${post.fps} FPS</span>
        </div>
        <canvas class="gallery-card-canvas" data-post-id="${post.id}" width="32" height="32"></canvas>
      </div>
      <div class="card-meta">
        <div data-inspect="${post.id}">
          <h3>${post.title}</h3>
          <p>${post.handle} · ${post.tags.map((t) => `#${t}`).slice(0, 2).join(' ')}</p>
        </div>
        <div class="card-actions-inline">
          <button type="button" class="like-pill-btn ${post.liked ? 'liked' : ''}" data-like="${post.id}" aria-label="Like ${post.title}">
            <svg viewBox="0 0 24 24" width="13" height="13" fill="${post.liked ? 'currentColor' : 'none'}" stroke="currentColor" stroke-width="2"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/></svg>
            <span>${post.likes}</span>
          </button>
        </div>
      </div>
    `;
    grid.appendChild(article);
  });

  grid.querySelectorAll('.gallery-card-canvas').forEach((c) => {
    const post = appData.posts.find((p) => p.id === c.dataset.postId);
    if (post) {
      renderPixelArrayToCanvas(c, compositeFrame(post.project, 0), post.project.size);
    }
  });

  grid.querySelectorAll('[data-inspect]').forEach((el) => {
    el.addEventListener('click', () => openArtworkDetailModal(el.dataset.inspect));
  });

  grid.querySelectorAll('[data-like]').forEach((btn) => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const post = appData.posts.find((p) => p.id === btn.dataset.like);
      if (!post) return;
      playSfx('coin');
      post.liked = !post.liked;
      post.likes += post.liked ? 1 : -1;
      renderGalleryGrid();
    });
  });
}

// Open Artwork Detail Modal
function openArtworkDetailModal(postId) {
  const post = appData.posts.find((p) => p.id === postId);
  if (!post) return;
  appData.activeDetailPostId = postId;
  appData.detailPlaying = true;

  document.getElementById('detailCategoryBadge').textContent = post.category;
  document.getElementById('detailTitle').textContent = post.title;
  document.getElementById('detailCreatorAvatar').textContent = post.avatar;
  document.getElementById('detailCreatorName').textContent = post.creator;
  document.getElementById('detailCreatorHandle').textContent = post.handle;
  document.getElementById('detailDescription').textContent = post.description;
  document.getElementById('detailSpecsReadout').textContent = `${post.project.size}×${post.project.size} px · ${post.project.frames.length} Frames · ${post.fps} FPS`;
  document.getElementById('detailLikeCount').textContent = post.likes;
  document.getElementById('detailBookmarkText').textContent = post.bookmarked ? 'Bookmarked ✓' : 'Bookmark';
  document.getElementById('detailFollowBtn').textContent = post.following ? 'Following ✓' : 'Follow';

  const tagsRow = document.getElementById('detailTagsRow');
  tagsRow.innerHTML = post.tags.map((t) => `<span class="px-badge">#${t}</span>`).join('');

  const swatchesRow = document.getElementById('detailPaletteSwatches');
  swatchesRow.innerHTML = post.palette
    .map((hex) => `<span class="mini-swatch-chip" style="background:${hex}" title="${hex}"></span>`)
    .join('');

  renderDetailComments(post);

  const showcaseCanvas = document.getElementById('detailShowcaseCanvas');
  renderPixelArrayToCanvas(showcaseCanvas, compositeFrame(post.project, 0), post.project.size);

  document.getElementById('artDetailModal').classList.remove('hidden');
}

function renderDetailComments(post) {
  document.getElementById('detailCommentCount').textContent = post.comments.length;
  const list = document.getElementById('detailCommentsList');
  list.innerHTML = post.comments
    .map((c) => `<div class="comment-item"><strong>${c.author}</strong><span>${c.text}</span></div>`)
    .join('');
}

// Non-Destructive Image-to-Pixel Art Converter Engine
const converterState = {
  sampleName: 'cyberCity',
  uploadedImage: null,
  resolution: 32,
  colorCount: 12,
  ditherMode: 'bayer',
  outputPixels: [],
  extractedPalette: []
};

function drawProceduralReferenceToSourceCanvas(sampleName) {
  const srcCanvas = document.getElementById('converterSourceCanvas');
  if (!srcCanvas) return;
  const ctx = srcCanvas.getContext('2d');
  const w = srcCanvas.width;
  const h = srcCanvas.height;
  ctx.clearRect(0, 0, w, h);

  if (sampleName === 'cyberCity') {
    ctx.fillStyle = '#131313';
    ctx.fillRect(0, 0, w, h * 0.45);
    ctx.fillStyle = '#5200ff';
    ctx.fillRect(0, h * 0.45, w, h * 0.55);
    ctx.fillStyle = '#ffe600';
    ctx.beginPath();
    ctx.arc(w / 2, h * 0.48, 28, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#131313';
    [12, 34, 58, 82, 104].forEach((bx, idx) => {
      const bh = 42 + (idx % 3) * 18;
      ctx.fillRect(bx, h - bh, 18, bh);
    });
    ctx.fillStyle = '#3cffd0';
    for (let y = h - 50; y < h - 8; y += 8) {
      for (let x = 16; x < w - 16; x += 12) {
        ctx.fillRect(x, y, 4, 4);
      }
    }
  } else if (sampleName === 'sunsetMountain') {
    ctx.fillStyle = '#5200ff';
    ctx.fillRect(0, 0, w, h * 0.5);
    ctx.fillStyle = '#ff2a85';
    ctx.fillRect(0, h * 0.5, w, h * 0.5);
    ctx.fillStyle = '#131313';
    ctx.beginPath();
    ctx.moveTo(0, h);
    ctx.lineTo(w * 0.5, h * 0.35);
    ctx.lineTo(w, h);
    ctx.fill();
    ctx.fillStyle = '#3cffd0';
    ctx.beginPath();
    ctx.moveTo(w * 0.36, h * 0.53);
    ctx.lineTo(w * 0.5, h * 0.35);
    ctx.lineTo(w * 0.64, h * 0.53);
    ctx.fill();
  } else if (sampleName === 'mechaPortrait') {
    ctx.fillStyle = '#0f172a';
    ctx.fillRect(0, 0, w, h);
    ctx.fillStyle = '#6366f1';
    ctx.fillRect(28, 20, 72, 88);
    ctx.fillStyle = '#38bdf8';
    ctx.fillRect(38, 44, 52, 18);
    ctx.fillStyle = '#f43f5e';
    ctx.fillRect(54, 12, 20, 22);
  } else {
    ctx.fillStyle = '#064e3b';
    ctx.fillRect(0, 0, w, h);
    ctx.fillStyle = '#10b981';
    ctx.beginPath();
    ctx.moveTo(w / 2, 16);
    ctx.lineTo(w - 24, h / 2);
    ctx.lineTo(w / 2, h - 16);
    ctx.lineTo(24, h / 2);
    ctx.closePath();
    ctx.fill();
  }
}

function runImageToPixelConversion() {
  const srcCanvas = document.getElementById('converterSourceCanvas');
  const outCanvas = document.getElementById('converterResultCanvas');
  if (!srcCanvas || !outCanvas) return;

  if (!converterState.uploadedImage) {
    drawProceduralReferenceToSourceCanvas(converterState.sampleName);
  }

  const res = converterState.resolution;
  const colorCount = converterState.colorCount;
  const dither = converterState.ditherMode;

  const temp = document.createElement('canvas');
  temp.width = res;
  temp.height = res;
  const tCtx = temp.getContext('2d');
  tCtx.drawImage(srcCanvas, 0, 0, res, res);
  const imgData = tCtx.getImageData(0, 0, res, res).data;

  const bayer4 = [
    [0, 8, 2, 10],
    [12, 4, 14, 6],
    [3, 11, 1, 9],
    [15, 7, 13, 5]
  ];

  const levels = Math.max(2, Math.round(Math.cbrt(colorCount)));
  const step = Math.floor(255 / (levels - 1));
  const pixels = new Array(res * res);
  const colorSet = new Set();

  for (let y = 0; y < res; y++) {
    for (let x = 0; x < res; x++) {
      const idx = (y * res + x) * 4;
      let r = imgData[idx];
      let g = imgData[idx + 1];
      let b = imgData[idx + 2];

      if (dither === 'bayer') {
        const threshold = (bayer4[y % 4][x % 4] / 16 - 0.5) * 38;
        r = Math.max(0, Math.min(255, r + threshold));
        g = Math.max(0, Math.min(255, g + threshold));
        b = Math.max(0, Math.min(255, b + threshold));
      } else if (dither === 'floyd') {
        const jitter = ((x * 7 + y * 13) % 11 - 5) * 4;
        r = Math.max(0, Math.min(255, r + jitter));
        g = Math.max(0, Math.min(255, g + jitter));
        b = Math.max(0, Math.min(255, b + jitter));
      }

      const qr = Math.min(255, Math.round(r / step) * step);
      const qg = Math.min(255, Math.round(g / step) * step);
      const qb = Math.min(255, Math.round(b / step) * step);

      const hex = `#${[qr, qg, qb].map((v) => v.toString(16).padStart(2, '0')).join('')}`;
      pixels[y * res + x] = hex;
      if (colorSet.size < colorCount) colorSet.add(hex);
    }
  }

  converterState.outputPixels = pixels;
  converterState.extractedPalette = Array.from(colorSet).slice(0, 16);

  renderPixelArrayToCanvas(outCanvas, pixels, res);
  document.getElementById('converterOutBadge').textContent = `${res}×${res} · ${converterState.extractedPalette.length} Colors`;

  const palRow = document.getElementById('converterExtractedPalette');
  palRow.innerHTML = converterState.extractedPalette
    .map((hex) => `<span class="mini-swatch-chip" style="background:${hex}" title="${hex}"></span>`)
    .join('');
}

// Render Personal Workspace
function renderWorkspace() {
  const grid = document.getElementById('workspaceItemsGrid');
  if (!grid) return;

  const bookmarkedPosts = appData.posts.filter((p) => p.bookmarked);
  document.getElementById('countDrafts').textContent = appData.drafts.length;
  document.getElementById('countPublished').textContent = appData.posts.length;
  document.getElementById('countRefs').textContent = appData.references.length;
  document.getElementById('countBookmarks').textContent = bookmarkedPosts.length;

  grid.innerHTML = '';

  if (appData.activeWorkspaceTab === 'drafts') {
    appData.drafts.forEach((d) => {
      const card = document.createElement('div');
      card.className = 'workspace-item-card';
      card.innerHTML = `
        <div>
          <div class="w-card-top">
            <span class="px-badge">DRAFT</span>
            <span class="mono-tiny">${d.updated}</span>
          </div>
          <h3 style="margin:8px 0 4px;font-size:0.95rem">${d.title}</h3>
          <p class="muted-small">${d.spec}</p>
        </div>
        <div class="w-card-actions">
          <button type="button" class="px-btn primary tiny" data-open-draft="${d.template}">Open in Studio</button>
        </div>
      `;
      grid.appendChild(card);
    });
  } else if (appData.activeWorkspaceTab === 'published') {
    appData.posts.slice(0, 4).forEach((p) => {
      const card = document.createElement('div');
      card.className = 'workspace-item-card';
      card.innerHTML = `
        <div>
          <div class="w-card-top">
            <span class="px-badge">PUBLISHED</span>
            <span class="mono-tiny">♥ ${p.likes}</span>
          </div>
          <h3 style="margin:8px 0 4px;font-size:0.95rem">${p.title}</h3>
          <p class="muted-small">${p.category} · ${p.project.frames.length} Frames</p>
        </div>
        <div class="w-card-actions">
          <button type="button" class="px-btn secondary tiny" data-view-post="${p.id}">View Post</button>
        </div>
      `;
      grid.appendChild(card);
    });
  } else if (appData.activeWorkspaceTab === 'references') {
    appData.references.forEach((r) => {
      const card = document.createElement('div');
      card.className = 'workspace-item-card';
      card.innerHTML = `
        <div>
          <div class="w-card-top">
            <span class="px-badge">SOURCE IMAGE</span>
          </div>
          <h3 style="margin:8px 0 4px;font-size:0.95rem">${r.title}</h3>
          <p class="muted-small">${r.spec}</p>
        </div>
        <div class="w-card-actions">
          <button type="button" class="px-btn secondary tiny" data-reconvert="${r.sample}">Re-Convert</button>
        </div>
      `;
      grid.appendChild(card);
    });
  } else if (appData.activeWorkspaceTab === 'bookmarks') {
    bookmarkedPosts.forEach((p) => {
      const card = document.createElement('div');
      card.className = 'workspace-item-card';
      card.innerHTML = `
        <div>
          <div class="w-card-top">
            <span class="px-badge">SAVED</span>
            <span class="mono-tiny">${p.handle}</span>
          </div>
          <h3 style="margin:8px 0 4px;font-size:0.95rem">${p.title}</h3>
          <p class="muted-small">♥ ${p.likes} Likes</p>
        </div>
        <div class="w-card-actions">
          <button type="button" class="px-btn secondary tiny" data-view-post="${p.id}">Inspect</button>
        </div>
      `;
      grid.appendChild(card);
    });
  }

  grid.querySelectorAll('[data-open-draft]').forEach((btn) => {
    btn.addEventListener('click', () => {
      loadStudioTemplate(btn.dataset.openDraft);
      document.getElementById('studio').scrollIntoView({ behavior: 'smooth' });
      showToast('Loaded draft into Studio');
    });
  });

  grid.querySelectorAll('[data-view-post]').forEach((btn) => {
    btn.addEventListener('click', () => openArtworkDetailModal(btn.dataset.viewPost));
  });

  grid.querySelectorAll('[data-reconvert]').forEach((btn) => {
    btn.addEventListener('click', () => {
      converterState.sampleName = btn.dataset.reconvert;
      converterState.uploadedImage = null;
      runImageToPixelConversion();
      document.getElementById('converterModal').classList.remove('hidden');
    });
  });
}

// Global Animation Ticker
let animTick = 0;
function startGlobalAnimationLoop() {
  const heroMain = document.getElementById('heroCanvasMain');
  const heroWide = document.getElementById('heroCanvasWide');
  const heroSmall = document.getElementById('heroCanvasSmall');
  const miniPreview = document.getElementById('miniPreviewCanvas');

  setInterval(() => {
    animTick += 1;

    if (appData.posts.length >= 3) {
      const p1 = appData.posts[0].project;
      const p2 = appData.posts[1].project;
      const p3 = appData.posts[2].project;
      renderPixelArrayToCanvas(heroMain, compositeFrame(p1, animTick % p1.frames.length), p1.size);
      renderPixelArrayToCanvas(heroWide, compositeFrame(p2, animTick % p2.frames.length), p2.size);
      renderPixelArrayToCanvas(heroSmall, compositeFrame(p3, animTick % p3.frames.length), p3.size);
    }

    document.querySelectorAll('.gallery-card-canvas').forEach((c) => {
      const post = appData.posts.find((p) => p.id === c.dataset.postId);
      if (post && post.isAnimated) {
        const fIdx = animTick % post.project.frames.length;
        renderPixelArrayToCanvas(c, compositeFrame(post.project, fIdx), post.project.size);
      }
    });

    if (miniPreview && studioState.frames.length > 0) {
      let fIdx = studioState.activeFrameIndex;
      if (studioState.isPlaying && studioState.frames.length > 1) {
        if (studioState.loopMode === 'pingpong') {
          const cycle = studioState.frames.length * 2 - 2;
          const pos = animTick % Math.max(1, cycle);
          fIdx = pos < studioState.frames.length ? pos : cycle - pos;
        } else {
          fIdx = animTick % studioState.frames.length;
        }
      }
      renderPixelArrayToCanvas(miniPreview, compositeFrame(studioState, fIdx), studioState.size);
    }

    const detailModal = document.getElementById('artDetailModal');
    if (detailModal && !detailModal.classList.contains('hidden') && appData.activeDetailPostId && appData.detailPlaying) {
      const post = appData.posts.find((p) => p.id === appData.activeDetailPostId);
      if (post) {
        const fIdx = animTick % post.project.frames.length;
        renderPixelArrayToCanvas(
          document.getElementById('detailShowcaseCanvas'),
          compositeFrame(post.project, fIdx),
          post.project.size
        );
      }
    }
  }, 140);
}

// Export PNG or Horizontal Sprite Sheet
function triggerCanvasDownload(dataUrl, filename) {
  const link = document.createElement('a');
  link.download = filename;
  link.href = dataUrl;
  document.body.appendChild(link);
  link.click();
  link.remove();
}

function exportActiveFramePng(scale = 8) {
  const size = studioState.size;
  const out = document.createElement('canvas');
  out.width = size * scale;
  out.height = size * scale;
  const ctx = out.getContext('2d');
  ctx.imageSmoothingEnabled = false;

  const pixels = compositeFrame(studioState, studioState.activeFrameIndex);
  for (let i = 0; i < pixels.length; i++) {
    if (pixels[i]) {
      const x = (i % size) * scale;
      const y = Math.floor(i / size) * scale;
      ctx.fillStyle = pixels[i];
      ctx.fillRect(x, y, scale, scale);
    }
  }
  const safeName = (document.getElementById('studioProjectTitle').value || 'pixaura-sprite').toLowerCase().replace(/\s+/g, '-');
  triggerCanvasDownload(out.toDataURL('image/png'), `${safeName}-${scale}x.png`);
  showToast(`Downloaded ${scale}× PNG`);
}

function exportHorizontalSpriteSheet(scale = 4) {
  const size = studioState.size;
  const frameCount = studioState.frames.length;
  const out = document.createElement('canvas');
  out.width = size * scale * frameCount;
  out.height = size * scale;
  const ctx = out.getContext('2d');
  ctx.imageSmoothingEnabled = false;

  for (let f = 0; f < frameCount; f++) {
    const pixels = compositeFrame(studioState, f);
    const offsetX = f * size * scale;
    for (let i = 0; i < pixels.length; i++) {
      if (pixels[i]) {
        const x = offsetX + (i % size) * scale;
        const y = Math.floor(i / size) * scale;
        ctx.fillStyle = pixels[i];
        ctx.fillRect(x, y, scale, scale);
      }
    }
  }
  const safeName = (document.getElementById('studioProjectTitle').value || 'pixaura-sheet').toLowerCase().replace(/\s+/g, '-');
  triggerCanvasDownload(out.toDataURL('image/png'), `${safeName}-spritesheet.png`);
  showToast(`Downloaded ${frameCount}-frame Sprite Sheet`);
}

// Wire up all DOM Controls & Modals
function bindAppControls() {
  document.getElementById('sfxToggleBtn').addEventListener('click', () => {
    sfxEnabled = !sfxEnabled;
    document.getElementById('sfxStatusText').textContent = sfxEnabled ? 'SFX: ON' : 'SFX: OFF';
    if (sfxEnabled) playSfx('coin');
    showToast(sfxEnabled ? 'Subtle UI click sounds enabled' : 'UI sounds muted');
  });

  document.getElementById('themeToggleBtn').addEventListener('click', () => {
    document.documentElement.setAttribute('data-theme', 'dark');
    showToast('CANVAS LOCKED TO #131313 // NO LIGHT MODE');
  });

  document.getElementById('startDrawingBtn').addEventListener('click', () => {
    document.getElementById('studio').scrollIntoView({ behavior: 'smooth' });
  });
  document.getElementById('headerCreateBtn').addEventListener('click', () => {
    loadStudioTemplate('blank');
    document.getElementById('studio').scrollIntoView({ behavior: 'smooth' });
    showToast('Started new blank 32×32 canvas');
  });
  document.getElementById('tryTemplateBtn').addEventListener('click', () => {
    loadStudioTemplate('duck');
    document.getElementById('studio').scrollIntoView({ behavior: 'smooth' });
    showToast('Loaded Disco Duck animation in Studio');
  });

  document.getElementById('stampDuckBtn').addEventListener('click', stampPartySprite);

  document.querySelectorAll('[data-open-art]').forEach((card) => {
    card.addEventListener('click', () => openArtworkDetailModal(card.dataset.openArt));
    card.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        openArtworkDetailModal(card.dataset.openArt);
      }
    });
  });

  // Gallery Filter Chips & Search
  document.querySelectorAll('#categoryFilterGroup .chip').forEach((btn) => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('#categoryFilterGroup .chip').forEach((b) => b.classList.remove('active'));
      btn.classList.add('active');
      appData.filterCategory = btn.dataset.category;
      renderGalleryGrid();
    });
  });

  document.querySelectorAll('#formatFilterGroup .chip').forEach((btn) => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('#formatFilterGroup .chip').forEach((b) => b.classList.remove('active'));
      btn.classList.add('active');
      appData.filterFormat = btn.dataset.format;
      renderGalleryGrid();
    });
  });

  document.querySelectorAll('#sortFilterGroup .chip').forEach((btn) => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('#sortFilterGroup .chip').forEach((b) => b.classList.remove('active'));
      btn.classList.add('active');
      appData.filterSort = btn.dataset.sort;
      renderGalleryGrid();
    });
  });

  document.getElementById('gallerySearchInput').addEventListener('input', (e) => {
    appData.searchQuery = e.target.value;
    renderGalleryGrid();
  });

  // Studio Tool Selection
  document.querySelectorAll('.tool-btn').forEach((btn) => {
    btn.addEventListener('click', () => {
      playSfx('blip');
      const tool = btn.dataset.tool;
      studioState.tool = tool;
      document.querySelectorAll('.tool-btn').forEach((b) => b.classList.toggle('active', b === btn));
      document.getElementById('activeToolLabel').textContent = TOOL_LABELS[tool] || tool;
    });
  });

  document.getElementById('brushSizeInput').addEventListener('input', (e) => {
    studioState.brushSize = Number(e.target.value);
    document.getElementById('brushSizeVal').textContent = `${studioState.brushSize} px`;
  });

  document.getElementById('shapeFillToggle').addEventListener('change', (e) => {
    studioState.fillShapes = e.target.checked;
  });

  document.getElementById('gridToggle').addEventListener('change', (e) => {
    studioState.showGrid = e.target.checked;
    renderEditorCanvas();
  });

  document.getElementById('onionSkinToggle').addEventListener('change', (e) => {
    studioState.onionSkin = e.target.checked;
    renderEditorCanvas();
  });

  document.getElementById('zoomRangeInput').addEventListener('input', (e) => {
    studioState.zoom = Number(e.target.value);
    document.getElementById('zoomLevelText').textContent = `${studioState.zoom}%`;
    renderEditorCanvas();
  });

  document.getElementById('templateSelect').addEventListener('change', (e) => {
    loadStudioTemplate(e.target.value);
    showToast(`Loaded ${e.target.options[e.target.selectedIndex].text}`);
  });

  const syncCupSizeButtons = (sizeVal) => {
    document.querySelectorAll('.cup-size-btn').forEach((btn) => {
      const isMatch = Number(btn.dataset.sizeBtn) === Number(sizeVal);
      btn.classList.toggle('active', isMatch);
      btn.setAttribute('aria-checked', isMatch ? 'true' : 'false');
    });
  };

  document.getElementById('canvasSizeSelect').addEventListener('change', (e) => {
    const newSize = Number(e.target.value);
    syncCupSizeButtons(newSize);
    loadStudioTemplate(document.getElementById('templateSelect').value, newSize);
    showToast(`Canvas resized to ${newSize}×${newSize} px`);
  });

  document.querySelectorAll('.cup-size-btn').forEach((btn) => {
    btn.addEventListener('click', () => {
      playSfx('blip');
      const newSize = Number(btn.dataset.sizeBtn);
      document.getElementById('canvasSizeSelect').value = String(newSize);
      syncCupSizeButtons(newSize);
      loadStudioTemplate(document.getElementById('templateSelect').value, newSize);
      showToast(`Selected ${btn.querySelector('.cup-size-name').textContent} (${newSize}×${newSize} px)`);
    });
  });

  document.getElementById('undoBtn').addEventListener('click', performUndo);
  document.getElementById('redoBtn').addEventListener('click', performRedo);

  document.getElementById('flipHBtn').addEventListener('click', () => {
    pushUndoSnapshot();
    const activeLayer = studioState.layers[studioState.activeLayerIndex];
    const cel = studioState.frames[studioState.activeFrameIndex].cels[activeLayer.id];
    const size = studioState.size;
    const flipped = new Array(size * size).fill(null);
    for (let y = 0; y < size; y++) {
      for (let x = 0; x < size; x++) {
        flipped[y * size + (size - 1 - x)] = cel[y * size + x];
      }
    }
    studioState.frames[studioState.activeFrameIndex].cels[activeLayer.id] = flipped;
    syncStudioUI();
    showToast('Flipped layer horizontally');
  });

  document.getElementById('clearLayerBtn').addEventListener('click', () => {
    pushUndoSnapshot();
    const activeLayer = studioState.layers[studioState.activeLayerIndex];
    studioState.frames[studioState.activeFrameIndex].cels[activeLayer.id].fill(null);
    syncStudioUI();
    showToast('Cleared active layer');
  });

  document.getElementById('palettePresetSelect').addEventListener('change', (e) => {
    const preset = PALETTES[e.target.value];
    if (preset) {
      studioState.palette = [...preset];
      studioState.activeColor = preset[2];
      syncStudioUI();
    }
  });

  document.getElementById('customColorPicker').addEventListener('input', (e) => {
    studioState.activeColor = e.target.value;
    document.getElementById('activeColorHex').textContent = e.target.value.toUpperCase();
  });

  document.getElementById('addColorSwatchBtn').addEventListener('click', () => {
    if (!studioState.palette.includes(studioState.activeColor)) {
      studioState.palette.push(studioState.activeColor);
      syncStudioUI();
      showToast(`Added ${studioState.activeColor.toUpperCase()} to palette`);
    }
  });

  document.getElementById('addLayerBtn').addEventListener('click', () => {
    if (studioState.layers.length >= 16) {
      showToast('Maximum 16 layers reached');
      return;
    }
    pushUndoSnapshot();
    const newId = `layer-${Date.now()}`;
    studioState.layers.push({
      id: newId,
      name: `Layer ${studioState.layers.length + 1}`,
      visible: true,
      opacity: 100
    });
    studioState.frames.forEach((f) => {
      f.cels[newId] = new Array(studioState.size * studioState.size).fill(null);
    });
    studioState.activeLayerIndex = studioState.layers.length - 1;
    syncStudioUI();
  });

  document.getElementById('dupLayerBtn').addEventListener('click', () => {
    pushUndoSnapshot();
    const srcLayer = studioState.layers[studioState.activeLayerIndex];
    const newId = `layer-${Date.now()}`;
    studioState.layers.push({
      id: newId,
      name: `${srcLayer.name} Copy`,
      visible: true,
      opacity: srcLayer.opacity
    });
    studioState.frames.forEach((f) => {
      f.cels[newId] = [...f.cels[srcLayer.id]];
    });
    studioState.activeLayerIndex = studioState.layers.length - 1;
    syncStudioUI();
  });

  document.getElementById('layerOpacitySlider').addEventListener('input', (e) => {
    document.getElementById('layerOpacityVal').textContent = `${e.target.value}%`;
  });

  document.getElementById('playPauseAnimBtn').addEventListener('click', () => {
    studioState.isPlaying = !studioState.isPlaying;
    document.getElementById('playBtnText').textContent = studioState.isPlaying ? 'Pause' : 'Play';
  });

  document.getElementById('addFrameBtn').addEventListener('click', () => {
    pushUndoSnapshot();
    const cels = {};
    studioState.layers.forEach((l) => {
      cels[l.id] = new Array(studioState.size * studioState.size).fill(null);
    });
    studioState.frames.push({ id: `frame-${Date.now()}`, cels });
    studioState.activeFrameIndex = studioState.frames.length - 1;
    syncStudioUI();
  });

  document.getElementById('dupFrameBtn').addEventListener('click', () => {
    pushUndoSnapshot();
    const currentFrame = studioState.frames[studioState.activeFrameIndex];
    const cels = {};
    studioState.layers.forEach((l) => {
      cels[l.id] = [...currentFrame.cels[l.id]];
    });
    studioState.frames.splice(studioState.activeFrameIndex + 1, 0, { id: `frame-${Date.now()}`, cels });
    studioState.activeFrameIndex += 1;
    syncStudioUI();
  });

  document.getElementById('deleteFrameBtn').addEventListener('click', () => {
    if (studioState.frames.length <= 1) {
      showToast('Minimum 1 frame required');
      return;
    }
    pushUndoSnapshot();
    studioState.frames.splice(studioState.activeFrameIndex, 1);
    studioState.activeFrameIndex = Math.max(0, studioState.activeFrameIndex - 1);
    syncStudioUI();
  });

  document.getElementById('fpsSlider').addEventListener('input', (e) => {
    studioState.fps = Number(e.target.value);
    syncStudioUI();
  });

  document.getElementById('loopModeSelect').addEventListener('change', (e) => {
    studioState.loopMode = e.target.value;
  });

  // Converter Modal Controls
  const openConverter = () => {
    runImageToPixelConversion();
    document.getElementById('converterModal').classList.remove('hidden');
  };
  document.getElementById('convertImageBtn').addEventListener('click', openConverter);
  document.getElementById('studioConvertBtn').addEventListener('click', openConverter);
  document.getElementById('closeConverterModalBtn').addEventListener('click', () => {
    document.getElementById('converterModal').classList.add('hidden');
  });

  document.querySelectorAll('[data-sample]').forEach((btn) => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('[data-sample]').forEach((b) => b.classList.remove('active'));
      btn.classList.add('active');
      converterState.sampleName = btn.dataset.sample;
      converterState.uploadedImage = null;
      runImageToPixelConversion();
    });
  });

  document.getElementById('converterFileInput').addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      const img = new Image();
      img.onload = () => {
        converterState.uploadedImage = img;
        const srcCanvas = document.getElementById('converterSourceCanvas');
        const ctx = srcCanvas.getContext('2d');
        ctx.clearRect(0, 0, srcCanvas.width, srcCanvas.height);
        ctx.drawImage(img, 0, 0, srcCanvas.width, srcCanvas.height);
        runImageToPixelConversion();
        showToast(`Loaded ${file.name}`);
      };
      img.src = ev.target.result;
    };
    reader.readAsDataURL(file);
  });

  document.getElementById('convResSlider').addEventListener('input', (e) => {
    converterState.resolution = Number(e.target.value);
    document.getElementById('convResVal').textContent = `${converterState.resolution} × ${converterState.resolution} px`;
    runImageToPixelConversion();
  });

  document.getElementById('convColorsSlider').addEventListener('input', (e) => {
    converterState.colorCount = Number(e.target.value);
    document.getElementById('convColorsVal').textContent = `${converterState.colorCount} Colors`;
    runImageToPixelConversion();
  });

  document.getElementById('convDitherSelect').addEventListener('change', (e) => {
    converterState.ditherMode = e.target.value;
    runImageToPixelConversion();
  });

  const importConvertedToStudio = (asNewProject) => {
    const res = converterState.resolution;
    if (asNewProject) {
      studioState.size = res;
      const layerId = 'layer-conv';
      studioState.layers = [{ id: layerId, name: 'Converted Image', visible: true, opacity: 100 }];
      studioState.frames = [{ id: 'frame-1', cels: { [layerId]: [...converterState.outputPixels] } }];
      studioState.activeLayerIndex = 0;
      studioState.activeFrameIndex = 0;
    } else {
      pushUndoSnapshot();
      const newId = `layer-conv-${Date.now()}`;
      studioState.layers.push({ id: newId, name: 'Converted Layer', visible: true, opacity: 100 });
      const targetPixels = new Array(studioState.size * studioState.size).fill(null);
      const copyDim = Math.min(studioState.size, res);
      for (let y = 0; y < copyDim; y++) {
        for (let x = 0; x < copyDim; x++) {
          targetPixels[y * studioState.size + x] = converterState.outputPixels[y * res + x];
        }
      }
      studioState.frames.forEach((f) => {
        f.cels[newId] = [...targetPixels];
      });
      studioState.activeLayerIndex = studioState.layers.length - 1;
    }

    if (converterState.extractedPalette.length > 0) {
      studioState.palette = [...converterState.extractedPalette];
      studioState.activeColor = studioState.palette[0];
    }

    document.getElementById('converterModal').classList.add('hidden');
    syncStudioUI();
    document.getElementById('studio').scrollIntoView({ behavior: 'smooth' });
    showToast('Imported converted pixel art into Studio');
  };

  document.getElementById('convInsertLayerBtn').addEventListener('click', () => importConvertedToStudio(false));
  document.getElementById('convCreateProjectBtn').addEventListener('click', () => importConvertedToStudio(true));

  // Detail Modal Actions
  document.getElementById('closeDetailModalBtn').addEventListener('click', () => {
    document.getElementById('artDetailModal').classList.add('hidden');
  });

  document.getElementById('detailPlayToggleBtn').addEventListener('click', (e) => {
    appData.detailPlaying = !appData.detailPlaying;
    e.target.textContent = appData.detailPlaying ? 'Pause' : 'Play';
  });

  document.getElementById('detailRemixBtn').addEventListener('click', () => {
    const post = appData.posts.find((p) => p.id === appData.activeDetailPostId);
    if (!post) return;
    loadStudioTemplate(post.template, post.project.size);
    document.getElementById('studioProjectTitle').value = `${post.title} (Edit)`;
    document.getElementById('artDetailModal').classList.add('hidden');
    document.getElementById('studio').scrollIntoView({ behavior: 'smooth' });
    showToast(`Opened "${post.title}" in Studio`);
  });

  document.getElementById('detailLikeBtn').addEventListener('click', () => {
    const post = appData.posts.find((p) => p.id === appData.activeDetailPostId);
    if (!post) return;
    post.liked = !post.liked;
    post.likes += post.liked ? 1 : -1;
    document.getElementById('detailLikeCount').textContent = post.likes;
    renderGalleryGrid();
  });

  document.getElementById('detailBookmarkBtn').addEventListener('click', () => {
    const post = appData.posts.find((p) => p.id === appData.activeDetailPostId);
    if (!post) return;
    post.bookmarked = !post.bookmarked;
    document.getElementById('detailBookmarkText').textContent = post.bookmarked ? 'Bookmarked ✓' : 'Bookmark';
    renderWorkspace();
    showToast(post.bookmarked ? 'Saved to Bookmarks' : 'Removed from Bookmarks');
  });

  document.getElementById('detailFollowBtn').addEventListener('click', (e) => {
    const post = appData.posts.find((p) => p.id === appData.activeDetailPostId);
    if (!post) return;
    post.following = !post.following;
    e.target.textContent = post.following ? 'Following ✓' : 'Follow';
    showToast(post.following ? `Following ${post.handle}` : `Unfollowed ${post.handle}`);
  });

  document.getElementById('detailCommentForm').addEventListener('submit', (e) => {
    e.preventDefault();
    const input = document.getElementById('detailCommentInput');
    const text = input.value.trim();
    if (!text) return;
    const post = appData.posts.find((p) => p.id === appData.activeDetailPostId);
    if (!post) return;
    post.comments.push({ author: '@calpixel', text });
    input.value = '';
    renderDetailComments(post);
    showToast('Comment posted');
  });

  // Export & Publish Modal
  const openExportModal = () => {
    document.getElementById('pubTitleInput').value = document.getElementById('studioProjectTitle').value;
    document.getElementById('exportPublishModal').classList.remove('hidden');
  };
  document.getElementById('openExportModalBtn').addEventListener('click', openExportModal);
  document.getElementById('openPublishModalBtn').addEventListener('click', openExportModal);
  document.getElementById('closeExportModalBtn').addEventListener('click', () => {
    document.getElementById('exportPublishModal').classList.add('hidden');
  });

  document.getElementById('downloadPngBtn').addEventListener('click', () => {
    const scale = Number(document.getElementById('exportScaleSelect').value);
    exportActiveFramePng(scale);
  });

  document.getElementById('downloadSpriteSheetBtn').addEventListener('click', () => {
    const scale = Number(document.getElementById('exportScaleSelect').value);
    exportHorizontalSpriteSheet(scale);
  });

  document.getElementById('publishPostForm').addEventListener('submit', (e) => {
    e.preventDefault();
    const title = document.getElementById('pubTitleInput').value.trim() || 'Untitled Pixel Art';
    const category = document.getElementById('pubCategorySelect').value;
    const tags = document
      .getElementById('pubTagsInput')
      .value.split(',')
      .map((t) => t.trim().replace('#', ''))
      .filter(Boolean)
      .slice(0, 5);
    const description = document.getElementById('pubDescInput').value.trim();

    const clonedProject = JSON.parse(
      JSON.stringify({
        size: studioState.size,
        layers: studioState.layers,
        frames: studioState.frames
      })
    );

    const newPost = {
      id: `post-${Date.now()}`,
      title,
      creator: 'Cal T.',
      handle: '@calpixel',
      avatar: 'CT',
      category,
      isAnimated: studioState.frames.length > 1,
      following: true,
      fps: studioState.fps,
      likes: 1,
      liked: true,
      bookmarked: false,
      template: 'duck',
      project: clonedProject,
      palette: [...studioState.palette.slice(0, 8)],
      tags: tags.length ? tags : ['pixelart'],
      description,
      comments: []
    };

    appData.posts.unshift(newPost);
    document.getElementById('exportPublishModal').classList.add('hidden');
    renderGalleryGrid();
    renderWorkspace();
    document.getElementById('explore').scrollIntoView({ behavior: 'smooth' });
    showToast(`Published "${title}" to Gallery`);
  });

  // Workspace Tabs
  document.querySelectorAll('[data-wtab]').forEach((tab) => {
    tab.addEventListener('click', () => {
      document.querySelectorAll('[data-wtab]').forEach((t) => {
        t.classList.toggle('active', t === tab);
        t.setAttribute('aria-selected', t === tab ? 'true' : 'false');
      });
      appData.activeWorkspaceTab = tab.dataset.wtab;
      renderWorkspace();
    });
  });

  document.getElementById('copyProfileLinkBtn').addEventListener('click', () => {
    showToast('Copied profile link: pixaura.app/u/calpixel');
  });

  // Floating Frap Circular Order/Studio CTA & Top-Rounded Feedback Tab
  const frapBtn = document.getElementById('frapQuickStudioBtn');
  if (frapBtn) {
    frapBtn.addEventListener('click', () => {
      playSfx('coin');
      document.getElementById('studio').scrollIntoView({ behavior: 'smooth' });
      showToast('Jumped to Studio Canvas');
    });
  }

  const feedbackBtn = document.getElementById('feedbackTabBtn');
  if (feedbackBtn) {
    feedbackBtn.addEventListener('click', () => {
      showToast('Thank you! Studio feedback form recorded (+10★)');
    });
  }

  const bandExportBtn = document.getElementById('bandExportSpecsBtn');
  if (bandExportBtn) {
    bandExportBtn.addEventListener('click', () => {
      document.getElementById('pubTitleInput').value = document.getElementById('studioProjectTitle').value;
      document.getElementById('exportPublishModal').classList.remove('hidden');
    });
  }

  const bandConvBtn = document.getElementById('bandOpenConverterBtn');
  if (bandConvBtn) {
    bandConvBtn.addEventListener('click', () => {
      runImageToPixelConversion();
      document.getElementById('converterModal').classList.remove('hidden');
    });
  }

  // Keyboard shortcuts
  window.addEventListener('keydown', (e) => {
    if (['INPUT', 'TEXTAREA', 'SELECT'].includes(document.activeElement.tagName)) return;
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z') {
      e.preventDefault();
      performUndo();
    } else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'y') {
      e.preventDefault();
      performRedo();
    } else if (e.key === 'Escape') {
      document.querySelectorAll('.modal').forEach((m) => m.classList.add('hidden'));
    }
  });
}

// Initialize Application
initCommunityPosts();
loadStudioTemplate('duck', 32);
bindStudioCanvasEvents();
renderGalleryGrid();
renderWorkspace();
bindAppControls();
startGlobalAnimationLoop();
