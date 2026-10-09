(function(root, install) {
  if (typeof module === 'object' && module.exports) {
    module.exports = install({}, require('./assets/vendor/tetris-core.js'));
  } else {
    install(root, root.DaubTetrisCore);
  }
}(typeof globalThis !== 'undefined' ? globalThis : this, function installEngines(root, createCore) {
  'use strict';
  if (typeof createCore !== 'function') throw new Error('Load assets/vendor/tetris-core.js before playground-prototype-engines.js');

  function tetris() {
    var core = createCore(), status = 'ready';

    function getState() {
      var state = core.snapshot();
      if (status === 'running' && !state.playing) status = 'over';
      delete state.playing;
      state.status = status;
      return state;
    }

    function command(direction) {
      if (getState().status === 'running') core.command(direction);
      return getState();
    }

    return Object.freeze({
      getState: getState,
      start: function() {
        if (status === 'ready') { core.start(); status = 'running'; }
        return getState();
      },
      move: function(direction) {
        if (direction !== 'left' && direction !== 'right') throw new TypeError('Expected left or right');
        return command(direction === 'left' ? 3 : 1);
      },
      rotate: function() { return command(0); },
      softDrop: function() { return command(2); },
      tick: function(ms) {
        if (typeof ms !== 'number' || !Number.isFinite(ms) || ms < 0) {
          throw new TypeError('Expected finite non-negative elapsed milliseconds');
        }
        if (getState().status === 'running') core.tick(Math.min(ms / 1000, 1));
        return getState();
      },
      pause: function() {
        if (getState().status === 'running') status = 'paused';
        return getState();
      },
      resume: function() {
        if (status === 'paused') status = 'running';
        return getState();
      },
      restart: function() {
        if (status !== 'disposed') { core = createCore(); core.start(); status = 'running'; }
        return getState();
      },
      dispose: function() { status = 'disposed'; }
    });
  }

  var api = {
    tetris: tetris,
    toScript: function() {
      return '(' + installEngines.toString() + ')(globalThis, (' + createCore.toString() + '));';
    },
    prompt: 'Use window.DaubPrototypeEngines.tetris() for classic Tetris rules. ' +
      'Call start(), move("left"|"right"), rotate() (clockwise), softDrop(), tick(elapsedMs), ' +
      'pause(), resume(), restart(), getState(), dispose(). Methods except dispose return a copied state. ' +
      'api.frame gives a timestamp, not a delta: let last=null; api.frame(now=>{ ' +
      'const dt=last===null?0:Math.min(now-last,100); last=now; game.tick(dt); render(game.getState()); }); ' +
      'The engine owns no timers or DOM. ' +
      'State: width=10, height=20, board[y][x]=null or I/J/L/O/S/T/Z (locked cells), ' +
      'active={type,x,y,rotation,cells:[{x,y}]}, next={type,x:0,y:0,rotation:0,cells:[{x,y}]}, ' +
      'score, lines, gravityMs, status=ready/running/paused/over/disposed. ' +
      'active and next are null before start. Draw active.cells over board; draw next.cells in the preview. ' +
      'Use upstream rules without adding collision, rotation, scoring, or line-clear code. ' +
      'No hard drop, hold, ghost, wall kicks, or seven-bag guarantee. Return cleanup calling dispose().'
  };
  root.DaubPrototypeEngines = Object.assign(root.DaubPrototypeEngines || {}, api);
  return root.DaubPrototypeEngines;
}));
