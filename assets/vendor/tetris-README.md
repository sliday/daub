# Classic Tetris Core

Source: [Jake Gordon, javascript-tetris](https://github.com/jakesgordon/javascript-tetris).
Pinned commit: `e5c0c42f7dac0f3514a55eff656c6e22e95d68ed`.

- [Source HTML](https://raw.githubusercontent.com/jakesgordon/javascript-tetris/e5c0c42f7dac0f3514a55eff656c6e22e95d68ed/index.html)
- [MIT license](https://raw.githubusercontent.com/jakesgordon/javascript-tetris/e5c0c42f7dac0f3514a55eff656c6e22e95d68ed/LICENSE)
- Local license: `tetris-LICENSE`, also embedded inside the core factory and inline exports.
- Runtime dependencies: zero. No framework, DOM, network, timer, or build requirement.

## Extraction

`tetris-core.js` preserves these sections from the pinned `index.html` byte for byte:

1. Piece definitions (`var i = ...`) through `randomPiece()`.
2. Gameplay functions (`play()`) through `removeLine()`.

The wrapper retains upstream random arithmetic, direction values, board dimensions, and gravity constants. It replaces DOM visibility and rendering invalidation with no-ops, scopes variables per instance, and adds a snapshot reader. The adapter owns lifecycle guards and milliseconds-to-seconds conversion. It calls upstream `handle`, `update`, and `play`; it does not implement collision, rotation, locking, line clearing, or scoring.

This is a classic-game fixture, not a modern Guideline engine. Upstream uses a four-of-each-piece bag, random spawn columns, clockwise rotation without kicks, immediate locking, and its own scoring (10 per locked piece plus 100/200/400/800 per one/two/three/four-line clear). It provides no hold, hard drop, ghost, T-spin rules, or seven-bag guarantee. We preserve upstream quirks, including its random selection arithmetic and line scan that excludes row zero. We do not claim a comprehensive rules certification.

## Host Inclusion

Load these scripts in order in the host:

```html
<script src="assets/vendor/tetris-core.js"></script>
<script src="playground-prototype-engines.js"></script>
```

`DaubPrototypeEngines.toScript()` returns a self-contained JavaScript string, including the MIT notice, for insertion before prototype code in a sandbox/export document. It needs neither the original script URLs nor the host globals. It returns JavaScript, not a script tag. `DaubPrototypeEngines.prompt` contains the prompt-facing contract. CommonJS hosts can also require `playground-prototype-engines.js`.

## Prototype API

```js
const game = window.DaubPrototypeEngines.tetris();
game.start();
game.move('left'); // or 'right'
game.rotate(); // clockwise
game.softDrop();
game.tick(16); // elapsed milliseconds, not an RAF timestamp
game.pause();
game.resume();
game.restart(); // new core, empty board, zero score, running
const state = game.getState();
game.dispose(); // terminal; later commands cannot restart it
```

Methods other than `dispose` return copied snapshots. Before start, `active` and `next` are null. Each snapshot contains:

- `width: 10`, `height: 20`, `board[y][x]`: null or `I/J/L/O/S/T/Z`, locked cells only.
- `active`: `{type, x, y, rotation, cells: [{x, y}]}` in board coordinates. Draw these cells over the board.
- `next`: the same shape with origin `(0,0)` and rotation zero, for the preview.
- `score`, `lines`, `gravityMs`, `status`: `ready`, `running`, `paused`, `over`, or `disposed`.

Only `restart()` leaves `over`. `start()` acts only on `ready`; `resume()` acts only on `paused`. Pausing blocks gameplay commands and gravity. Invalid move directions and negative/non-finite deltas throw. `tick` preserves upstream's one-second delta cap and at-most-one gravity drop per call; feed frame deltas, not batched seconds. The adapter allocates no browser resources.

With the prototype runtime, use `api.frame(now => ...)`, calculate the delta, and clamp it to 100 ms to avoid catching up after tab suspension. Keep updating the previous timestamp while paused. Wire keyboard/touch input with `api.on`, draw the copied state, and return cleanup calling `game.dispose()`. The runtime cancels its listeners and animation callbacks.

## Verification

Run `node --test tests/playground/prototype-engines.test.mjs` from the repository root. Tests cover lifecycle, input, gravity, board isolation, bounds, locking, line clearing, top-out, and a portable inline export inside a Chromium sandbox with zero network requests. No provider calls or deployment form part of these tests. Main-task integration into `playground.html` and `playground-prototype.js` remains separate.
