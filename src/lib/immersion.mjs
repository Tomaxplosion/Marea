const cache = new Map();
const clamp = (value, min, max) => Math.max(min, Math.min(max, value));

function rgbToHsl(r, g, b) {
  r /= 255; g /= 255; b /= 255;
  const max = Math.max(r, g, b), min = Math.min(r, g, b);
  const light = (max + min) / 2, delta = max - min;
  if (!delta) return [0, 0, light];
  const sat = delta / (1 - Math.abs(2 * light - 1));
  let hue = max === r ? ((g - b) / delta) % 6 : max === g ? (b - r) / delta + 2 : (r - g) / delta + 4;
  return [(hue * 60 + 360) % 360, sat, light];
}

function rgbFromHsl(h, s, l) {
  s /= 100; l /= 100;
  const a = s * Math.min(l, 1 - l);
  const channel = (offset) => {
    const k = (offset + h / 30) % 12;
    return l - a * Math.max(-1, Math.min(k - 3, 9 - k, 1));
  };
  return [channel(0), channel(8), channel(4)];
}
const luminance = (rgb) => rgb.map(c => c <= .04045 ? c / 12.92 : ((c + .055) / 1.055) ** 2.4)
  .reduce((sum, c, i) => sum + c * [.2126, .7152, .0722][i], 0);
const color = (h, s, l) => `hsl(${Math.round(h)} ${Math.round(s)}% ${Math.round(l)}%)`;
const readableInk = (h, s, l) => luminance(rgbFromHsl(h, s, l)) > .179 ? '#101418' : '#ffffff';

export function paletteFromPixels(pixels) {
  if (!pixels?.length || pixels.length % 4) throw new TypeError('Invalid image pixels.');
  const buckets = Array.from({ length: 24 }, () => ({ weight: 0, saturation: 0 }));
  let lightTotal = 0, count = 0;
  for (let index = 0; index < pixels.length; index += 4) {
    if (pixels[index + 3] < 128) continue;
    const [h, s, l] = rgbToHsl(pixels[index], pixels[index + 1], pixels[index + 2]);
    if (l < .04 || l > .97) continue;
    lightTotal += l; count++;
    if (s < .12) continue;
    const bucket = buckets[Math.floor(h / 15) % 24];
    const weight = .25 + s;
    bucket.weight += weight;
    bucket.saturation += s * weight;
  }
  const dominant = buckets.reduce((best, bucket, index) => bucket.weight > buckets[best].weight ? index : best, 0);
  const bucket = buckets[dominant];
  const hue = bucket.weight ? dominant * 15 + 7.5 : 200;
  const saturation = bucket.weight ? clamp(bucket.saturation / bucket.weight * 100, 18, 62) : 5;
  const accentSat = bucket.weight ? clamp(saturation + 12, 30, 76) : 8;
  const dark = !count || lightTotal / count < .56;
  const accentLight = dark ? 72 : 32;
  const panelLight = dark ? 19 : 25;
  const panelSat = saturation * .6;
  const ink = color(hue, 12, dark ? 95 : 12);
  const muted = color(hue, 14, dark ? 75 : 33);
  const panelInk = readableInk(hue, panelSat, panelLight);
  return { theme: dark ? 'dark' : 'light', hue, variables: {
    '--paper': color(hue, saturation * .45, dark ? 9 : 94), '--ink': ink, '--muted': muted,
    '--green': color(hue, accentSat, accentLight), '--coral': color(hue, accentSat, dark ? 79 : 32),
    '--line': color(hue, saturation * .35, dark ? 29 : 79),
    '--mood-sidebar': color(hue, saturation * .42, dark ? 12 : 97),
    '--mood-surface': color(hue, saturation * .35, dark ? 15 : 98),
    '--mood-surface-alt': color(hue, saturation * .4, dark ? 21 : 89),
    '--mood-accent': color(hue, accentSat, accentLight),
    '--mood-accent-soft': color(hue, saturation * .5, dark ? 24 : 86),
    '--mood-accent-ink': readableInk(hue, accentSat, accentLight),
    '--mood-panel': color(hue, panelSat, panelLight), '--mood-panel-ink': panelInk,
    '--mood-panel-muted': color(hue, 16, 82), '--mood-panel-accent': color(hue, accentSat, 80),
    '--mood-input': color(hue, saturation * .3, dark ? 18 : 99),
    '--mood-placeholder': muted, '--mood-hover': color(hue, saturation * .4, dark ? 23 : 90)
  } };
}

export function getVideoPalette(videoId) {
  if (!/^[A-Za-z0-9_-]{11}$/.test(videoId)) return Promise.reject(new Error('Invalid video ID.'));
  if (cache.has(videoId)) return cache.get(videoId);
  const task = (async () => {
    const image = new Image();
    const source = window.marea?.getVideoThumbnail
      ? await window.marea.getVideoThumbnail(videoId)
      : `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`;
    if (!source.startsWith('data:')) image.crossOrigin = 'anonymous';
    await new Promise((resolve, reject) => {
      const timeout = setTimeout(() => { image.src = ''; reject(new Error('Image timeout.')); }, 10000);
      image.onload = () => { clearTimeout(timeout); resolve(); };
      image.onerror = () => { clearTimeout(timeout); reject(new Error('Image unavailable.')); };
      image.src = source;
    });
    const canvas = document.createElement('canvas');
    canvas.width = 64; canvas.height = 36;
    const context = canvas.getContext('2d', { willReadFrequently: true });
    context.drawImage(image, 0, 0, 64, 36);
    return paletteFromPixels(context.getImageData(0, 0, 64, 36).data);
  })();
  cache.set(videoId, task);
  task.catch(() => cache.delete(videoId));
  if (cache.size > 32) cache.delete(cache.keys().next().value);
  return task;
}
