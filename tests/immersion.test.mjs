import test from 'node:test';
import assert from 'node:assert/strict';
import { paletteFromPixels, getVideoPalette } from '../src/lib/immersion.mjs';
const pixels = (rgb, count = 200) => new Uint8ClampedArray(Array.from({length:count},()=>[...rgb,255]).flat());

test('video tones produce different palettes, with automatic light and dark modes', () => {
  const warm = paletteFromPixels(pixels([230,220,100]));
  const cool = paletteFromPixels(pixels([40,70,150]));
  assert.equal(warm.theme, 'light');
  assert.equal(cool.theme, 'dark');
  assert.notEqual(warm.variables['--paper'], cool.variables['--paper']);
  assert.notEqual(warm.variables['--mood-accent'], cool.variables['--mood-accent']);
  assert.ok(warm.hue < 90 && cool.hue > 180);
});

test('black borders and transparent pixels do not dominate the palette', () => {
  const red = pixels([190,30,30],20);
  const combined = new Uint8ClampedArray([...pixels([0,0,0],200),...red,...Array(100).fill([0,0,255,0]).flat()]);
  assert.equal(paletteFromPixels(combined).hue, paletteFromPixels(red).hue);
});

test('grayscale and empty-looking images yield finite neutral colors', () => {
  for(const rgb of [[0,0,0],[255,255,255],[128,128,128]]) {
    const palette = paletteFromPixels(pixels(rgb));
    for(const value of Object.values(palette.variables)) assert.ok(!/NaN|Infinity/.test(value));
    assert.ok(['dark','light'].includes(palette.theme));
  }
  assert.throws(()=>paletteFromPixels([]));
  assert.throws(()=>paletteFromPixels([1,2,3]));
});

test('thumbnail lookup rejects URLs and malformed video identifiers', async () => {
  for(const value of ['https://evil.example', '../secret', '', 'short']) await assert.rejects(getVideoPalette(value));
});
