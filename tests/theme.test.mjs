import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const css = readFileSync(fileURLToPath(new URL('../src/tracker.css', import.meta.url)), 'utf8');
const utilities = readFileSync(fileURLToPath(new URL('../src/index.css', import.meta.url)), 'utf8');
const app = readFileSync(fileURLToPath(new URL('../src/App.tsx', import.meta.url)), 'utf8');

function palette(selector) {
  const match = css.match(new RegExp(selector + '\\s*\\{([\\s\\S]*?)^\\}', 'm'));
  assert.ok(match, `Missing theme block ${selector}`);
  return Object.fromEntries([...match[1].matchAll(/^\s*(--[\w-]+):\s*([^;]+);/gm)].map(([, key, value]) => [key, value]));
}

function luminance(hex) {
  assert.match(hex, /^#[0-9a-f]{6}$/i, `Expected a solid colour, got ${hex}`);
  const rgb = hex.slice(1).match(/../g).map(component => Number.parseInt(component, 16) / 255)
    .map(channel => channel <= 0.04045 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4);
  return 0.2126 * rgb[0] + 0.7152 * rgb[1] + 0.0722 * rgb[2];
}

function contrast(a, b) {
  const l1 = luminance(a);
  const l2 = luminance(b);
  return (Math.max(l1, l2) + 0.05) / (Math.min(l1, l2) + 0.05);
}

const atlas = palette(':root');
const signal = palette('html\\.theme-dark');

test('Atlas light and Signal dark have matching design tokens', () => {
  const required = ['--app-bg', '--sidebar-bg', '--surface', '--text', '--muted', '--border', '--accent',
    '--accent-soft', '--accent-solid', '--on-accent', '--success', '--warning', '--danger'];
  for (const token of required) {
    assert.ok(atlas[token], `Atlas missing ${token}`);
    assert.ok(signal[token], `Signal missing ${token}`);
  }
  assert.deepEqual(Object.keys(atlas).sort(), Object.keys(signal).sort(), 'Light and dark token sets drifted');
  assert.equal(atlas['--app-bg'], '#F6F3ED');
  assert.equal(atlas['--accent'], '#A74E35');
  assert.equal(signal['--app-bg'], '#141719');
  assert.equal(signal['--accent'], '#DFB96B');
});

test('both themes preserve at least 4.5:1 contrast on key content and actions', () => {
  const pairs = [['--text', '--surface'], ['--muted', '--surface'], ['--accent', '--surface'],
    ['--on-accent', '--accent-solid'], ['--success', '--success-soft'],
    ['--warning', '--warning-soft'], ['--danger', '--danger-soft']];
  for (const [name, tokens] of [['Atlas', atlas], ['Signal', signal]]) {
    for (const [foreground, background] of pairs) {
      const ratio = contrast(tokens[foreground], tokens[background]);
      assert.ok(ratio >= 4.5, `${name} ${foreground} on ${background}: ${ratio.toFixed(2)}:1`);
    }
  }
});

test('legacy indigo components and map pins use the current palette', () => {
  assert.match(utilities, /\.tracker-app \.bg-indigo-600/);
  assert.match(utilities, /var\(--on-accent\)/);
  assert.match(utilities, /var\(--success-soft\)/);
  assert.match(app, /createCustomIcon\(Home, 'var\(--map-home\)'\)/);
  assert.match(app, /color="var\(--map-route\)"/);
  assert.doesNotMatch(css + utilities + app, /#(?:0f766e|7ddac8|5eead4|166b60|2563eb)\b/i);
});
