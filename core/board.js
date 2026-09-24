
const WIN_LENGTH = 5;

async function recolorMyStones(color) {
  const me = getMyId();
  const seat = currentRoom && match && ['playing', 'ended'].includes(match.state)
    ? (match.black === me ? 1 : match.white === me ? 2 : null) : null;

  const recolor = moves => moves.map(move => {
    const mine = move[4] === me || move[2] === 'user:' + me
      || (!move[4] && seat !== null && move[2] === seat);
    return mine ? [move[0], move[1], move[2], color, me] : move;
  });
  if (online && gameRef) {
    const result = await gameRef.transaction(raw => {
      const state = normalizeState(raw);
      if (!state) return;
      return { ...raw, moves: recolor(state.moves) };
    });
    if (result.committed) applyRemote(normalizeState(result.snapshot.val()));
  } else {
    const state = currentState();
    state.moves = recolor(state.moves);
    applyRemote(state);
  }
  if (seat !== null && matchRef) {
    await matchRef.child('ready/' + me).set({ color });
  }
}

  function resetGame(keepGrid) {
    board = Array.from({ length: N }, () => Array(N).fill(0));
    turn = 1;
    gameOver = false;
    lastMove = null;
    winLine = null;
    moveHistory = [];
    msg.textContent = '';
    if (!keepGrid) generateGrid(Date.now() % SEED_TIME_MODULUS + Math.floor(Math.random() * SEED_RANDOM_RANGE), intensity);
    updateHud();
    draw();
  }

  function updateHud() {
    turnText.parentElement.hidden = !inPlay();
    turnDot.className = 'dot';
    turnDot.style.backgroundColor = inPlay() ? matchColor(turn === 1 ? match.black : match.white) : '';
    turnText.textContent = (inPlay() ? seatName(turn === 1 ? match.black : match.white) : '') + ' 차례';
  }

  function strokeSmoothPath(points, color, width) {
    if (points.length < 2) return;
    ctx.beginPath();
    ctx.moveTo(points[0].x, points[0].y);
    if (points.length === 2) {
      ctx.lineTo(points[1].x, points[1].y);
    } else {
      for (let k = 0; k < points.length - 1; k++) {
        const p0 = points[k - 1] || points[k];
        const p1 = points[k];
        const p2 = points[k + 1];
        const p3 = points[k + 2] || p2;
        const c1x = p1.x + (p2.x - p0.x) / 6;
        const c1y = p1.y + (p2.y - p0.y) / 6;
        const c2x = p2.x - (p3.x - p1.x) / 6;
        const c2y = p2.y - (p3.y - p1.y) / 6;
        ctx.bezierCurveTo(c1x, c1y, c2x, c2y, p2.x, p2.y);
      }
    }
    ctx.strokeStyle = color;
    ctx.lineWidth = width;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.stroke();
  }

  function draw() {
    ctx.clearRect(0, 0, SIZE, SIZE);

    for (let j = 0; j < N; j++) {
      const pts = [];
      for (let i = 0; i < N; i++) pts.push(grid[i][j]);
      strokeSmoothPath(pts, 'rgba(44,57,104,0.55)', 1.6);
    }

    for (let i = 0; i < N; i++) {
      const pts = [];
      for (let j = 0; j < N; j++) pts.push(grid[i][j]);
      strokeSmoothPath(pts, 'rgba(44,57,104,0.75)', 1.8);
    }

    if (winLine) {
      const pts = winLine.map(([i, j]) => grid[i][j]);
      ctx.beginPath();
      ctx.moveTo(pts[0].x, pts[0].y);
      for (let k = 1; k < pts.length; k++) ctx.lineTo(pts[k].x, pts[k].y);
      ctx.strokeStyle = 'rgba(178,59,59,0.85)';
      ctx.lineWidth = 5;
      ctx.lineCap = 'round';
      ctx.stroke();
    }

    for (let i = 0; i < N; i++) {
      for (let j = 0; j < N; j++) {
        const p = grid[i][j];
        const v = board[i][j];
        if (v === 0) {
          ctx.beginPath();
          ctx.arc(p.x, p.y, 2.4, 0, Math.PI * 2);
          ctx.fillStyle = 'rgba(44,57,104,0.45)';
          ctx.fill();
        } else {
          const r = SPACING * 0.27;
          ctx.beginPath();
          ctx.arc(p.x, p.y, r, 0, Math.PI * 2);
          const stone = moveHistory.find(move => move.i === i && move.j === j);
          const color = stone?.color || (v === 1 ? 'black' : 'white');
          if (color !== 'black' && color !== 'white') {
            ctx.fillStyle = color;
          } else if (color === 'black') {
            const g = ctx.createRadialGradient(p.x - r*0.3, p.y - r*0.3, r*0.1, p.x, p.y, r);
            g.addColorStop(0, '#4a4c55');
            g.addColorStop(1, '#0f1013');
            ctx.fillStyle = g;
          } else {
            const g = ctx.createRadialGradient(p.x - r*0.3, p.y - r*0.3, r*0.1, p.x, p.y, r);
            g.addColorStop(0, '#ffffff');
            g.addColorStop(1, '#dedbd2');
            ctx.fillStyle = g;
          }
          ctx.fill();
          ctx.lineWidth = 1;
          ctx.strokeStyle = 'rgba(0,0,0,0.25)';
          ctx.stroke();

          if (lastMove && lastMove[0] === i && lastMove[1] === j) {
            ctx.beginPath();
            ctx.arc(p.x, p.y, r * 0.4, 0, Math.PI * 2);
            ctx.strokeStyle = v === 1 ? '#ddd' : '#b23b3b';
            ctx.lineWidth = 1.5;
            ctx.stroke();
          }
        }
      }
    }
  }

  function findNearestNode(x, y) {
    let best = null, bestD = Infinity;
    for (let i = 0; i < N; i++) {
      for (let j = 0; j < N; j++) {
        const p = grid[i][j];
        const d = Math.hypot(p.x - x, p.y - y);
        if (d < bestD) { bestD = d; best = [i, j]; }
      }
    }
    if (bestD <= HIT_R) return best;
    return null;
  }

  function sameStoneGroup(i, j, player, color) {
    if (typeof player === 'number') return board[i][j] === player;
    return board[i][j] !== 0 && moveHistory.some(move => move.i === i && move.j === j && move.color === color);
  }

  function checkWin(i, j, player, color) {
    const dirs = [[0,1],[1,0],[1,1],[1,-1]];
    for (const [di, dj] of dirs) {
      const line = [[i, j]];
      let ci = i + di, cj = j + dj;
      while (ci >= 0 && ci < N && cj >= 0 && cj < N && sameStoneGroup(ci, cj, player, color)) {
        line.push([ci, cj]); ci += di; cj += dj;
      }
      ci = i - di; cj = j - dj;
      while (ci >= 0 && ci < N && cj >= 0 && cj < N && sameStoneGroup(ci, cj, player, color)) {
        line.unshift([ci, cj]); ci -= di; cj -= dj;
      }
      if (line.length >= WIN_LENGTH) return line;
    }
    return null;
  }

  function placeStone(i, j, player = turn, color = player === 1 ? 'black' : 'white', owner = '', replay = false) {
    if ((!replay && gameOver) || board[i][j] !== 0) return false;
    board[i][j] = player;
    lastMove = [i, j];
    moveHistory.push({ i, j, player, color, owner });
    const win = checkWin(i, j, player, color);
    if (win) {
      gameOver = true;
      winLine = win;
      msg.textContent = (typeof player === 'number' ? (player === 1 ? '선공' : '후공') : UI_TEXT.account.colors[color]) + ' 승리!';
    } else {
      if (typeof player === 'number') turn = player === 1 ? 2 : 1;
      updateHud();
    }
    return true;
  }

  function handlePick(clientX, clientY) {
    if (gameOver) return;
    if (!canPlace()) return;
    const rect = canvas.getBoundingClientRect();
    const scaleX = SIZE / rect.width;
    const scaleY = SIZE / rect.height;
    const x = (clientX - rect.left) * scaleX;
    const y = (clientY - rect.top) * scaleY;
    const node = findNearestNode(x, y);
    if (!node) return;
    const player = inPlay() ? turn : 'user:' + getMyId();
    const color = inPlay() ? matchColor(getMyId()) : (accountProfile?.stoneColor || DEFAULT_STONE_COLOR);
    if (!placeStone(node[0], node[1], player, color, getMyId())) return;
    draw();
    saveSession();
    syncMatchEnd();
  }

  function undoMove() {
    if (moveHistory.length === 0) return;
    if (inPlay()) return;
    const last = moveHistory.pop();
    board[last.i][last.j] = 0;
    if (typeof last.player === 'number') turn = last.player;
    gameOver = false;
    winLine = null;
    msg.textContent = '';
    if (moveHistory.length > 0) {
      const prev = moveHistory[moveHistory.length - 1];
      lastMove = [prev.i, prev.j];
    } else {
      lastMove = null;
    }
    updateHud();
    draw();
    saveSession();
  }
