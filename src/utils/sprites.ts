// DinoDash Pixel Art Sprites
// ' ' represents transparent, 'X' represents colored pixel

export const DINO_STAND = [
  "                 XXXXXX",
  "                XXXXXXXX",
  "                XX XXXXX",
  "                XXXXXXXX",
  "                XXXX    ",
  "                XXXXXX  ",
  " X             XXXXX    ",
  " XX           XXXXXX    ",
  " XXX         XXXXXXX    ",
  " XXXX       XXXXXXXX    ",
  " XXXXX     XXXXXXXXX    ",
  "  XXXXXXXXXXXXXXXXX     ",
  "   XXXXXXXXXXXXXXX      ",
  "    XXXXXXXXXXXXX       ",
  "     XXXXXXXXXXX        ",
  "      XXXXXXXXX         ",
  "       XXXXXXX          ",
  "        XXXXX           ",
  "        X   X           ",
  "        X   X           ",
  "        XX  XX          "
];

export const DINO_RUN_1 = [
  "                 XXXXXX",
  "                XXXXXXXX",
  "                XX XXXXX",
  "                XXXXXXXX",
  "                XXXX    ",
  "                XXXXXX  ",
  " X             XXXXX    ",
  " XX           XXXXXX    ",
  " XXX         XXXXXXX    ",
  " XXXX       XXXXXXXX    ",
  " XXXXX     XXXXXXXXX    ",
  "  XXXXXXXXXXXXXXXXX     ",
  "   XXXXXXXXXXXXXXX      ",
  "    XXXXXXXXXXXXX       ",
  "     XXXXXXXXXXX        ",
  "      XXXXXXXXX         ",
  "       XXXXXXX          ",
  "        XXXXX           ",
  "        XX  X           ",
  "        X   X           ",
  "            XX          "
];

export const DINO_RUN_2 = [
  "                 XXXXXX",
  "                XXXXXXXX",
  "                XX XXXXX",
  "                XXXXXXXX",
  "                XXXX    ",
  "                XXXXXX  ",
  " X             XXXXX    ",
  " XX           XXXXXX    ",
  " XXX         XXXXXXX    ",
  " XXXX       XXXXXXXX    ",
  " XXXXX     XXXXXXXXX    ",
  "  XXXXXXXXXXXXXXXXX     ",
  "   XXXXXXXXXXXXXXX      ",
  "    XXXXXXXXXXXXX       ",
  "     XXXXXXXXXXX        ",
  "      XXXXXXXXX         ",
  "       XXXXXXX          ",
  "        XXXXX           ",
  "        X   XX          ",
  "        X   X           ",
  "        XX              "
];

export const DINO_DUCK_1 = [
  "                 XXXXXXXXXXXXXXX",
  "                XXXXXXXXXXXXXXXX",
  "                XX XXXXXXXXXXXXX",
  "                XXXXXXXXXXXXXXXX",
  "                XXXXXXXX        ",
  " X             XXXXXXXXXX       ",
  " XX           XXXXXXXXXXX       ",
  " XXXX        XXXXXXXXXXXX       ",
  " XXXXXX    XXXXXXXXXXXXX        ",
  "  XXXXXXXXXXXXXXXXXXXX          ",
  "    XXXXXXXXXXXXXXXX            ",
  "      XXXXXXXXXXXX              ",
  "       XX    X                  ",
  "       XXX   XX                 "
];

export const DINO_DUCK_2 = [
  "                 XXXXXXXXXXXXXXX",
  "                XXXXXXXXXXXXXXXX",
  "                XX XXXXXXXXXXXXX",
  "                XXXXXXXXXXXXXXXX",
  "                XXXXXXXX        ",
  " X             XXXXXXXXXX       ",
  " XX           XXXXXXXXXXX       ",
  " XXXX        XXXXXXXXXXXX       ",
  " XXXXXX    XXXXXXXXXXXXX        ",
  "  XXXXXXXXXXXXXXXXXXXX          ",
  "    XXXXXXXXXXXXXXXX            ",
  "      XXXXXXXXXXXX              ",
  "       X     XX                 ",
  "       XX    X                  "
];

export const DINO_DEAD = [
  "                 XXXXXX",
  "                XXXXXXXX",
  "                X X X XX", // X X represents dead crossed eyes
  "                XXXXXXXX",
  "                XXXX    ",
  "                XXXXXX  ",
  " X             XXXXX    ",
  " XX           XXXXXX    ",
  " XXX         XXXXXXX    ",
  " XXXX       XXXXXXXX    ",
  " XXXXX     XXXXXXXXX    ",
  "  XXXXXXXXXXXXXXXXX     ",
  "   XXXXXXXXXXXXXXX      ",
  "    XXXXXXXXXXXXX       ",
  "     XXXXXXXXXXX        ",
  "      XXXXXXXXX         ",
  "       XXXXXXX          ",
  "        XXXXX           ",
  "        X   X           ",
  "        X   X           ",
  "        XX  XX          "
];

export const CACTUS_SMALL = [
  "    XXX    ",
  "   XXXXX   ",
  "   X X X   ",
  "   X X X   ",
  "   X X X   ",
  " XX X X XX ",
  "XXX X XXXX ",
  "XXX X XXX  ",
  " XX X XX   ",
  "    X      ",
  "    X      ",
  "    X      ",
  "    X      ",
  "    X      ",
  "    X      "
];

export const CACTUS_LARGE = [
  "     XXXX     ",
  "    XXXXXX    ",
  "    X XX X    ",
  "    X XX X    ",
  "    X XX X    ",
  "    X XX X    ",
  "  X X XX X X  ",
  " XXXX XX XXXX ",
  " XXXXXXX XXXX ",
  "  XXX XX XXX  ",
  "      XX      ",
  "      XX      ",
  "      XX      ",
  "      XX      ",
  "      XX      ",
  "      XX      ",
  "      XX      ",
  "      XX      "
];

export const BIRD_UP = [
  "      XXXXXX      ",
  "    XXXXXXXXXX    ",
  "   XXXXXXXXXXXX   ",
  "  XXXX XXXXXXXXX  ",
  " XXXXXXXXXXXXXXX  ",
  "  XXXXXXXXXXXXX   ",
  "    XXXXXXXXX     ",
  "     XXXXXXX      ",
  "      XXXX        ",
  "       XX         "
];

export const BIRD_DOWN = [
  "      XXXXXX      ",
  "    XXXXXXXXXX    ",
  "   XXXXXXXXXXXX   ",
  "  XXXX XXXXXXXXX  ",
  " XXXXXXXXXXXXXXX  ",
  "  XXXXXXXXXXXXX   ",
  "    XXXXXXXXX     ",
  "     XX   XX      ",
  "     X     X      ",
  "     X     X      "
];

export const CLOUD = [
  "      XXXXXX      ",
  "    XXXXXXXXXX    ",
  "   XXXXXXXXXXXX   ",
  "  XXXXXXXXXXXXXX  ",
  " XXXXXXXXXXXXXXXX ",
  "  XXXXXXXXXXXXXX  ",
  "    XXXXXXXXXX    "
];

// Cache to store pre-rendered canvases for hardware-accelerated drawing
const spriteCanvasCache = new Map<string, HTMLCanvasElement>();

export function clearSpriteCache() {
  spriteCanvasCache.clear();
}

function getFillStyle(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  fillColorOrSkin: string
): string | CanvasGradient {
  if (fillColorOrSkin === "golden") {
    const gradient = ctx.createLinearGradient(0, 0, width, height);
    gradient.addColorStop(0, "#ffe066");
    gradient.addColorStop(0.5, "#f5b041");
    gradient.addColorStop(1, "#9a7d0a");
    return gradient;
  }
  if (fillColorOrSkin === "galaxy") {
    const gradient = ctx.createLinearGradient(0, 0, width, height);
    gradient.addColorStop(0, "#3f51b5");
    gradient.addColorStop(0.5, "#9c27b0");
    gradient.addColorStop(1, "#e91e63");
    return gradient;
  }
  if (fillColorOrSkin === "pixel_king") {
    const gradient = ctx.createLinearGradient(0, 0, width, height);
    gradient.addColorStop(0, "#7d3c98");
    gradient.addColorStop(1, "#4a235a");
    return gradient;
  }
  return fillColorOrSkin;
}

// Helper to draw a sprite on a canvas context
export function drawSprite(
  ctx: CanvasRenderingContext2D,
  sprite: string[],
  x: number,
  y: number,
  pixelSize: number,
  color: string | CanvasGradient
) {
  ctx.fillStyle = color;
  for (let r = 0; r < sprite.length; r++) {
    const row = sprite[r];
    let startC = -1;
    let runLength = 0;
    for (let c = 0; c < row.length; c++) {
      if (row[c] === "X") {
        if (startC === -1) {
          startC = c;
        }
        runLength++;
      } else {
        if (startC !== -1) {
          ctx.fillRect(
            Math.floor(x + startC * pixelSize),
            Math.floor(y + r * pixelSize),
            runLength * pixelSize,
            pixelSize
          );
          startC = -1;
          runLength = 0;
        }
      }
    }
    if (startC !== -1) {
      ctx.fillRect(
        Math.floor(x + startC * pixelSize),
        Math.floor(y + r * pixelSize),
        runLength * pixelSize,
        pixelSize
      );
    }
  }
}

// Cached version of drawSprite that uses offscreen canvas
export function drawSpriteCached(
  ctx: CanvasRenderingContext2D,
  sprite: string[],
  x: number,
  y: number,
  pixelSize: number,
  fillColorOrSkin: string,
  outlineColor: string | null = null,
  shadowColor: string | null = null,
  shadowBlur: number = 0,
  cacheKey: string
) {
  let cachedCanvas = spriteCanvasCache.get(cacheKey);
  if (!cachedCanvas) {
    const { width, height } = getSpriteDimensions(sprite, pixelSize);
    
    // Add extra padding to prevent clipping of borders or shadows
    const padding = shadowBlur > 0 ? Math.ceil(shadowBlur * 1.5) : (outlineColor ? pixelSize : 0);
    
    cachedCanvas = document.createElement("canvas");
    cachedCanvas.width = width + padding * 2;
    cachedCanvas.height = height + padding * 2;
    
    const oCtx = cachedCanvas.getContext("2d");
    if (oCtx) {
      if (shadowColor && shadowBlur > 0) {
        oCtx.shadowColor = shadowColor;
        oCtx.shadowBlur = shadowBlur;
      }
      
      const drawX = padding;
      const drawY = padding;
      const fillStyle = getFillStyle(oCtx, width, height, fillColorOrSkin);
      
      if (outlineColor) {
        oCtx.fillStyle = outlineColor;
        const offsets = [
          [-1, 0], [1, 0], [0, -1], [0, 1]
        ];
        for (const [dx, dy] of offsets) {
          drawSprite(oCtx, sprite, drawX + dx * pixelSize, drawY + dy * pixelSize, pixelSize, outlineColor);
        }
      }
      
      drawSprite(oCtx, sprite, drawX, drawY, pixelSize, fillStyle);
    }
    spriteCanvasCache.set(cacheKey, cachedCanvas);
  }
  
  const padding = shadowBlur > 0 ? Math.ceil(shadowBlur * 1.5) : (outlineColor ? pixelSize : 0);
  ctx.drawImage(cachedCanvas, Math.floor(x - padding), Math.floor(y - padding));
}


// Get the actual visual dimensions of a sprite in pixels
export function getSpriteDimensions(sprite: string[], pixelSize: number) {
  const height = sprite.length * pixelSize;
  const width = Math.max(...sprite.map(row => row.length)) * pixelSize;
  return { width, height };
}

export const SUN = [
  "    X  XX  X    ",
  "     XXXXXX     ",
  "   XXXXXXXXXX   ",
  "  XXXXXXXXXXXX  ",
  "X XXXXXXXXXXXX X",
  "  XXXXXXXXXXXX  ",
  "XX XXXXXXXXXX XX",
  "XX XXXXXXXXXX XX",
  "  XXXXXXXXXXXX  ",
  "X XXXXXXXXXXXX X",
  "  XXXXXXXXXXXX  ",
  "   XXXXXXXXXX   ",
  "     XXXXXX     ",
  "    X  XX  X    "
];

export const MOON = [
  "      XXXX      ",
  "    XXXXXXXX    ",
  "   XXXXXXXX     ",
  "  XXXXXXXX      ",
  "  XXXXXXX       ",
  " XXXXXXX        ",
  " XXXXXXX        ",
  " XXXXXXX        ",
  " XXXXXXX        ",
  "  XXXXXXX       ",
  "  XXXXXXXX      ",
  "   XXXXXXXX     ",
  "    XXXXXXXX    ",
  "      XXXX      "
];

export const STAR_1 = [
  " X ",
  "XXX",
  " X "
];

export const STAR_2 = [
  "X X",
  " X ",
  "X X"
];

export const STAR_3 = [
  "X"
];

// Helper to draw a sprite with a 1-pixel-thick border outline on a canvas context
export function drawSpriteWithOutline(
  ctx: CanvasRenderingContext2D,
  sprite: string[],
  x: number,
  y: number,
  pixelSize: number,
  fillColor: string | CanvasGradient,
  outlineColor: string
) {
  ctx.fillStyle = outlineColor;
  const offsets = [
    [-1, 0], [1, 0], [0, -1], [0, 1]
  ];
  // Draw outline
  for (const [dx, dy] of offsets) {
    for (let r = 0; r < sprite.length; r++) {
      const row = sprite[r];
      let startC = -1;
      let runLength = 0;
      for (let c = 0; c < row.length; c++) {
        if (row[c] === "X") {
          if (startC === -1) {
            startC = c;
          }
          runLength++;
        } else {
          if (startC !== -1) {
            ctx.fillRect(
              Math.floor(x + startC * pixelSize + dx * pixelSize),
              Math.floor(y + r * pixelSize + dy * pixelSize),
              runLength * pixelSize,
              pixelSize
            );
            startC = -1;
            runLength = 0;
          }
        }
      }
      if (startC !== -1) {
        ctx.fillRect(
          Math.floor(x + startC * pixelSize + dx * pixelSize),
          Math.floor(y + r * pixelSize + dy * pixelSize),
          runLength * pixelSize,
          pixelSize
        );
      }
    }
  }
  // Draw fill
  ctx.fillStyle = fillColor;
  for (let r = 0; r < sprite.length; r++) {
    const row = sprite[r];
    let startC = -1;
    let runLength = 0;
    for (let c = 0; c < row.length; c++) {
      if (row[c] === "X") {
        if (startC === -1) {
          startC = c;
        }
        runLength++;
      } else {
        if (startC !== -1) {
          ctx.fillRect(
            Math.floor(x + startC * pixelSize),
            Math.floor(y + r * pixelSize),
            runLength * pixelSize,
            pixelSize
          );
          startC = -1;
          runLength = 0;
        }
      }
    }
    if (startC !== -1) {
      ctx.fillRect(
        Math.floor(x + startC * pixelSize),
        Math.floor(y + r * pixelSize),
        runLength * pixelSize,
        pixelSize
      );
    }
  }
}

export const GIFT = [
  "   XX   ",
  "  XXXX  ",
  " XXXXXX ",
  "XXXXXXXX",
  "XX XX XX",
  "XX XX XX",
  "XXXXXXXX",
  " XXXXXX "
];

export const OVERLAY_SUNGLASSES = [
  "XXXX"
];

export const OVERLAY_SCARF = [
  "XXXX",
  " X  ",
  " X  "
];

export const OVERLAY_CROWN = [
  "X X X",
  "XXXXX"
];
