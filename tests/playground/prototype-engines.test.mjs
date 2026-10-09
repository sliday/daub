import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import { chromium } from 'playwright';

const adapterURL = new URL('../../playground-prototype-engines.js', import.meta.url);
const coreURL = new URL('../../assets/vendor/tetris-core.js', import.meta.url);

function load() {
  assert.ok(existsSync(adapterURL), 'browser adapter must exist');
  const context = { Math: Object.assign(Object.create(Math), { random: () => 0 }) };
  runInNewContext(readFileSync(coreURL, 'utf8'), context);
  runInNewContext(readFileSync(adapterURL, 'utf8'), context);
  return context.DaubPrototypeEngines;
}

test('classic engine starts, moves, rotates, and advances with caller-driven gravity', () => {
  const game = load().tetris();
  assert.equal(game.getState().status, 'ready');
  assert.equal(game.getState().active, null);
  game.start();
  const initial = game.getState();
  assert.equal(initial.status, 'running');
  assert.equal(initial.board.length, 20);
  assert.equal(initial.board[0].length, 10);
  assert.equal(initial.active.type, 'I');
  game.move('right');
  assert.equal(game.getState().active.x, initial.active.x + 1);
  game.move('left');
  assert.equal(game.getState().active.x, initial.active.x);
  game.rotate();
  assert.equal(game.getState().active.rotation, 1);
  game.softDrop();
  assert.equal(game.getState().active.y, 1);
  game.tick(599);
  assert.equal(game.getState().active.y, 1);
  game.tick(2);
  assert.equal(game.getState().active.y, 2);
});

test('pause blocks input and gravity; resume preserves state; restart resets score and board', () => {
  const game = load().tetris();
  game.start();
  for (let n = 0; n < 20; n++) game.softDrop();
  assert.ok(game.getState().score > 0);
  game.pause();
  const paused = JSON.stringify(game.getState());
  game.tick(1000); game.move('right'); game.rotate(); game.softDrop();
  assert.equal(JSON.stringify(game.getState()), paused);
  game.resume();
  assert.equal(game.getState().status, 'running');
  game.restart();
  assert.equal(game.getState().score, 0);
  assert.equal(game.getState().lines, 0);
  assert.ok(game.getState().board.flat().every(cell => cell === null));
  assert.equal(game.getState().active.y, 0);
});

test('upstream collision, locking and multi-piece line clearing remain in control', () => {
  const game = load().tetris();
  game.start();
  function place(x, vertical) {
    if (vertical) game.rotate();
    for (let n = 0; n < 10 && game.getState().active.x < x; n++) game.move('right');
    assert.equal(game.getState().active.x, x);
    const score = game.getState().score;
    for (let n = 0; n < 25 && game.getState().score === score; n++) game.softDrop();
    assert.ok(game.getState().score > score);
  }
  for (let n = 0; n < 20; n++) game.move('left');
  assert.ok(game.getState().active.cells.every(cell => cell.x >= 0));
  place(0, false); place(4, false); place(6, true); place(7, true);
  assert.equal(game.getState().lines, 1);
  assert.equal(game.getState().score, 140);
  assert.equal(game.getState().board.flat().filter(Boolean).length, 6);
});

test('snapshots cannot mutate the engine; instances and disposal stay isolated', () => {
  const engines = load();
  const a = engines.tetris(), b = engines.tetris();
  a.start(); b.start();
  const snapshot = a.getState();
  snapshot.board[0][0] = 'Z'; snapshot.active.x = 99; snapshot.active.cells[0].x = 99;
  assert.equal(a.getState().board[0][0], null);
  assert.notEqual(a.getState().active.x, 99);
  a.softDrop();
  assert.equal(b.getState().active.y, 0);
  a.dispose(); a.start(); a.restart(); a.resume(); a.tick(1000); a.softDrop();
  assert.equal(a.getState().status, 'disposed');
  assert.equal(b.getState().status, 'running');
  assert.throws(() => b.tick(NaN), /finite/);
  assert.throws(() => b.tick(-1), /non-negative/);
  assert.throws(() => b.move('diagonal'), /left or right/);
});

test('blocked spawn ends the game; only restart begins a new game', () => {
  const game = load().tetris();
  game.start();
  for (let n = 0; n < 1000 && game.getState().status === 'running'; n++) game.softDrop();
  assert.equal(game.getState().status, 'over');
  const terminal = JSON.stringify(game.getState());
  game.start(); game.resume(); game.tick(1000); game.move('right');
  assert.equal(JSON.stringify(game.getState()), terminal);
  game.restart();
  assert.equal(game.getState().status, 'running');
});

test('portable export includes license and runs in a browser without external requests', async () => {
  const engines = load();
  const script = engines.toScript();
  assert.match(script, /Copyright \(c\) 2011/);
  assert.match(script, /Permission is hereby granted/);
  assert.doesNotMatch(script, /<\/script/i);
  const browser = await chromium.launch({ headless: true, ...(process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH ? { executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH } : {}) });
  try {
    const page = await browser.newPage();
    const requests = [], errors = [];
    page.on('request', request => requests.push(request.url()));
    page.on('pageerror', error => errors.push(error.message));
    await page.setContent('<iframe sandbox="allow-scripts"></iframe>');
    const frame = page.frames()[1];
    await frame.setContent('<script>' + script + '</script>');
    assert.deepEqual(await frame.evaluate(() => {
      const game = window.DaubPrototypeEngines.tetris();
      game.start(); game.tick(601);
      const y = game.getState().active.y;
      game.pause(); game.tick(1000);
      const pausedY = game.getState().active.y;
      game.restart();
      return { y, pausedY, restartedY: game.getState().active.y, status: game.getState().status };
    }), { y: 1, pausedY: 1, restartedY: 0, status: 'running' });
    assert.deepEqual(requests, []);
    assert.deepEqual(errors, []);
  } finally { await browser.close(); }
});
