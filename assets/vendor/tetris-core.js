(function(root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory;
  else root.DaubTetrisCore = factory;
}(typeof globalThis !== 'undefined' ? globalThis : this, function createTetrisCore() {
/*
Copyright (c) 2011, 2012, 2013, 2014, 2015, 2016 Jake Gordon and contributors

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.

Headless extraction from jakesgordon/javascript-tetris
commit e5c0c42f7dac0f3514a55eff656c6e22e95d68ed, index.html.
Piece definitions and gameplay functions below retain upstream source.
*/
    function random(min, max) { return (min + (Math.random() * (max - min))); }
    var DIR = { UP: 0, RIGHT: 1, DOWN: 2, LEFT: 3, MIN: 0, MAX: 3 };
    var speed = { start: 0.6, decrement: 0.005, min: 0.1 }, nx = 10, ny = 20;
    var blocks = [], actions = [], playing = false, dt = 0, current = null, next = null;
    var score = 0, vscore = 0, rows = 0, step = speed.start;

    // The host renders snapshots; upstream rendering invalidation has no work here.
    function hide() {}
    function show() {}
    function invalidate() {}
    function invalidateNext() {}
    function invalidateScore() {}
    function invalidateRows() {}

    var i = { size: 4, blocks: [0x0F00, 0x2222, 0x00F0, 0x4444], color: 'cyan'   };
    var j = { size: 3, blocks: [0x44C0, 0x8E00, 0x6440, 0x0E20], color: 'blue'   };
    var l = { size: 3, blocks: [0x4460, 0x0E80, 0xC440, 0x2E00], color: 'orange' };
    var o = { size: 2, blocks: [0xCC00, 0xCC00, 0xCC00, 0xCC00], color: 'yellow' };
    var s = { size: 3, blocks: [0x06C0, 0x8C40, 0x6C00, 0x4620], color: 'green'  };
    var t = { size: 3, blocks: [0x0E40, 0x4C40, 0x4E00, 0x4640], color: 'purple' };
    var z = { size: 3, blocks: [0x0C60, 0x4C80, 0xC600, 0x2640], color: 'red'    };

    //------------------------------------------------
    // do the bit manipulation and iterate through each
    // occupied block (x,y) for a given piece
    //------------------------------------------------
    function eachblock(type, x, y, dir, fn) {
      var bit, result, row = 0, col = 0, blocks = type.blocks[dir];
      for(bit = 0x8000 ; bit > 0 ; bit = bit >> 1) {
        if (blocks & bit) {
          fn(x + col, y + row);
        }
        if (++col === 4) {
          col = 0;
          ++row;
        }
      }
    }

    //-----------------------------------------------------
    // check if a piece can fit into a position in the grid
    //-----------------------------------------------------
    function occupied(type, x, y, dir) {
      var result = false
      eachblock(type, x, y, dir, function(x, y) {
        if ((x < 0) || (x >= nx) || (y < 0) || (y >= ny) || getBlock(x,y))
          result = true;
      });
      return result;
    }

    function unoccupied(type, x, y, dir) {
      return !occupied(type, x, y, dir);
    }

    //-----------------------------------------
    // start with 4 instances of each piece and
    // pick randomly until the 'bag is empty'
    //-----------------------------------------
    var pieces = [];
    function randomPiece() {
      if (pieces.length == 0)
        pieces = [i,i,i,i,j,j,j,j,l,l,l,l,o,o,o,o,s,s,s,s,t,t,t,t,z,z,z,z];
      var type = pieces.splice(random(0, pieces.length-1), 1)[0];
      return { type: type, dir: DIR.UP, x: Math.round(random(0, nx - type.size)), y: 0 };
    }


    function play() { hide('start'); reset();          playing = true;  }
    function lose() { show('start'); setVisualScore(); playing = false; }

    function setVisualScore(n)      { vscore = n || score; invalidateScore(); }
    function setScore(n)            { score = n; setVisualScore(n);  }
    function addScore(n)            { score = score + n;   }
    function clearScore()           { setScore(0); }
    function clearRows()            { setRows(0); }
    function setRows(n)             { rows = n; step = Math.max(speed.min, speed.start - (speed.decrement*rows)); invalidateRows(); }
    function addRows(n)             { setRows(rows + n); }
    function getBlock(x,y)          { return (blocks && blocks[x] ? blocks[x][y] : null); }
    function setBlock(x,y,type)     { blocks[x] = blocks[x] || []; blocks[x][y] = type; invalidate(); }
    function clearBlocks()          { blocks = []; invalidate(); }
    function clearActions()         { actions = []; }
    function setCurrentPiece(piece) { current = piece || randomPiece(); invalidate();     }
    function setNextPiece(piece)    { next    = piece || randomPiece(); invalidateNext(); }

    function reset() {
      dt = 0;
      clearActions();
      clearBlocks();
      clearRows();
      clearScore();
      setCurrentPiece(next);
      setNextPiece();
    }

    function update(idt) {
      if (playing) {
        if (vscore < score)
          setVisualScore(vscore + 1);
        handle(actions.shift());
        dt = dt + idt;
        if (dt > step) {
          dt = dt - step;
          drop();
        }
      }
    }

    function handle(action) {
      switch(action) {
        case DIR.LEFT:  move(DIR.LEFT);  break;
        case DIR.RIGHT: move(DIR.RIGHT); break;
        case DIR.UP:    rotate();        break;
        case DIR.DOWN:  drop();          break;
      }
    }

    function move(dir) {
      var x = current.x, y = current.y;
      switch(dir) {
        case DIR.RIGHT: x = x + 1; break;
        case DIR.LEFT:  x = x - 1; break;
        case DIR.DOWN:  y = y + 1; break;
      }
      if (unoccupied(current.type, x, y, current.dir)) {
        current.x = x;
        current.y = y;
        invalidate();
        return true;
      }
      else {
        return false;
      }
    }

    function rotate() {
      var newdir = (current.dir == DIR.MAX ? DIR.MIN : current.dir + 1);
      if (unoccupied(current.type, current.x, current.y, newdir)) {
        current.dir = newdir;
        invalidate();
      }
    }

    function drop() {
      if (!move(DIR.DOWN)) {
        addScore(10);
        dropPiece();
        removeLines();
        setCurrentPiece(next);
        setNextPiece(randomPiece());
        clearActions();
        if (occupied(current.type, current.x, current.y, current.dir)) {
          lose();
        }
      }
    }

    function dropPiece() {
      eachblock(current.type, current.x, current.y, current.dir, function(x, y) {
        setBlock(x, y, current.type);
      });
    }

    function removeLines() {
      var x, y, complete, n = 0;
      for(y = ny ; y > 0 ; --y) {
        complete = true;
        for(x = 0 ; x < nx ; ++x) {
          if (!getBlock(x, y))
            complete = false;
        }
        if (complete) {
          removeLine(y);
          y = y + 1; // recheck same line
          n++;
        }
      }
      if (n > 0) {
        addRows(n);
        addScore(100*Math.pow(2,n-1)); // 1: 100, 2: 200, 3: 400, 4: 800
      }
    }

    function removeLine(n) {
      var x, y;
      for(y = n ; y >= 0 ; --y) {
        for(x = 0 ; x < nx ; ++x)
          setBlock(x, y, (y == 0) ? null : getBlock(x, y-1));
      }
    }


    function typeName(type) {
      return type ? ['I', 'J', 'L', 'O', 'S', 'T', 'Z'][[i,j,l,o,s,t,z].indexOf(type)] : null;
    }

    function pieceSnapshot(piece) {
      if (!piece) return null;
      var cells = [];
      eachblock(piece.type, piece.x, piece.y, piece.dir, function(x, y) {
        cells.push({ x: x, y: y });
      });
      return { type: typeName(piece.type), x: piece.x, y: piece.y, rotation: piece.dir, cells: cells };
    }

    return {
      start: play,
      tick: update,
      command: handle,
      snapshot: function() {
        var board = [];
        for (var y = 0; y < ny; y++) {
          var row = [];
          for (var x = 0; x < nx; x++) row.push(typeName(getBlock(x, y)));
          board.push(row);
        }
        return {
          width: nx, height: ny, board: board, active: pieceSnapshot(current),
          next: next ? pieceSnapshot({ type: next.type, x: 0, y: 0, dir: DIR.UP }) : null,
          score: score, lines: rows, gravityMs: step * 1000, playing: playing
        };
      }
    };
}));
