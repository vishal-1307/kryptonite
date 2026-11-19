// Registry of visual renderers. A renderer is { type, render(data, step) => Element, update?(el, data) }.
// To add a new visual: create visuals/<name>.js and add it to this list.
import letterStrip from './letterStrip.js';
import wheel from './wheel.js';
import textRows from './textRows.js';
import grid from './grid.js';
import railFence from './railFence.js';
import matrix from './matrix.js';
import byteGrid from './byteGrid.js';
import hexDump from './hexDump.js';
import math from './math.js';
import table from './table.js';
import bits from './bits.js';
import flow from './flow.js';
import digest from './digest.js';

export const visuals = Object.fromEntries(
  [letterStrip, wheel, textRows, grid, railFence, matrix, byteGrid, hexDump, math, table, bits, flow, digest].map((v) => [v.type, v]),
);
