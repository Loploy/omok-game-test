
let matchOperationBusy = false;
let matchColorRenderKey = '';
let matchIntroTimer = null;
let shownMatchIntro = '';

function matchColor(id) {
  const color = match?.ready?.[id]?.color;
  return STONE_COLORS.includes(color) ? color : (match?.white === id ? 'white' : 'black');
}

function renderMatchColors() {
  const dialog = document.getElementById('matchColorDialog');
  const active = currentRoom && match?.state === 'choosing' && isReady();
  if (!active) { if (dialog.open) dialog.close(); matchColorRenderKey = ''; document.getElementById('matchStartError').textContent = ''; return; }
  const key = JSON.stringify([match.chooseStart, match.ready, nickMap]);
  if (key !== matchColorRenderKey) {
    matchColorRenderKey = key;
    const container = document.getElementById('matchColorChoices');
    container.replaceChildren();
    for (const color of STONE_COLORS) {
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'color-choice';
      button.style.backgroundColor = color;
      const owner = readyList().find(id => matchColor(id) === color);
      button.title = UI_TEXT.account.colors[color] + (owner ? ' · ' + seatName(owner) : '');
      button.disabled = !!owner && owner !== getMyId();
      button.setAttribute('aria-label', button.title);
      button.setAttribute('aria-pressed', String(color === matchColor(getMyId())));
      button.addEventListener('click', () => chooseMatchColor(color));
      const choice = document.createElement('div');
      choice.className = 'match-color-option';
      const name = document.createElement('span');
      name.textContent = owner ? seatName(owner) : '';
      choice.append(button, name);
      container.append(choice);
    }
  }
  document.getElementById('matchColorTime').textContent = Math.max(0, Math.ceil((CHOOSE_MS - (serverNow() - match.chooseStart)) / 1000)) + '초';
  if (!dialog.open) dialog.showModal();
}

function chooseMatchColor(color) {
  if (!matchRef || !STONE_COLORS.includes(color)) return;
  const me = getMyId();
  matchRef.transaction(current => {
    if (current?.state !== 'choosing' || !current.ready?.[me]) return;
    if (Object.entries(current.ready).some(([id, value]) => id !== me && value.color === color)) return;
    current.ready[me] = { ...current.ready[me], color };
    return current;
  });
}

function renderMatchIntro() {
  const panel = document.getElementById('matchIntro');
  if (!inPlay()) { panel.hidden = true; shownMatchIntro = ''; clearTimeout(matchIntroTimer); return; }
  const remaining = (match.startedAt || 0) + MATCH_INTRO_MS - serverNow();
  if (remaining <= 0) { panel.hidden = true; return; }
  const key = currentRoom + ':' + match.startedAt;
  if (shownMatchIntro === key) return;
  shownMatchIntro = key;
  panel.replaceChildren();
  for (const [id, order] of [[match.black, '선공'], [match.white, '후공']]) {
    const row = document.createElement('div');
    const dot = document.createElement('span');
    dot.className = 'intro-stone';
    dot.style.backgroundColor = matchColor(id);
    row.append(dot, document.createTextNode(seatName(id) + ' · ' + UI_TEXT.account.colors[matchColor(id)] + ' · ' + order));
    panel.append(row);
  }
  panel.hidden = false;
  clearTimeout(matchIntroTimer);
  matchIntroTimer = setTimeout(() => { panel.hidden = true; }, remaining);
}

  function rememberSession() {
    try {
      if (online) {
        sessionStorage.setItem(SESSION_ONLINE_KEY, '1');
        if (currentRoom) sessionStorage.setItem(SESSION_ROOM_KEY, currentRoom);
        else sessionStorage.removeItem(SESSION_ROOM_KEY);
      } else {
        sessionStorage.removeItem(SESSION_ONLINE_KEY);
        sessionStorage.removeItem(SESSION_ROOM_KEY);
      }
    } catch (e) {  }
  }

  function serverNow() {
    return Date.now() + timeOffset;
  }

  function readyList() {
    return match && match.ready ? Object.keys(match.ready) : [];
  }

  function isReady() {
    return readyList().indexOf(getMyId()) !== -1;
  }

  function toggleReady() {
    if (!matchRef) return;
    const me = getMyId();
    matchRef.transaction(current => {
      current = current || { state: 'idle' };
      if (!['idle', 'counting'].includes(current.state)) return;
      const ready = { ...(current.ready || {}) };
      if (ready[me]) delete ready[me];
      else {
        if (Object.keys(ready).length >= SEATS) return;
        const order = Math.max(0, ...Object.values(ready).map(value => value.order || 0)) + 1;
        const used = Object.values(ready).map(value => value.color);
        const preferred = accountProfile?.stoneColor || DEFAULT_STONE_COLOR;
        const color = used.includes(preferred) ? STONE_COLORS.find(value => !used.includes(value)) : preferred;
        ready[me] = { color, order };
      }
      const full = Object.keys(ready).length === SEATS;
      return { ...current, ready, state: full ? 'counting' : 'idle', countStart: full ? serverNow() : null };
    });
  }

  function orderedPlayers(ready) {
    return Object.keys(ready || {}).sort((a, b) => (ready[a].order || 0) - (ready[b].order || 0) || a.localeCompare(b));
  }

  function normalizeMatchColors(ready) {
    const used = new Set();
    for (const id of orderedPlayers(ready)) {
      const value = ready[id];
      const color = STONE_COLORS.includes(value.color) && !used.has(value.color)
        ? value.color : STONE_COLORS.find(candidate => !used.has(candidate));
      ready[id] = { ...value, color };
      used.add(color);
    }
  }

  function checkCountdown() {
    if (!matchRef || !match) return;
    if (match.state === 'counting' && serverNow() - match.countStart >= COUNTDOWN_MS) {
      matchRef.transaction(current => {
        if (current?.state !== 'counting' || serverNow() - current.countStart < COUNTDOWN_MS) return;
        if (Object.keys(current.ready || {}).length !== SEATS) return;
        normalizeMatchColors(current.ready);
        return { ...current, state: 'choosing', chooseStart: serverNow(), countStart: null };
      });
    }
    if (match.state === 'choosing' && serverNow() - match.chooseStart >= CHOOSE_MS) startPreparedMatch();
  }

  async function transactMatchRoom(ref, update) {
    const roomRef = ref.parent;
    let handler;
    try {
      await new Promise((resolve, reject) => {
        handler = snapshot => resolve(snapshot);
        roomRef.on('value', handler, reject);
      });
      if (ref !== matchRef) return null;
      return await roomRef.transaction(update, undefined, false);
    } finally {
      if (handler) roomRef.off('value', handler);
    }
  }

  async function startPreparedMatch() {
    if (!matchRef || matchOperationBusy) return;
    matchOperationBusy = true;
    const ref = matchRef;
    try {
    const result = await transactMatchRoom(ref, room => {
      const current = room?.match;
      if (current?.state !== 'choosing' || serverNow() - current.chooseStart < CHOOSE_MS) return;
      const players = orderedPlayers(current.ready);
      if (players.length !== SEATS) return;
      normalizeMatchColors(current.ready);
      if (room.game) room.game.moves = [];
      room.match = { ...current, state: 'playing', startedAt: serverNow(), turnStartedAt: serverNow() + MATCH_INTRO_MS, ply: 0, winner: null, result: null, chooseStart: null,
        black: players[0], white: players[1] };
      return room;
    });
    if (result && !result.committed && match?.state === 'choosing') {
      document.getElementById('matchStartError').textContent = '시작 조건 확인 실패: 상태=' + (result.snapshot.val()?.match?.state || '없음') + ', 준비=' + Object.keys(result.snapshot.val()?.match?.ready || {}).length;
    }
    } catch (error) {
      const message = '경기 시작 실패: ' + (error.code || error.message);
      roomMsg.textContent = message;
      document.getElementById('matchStartError').textContent = message;
    }
    finally { matchOperationBusy = false; }
  }

  function endMatch(result) {
    if (!matchRef || !match || match.state !== 'playing') return;
    return matchRef.transaction(current => current?.state === 'playing' ? { ...current, state: 'ended', result } : undefined);
  }

  function syncMatchEnd() {
    if (!inPlay() || !gameOver) return;

    if (match.turnStartedAt) return;
    const winner = winLine && board[winLine[0][0]][winLine[0][1]] === 1 ? match.black : match.white;
    endMatch(seatName(winner) + ' 승리!');
  }

  function resetMatch() {
    if (!matchRef) return;
    matchRef.update({
      state: 'idle',
      ready: null,
      countStart: null,
      chooser: null,
      chooseStart: null,
      black: null,
      white: null,
      result: null,
      winner: null,
      turnStartedAt: null,
      ply: null
    });
  }

  function checkSeatLeft() {
    if (!inPlay() || (nickMap[match.black] && nickMap[match.white])) {
      clearSeatTimer();
      return;
    }
    if (seatLeftTimer) return;

    seatLeftTimer = setTimeout(() => {
      seatLeftTimer = null;
      if (!inPlay()) return;
      if (nickMap[match.black] && nickMap[match.white]) return;
      const gone = nickMap[match.black] ? match.white : match.black;
      forfeitMatch(gone, '연결 종료').catch(() => { roomMsg.textContent = '이탈 처리 실패'; });
    }, SEAT_GRACE_MS);

    renderMatch();
  }

  function clearSeatTimer() {
    if (!seatLeftTimer) return;
    clearTimeout(seatLeftTimer);
    seatLeftTimer = null;
  }

  function inPlay() {
    return !!(online && currentRoom && match && match.state === 'playing');
  }

  function canPlace() {
    if (currentRoom && match && match.state !== 'idle' && match.state !== 'playing') return false;
    if (!inPlay()) return canEditBoardControls();
    if (serverNow() < (match.startedAt || 0) + MATCH_INTRO_MS) return false;
    if (match.turnStartedAt && serverNow() >= match.turnStartedAt + TURN_TIMEOUT_MS) return false;
    const me = getMyId();
    if (me !== match.black && me !== match.white) return false;
    return turn === (me === match.black ? 1 : 2);
  }

  function canEditBoardControls() {
    if (!online || !currentRoom || !match) return true;
    if (['playing', 'ended'].includes(match.state)) return false;
    const preparing = readyList().length > 0 || ['counting', 'choosing'].includes(match.state);
    return !preparing || isReady();
  }

  function updateControlLock() {

    const locked = !canEditBoardControls();
    document.getElementById("modeOptions").disabled = locked;
    warpSlider.disabled = locked;
    allowTangleCheck.disabled = locked;
    undoBtn.disabled = locked;
    resetBtn.disabled = locked;
    reshuffleBtn.disabled = locked;
    loadBoardBtn.disabled = locked || savedList.disabled;
    saveBoardBtn.disabled = false;
  }

  function seatName(id) {
    return id ? (nickMap[id] || '손님') : '';
  }

  function renderMatch() {
    updateHud();
    renderMatchColors();
    renderMatchIntro();
    renderMatchResult();
    document.getElementById('resignBtn').hidden = !inPlay() || ![match.black, match.white].includes(getMyId());
    const inRoom = !!currentRoom;
    matchPanel.hidden = !inRoom;
    if (!inRoom || !match) {
      stopCountTimer();
      updateControlLock();
      return;
    }
    updateControlLock();

    const list = readyList();
    const mine = isReady();
    const state = match.state;

    pickBlackBtn.hidden = true;
    pickWhiteBtn.hidden = true;

    matchOkBtn.hidden = state !== 'ended';

    readyBtn.hidden = state === 'choosing' || state === 'playing' || state === 'ended';

    if (state === 'choosing') {
      const left = Math.max(0, CHOOSE_MS - (serverNow() - (match.chooseStart || 0)));
      const sec = Math.ceil(left / 1000);
      matchState.textContent = '경기 색 선택 · ' + sec + '초';
      matchPlayers.textContent = '';
      startCountTimer();
      return;
    }

    if (state === 'playing') {
      matchState.textContent = '남은 시간 ' + Math.ceil(Math.max(0, (match.turnStartedAt || serverNow()) + TURN_TIMEOUT_MS - serverNow()) / 1000) + '초';
      matchPlayers.textContent = '선공 ' + seatName(match.black) + ' (' + UI_TEXT.account.colors[matchColor(match.black)] + ') · 후공 ' + seatName(match.white) + ' (' + UI_TEXT.account.colors[matchColor(match.white)] + ')';
      startCountTimer();
      return;
    }

    if (state === 'ended') {
      matchState.textContent = match.result || '대국 종료';
      matchPlayers.textContent = '선공 ' + seatName(match.black) + ' (' + UI_TEXT.account.colors[matchColor(match.black)] + ') · 후공 ' + seatName(match.white) + ' (' + UI_TEXT.account.colors[matchColor(match.white)] + ')';
      stopCountTimer();
      return;
    }

    if (state === 'counting') {
      const left = Math.max(0, COUNTDOWN_MS - (serverNow() - (match.countStart || 0)));
      matchState.textContent = '';
      matchState.appendChild(document.createTextNode('시작까지 '));
      const sec = document.createElement('span');
      sec.className = 'sec';
      sec.textContent = Math.ceil(left / 1000) + '초';
      matchState.appendChild(sec);
      readyBtn.textContent = '취소';
      readyBtn.disabled = !mine;
      startCountTimer();
    } else {
      matchState.textContent = '대기 중 · ' + list.length + '/' + SEATS + ' 준비';
      readyBtn.textContent = mine ? '취소' : '준비완료';

      readyBtn.disabled = !mine && list.length >= SEATS;
      stopCountTimer();
    }

    matchPlayers.textContent = list.length
      ? '준비: ' + list.map(id => seatName(id)).join(', ')
      : '';
  }

  function startCountTimer() {
    if (countTimer) return;
    countTimer = setInterval(() => {
      renderMatch();
      checkCountdown();
      checkTurnTimeout();
    }, MATCH_TICK_MS);
  }

  function stopCountTimer() {
    if (!countTimer) return;
    clearInterval(countTimer);
    countTimer = null;
  }

  readyBtn.addEventListener('click', toggleReady);
  document.getElementById('matchColorDialog').addEventListener('cancel', event => event.preventDefault());
  matchOkBtn.addEventListener('click', () => {
    resetMatch();

    resetGame(true);
    saveSession();
  });

async function forfeitMatch(loser, reason) {
  if (!matchRef) return;
  const startedAt = match?.startedAt;
  return matchRef.transaction(current => {
    if (current?.state !== 'playing' || current.startedAt !== startedAt || ![current.black, current.white].includes(loser)) return;
    const winner = current.black === loser ? current.white : current.black;
    return { ...current, state: 'ended', winner, result: seatName(winner) + ' 승리! (' + reason + ')' };
  }, undefined, false);
}

async function checkTurnTimeout() {
  if (!inPlay() || !match.turnStartedAt || serverNow() < match.turnStartedAt + TURN_TIMEOUT_MS || matchOperationBusy) return;
  matchOperationBusy = true;
  try {
    await matchRef.transaction(current => {
      if (current?.state !== 'playing' || !current.turnStartedAt || serverNow() < current.turnStartedAt + TURN_TIMEOUT_MS) return;
      const winner = current.ply % SEATS === 0 ? current.white : current.black;
      return { ...current, state: 'ended', winner, result: seatName(winner) + ' 승리! (시간 초과)' };
    }, undefined, false);
  } catch (error) { roomMsg.textContent = '시간 초과 처리 실패'; }
  finally { matchOperationBusy = false; }
}

function matchMoveWins(moves, i, j, player) {
  const cells = new Map(moves.map(move => [move[0] + ',' + move[1], move[2]]));
  return [[0,1],[1,0],[1,1],[1,-1]].some(([di,dj]) => {
    let count = 1;
    for (const sign of [-1,1]) {
      let x = i + di * sign, y = j + dj * sign;
      while (cells.get(x + ',' + y) === player) { count++; x += di * sign; y += dj * sign; }
    }
    return count >= WIN_LENGTH;
  });
}

async function submitMatchMove(i, j) {
  if (!matchRef || matchOperationBusy) return;
  const ref = matchRef, me = getMyId(), startedAt = match.startedAt;
  matchOperationBusy = true;
  try {
    await transactMatchRoom(ref, room => {
      const current = room?.match;
      if (current?.state !== 'playing' || current.startedAt !== startedAt) return;
      const player = (current.ply || 0) % SEATS + 1;
      if ((player === 1 ? current.black : current.white) !== me) return;
      const now = serverNow();
      if (now < current.startedAt + MATCH_INTRO_MS || now >= current.turnStartedAt + TURN_TIMEOUT_MS) return;
      const state = normalizeState(room.game);
      if (!state || state.moves.some(move => move[0] === i && move[1] === j)) return;
      state.moves.push([i, j, player, current.ready[me].color, me]);
      room.game = { ...room.game, moves: state.moves };
      current.ply = state.moves.length;
      current.turnStartedAt = now;
      if (matchMoveWins(state.moves, i, j, player)) {
        current.state = 'ended'; current.winner = me; current.result = seatName(me) + ' 승리!';
      }
      return room;
    });
  } catch (error) { roomMsg.textContent = '착수 실패: ' + (error.code || error.message); }
  finally { matchOperationBusy = false; }
}

function renderMatchResult() {
  const dialog = document.getElementById('matchResultDialog');
  if (!currentRoom || match?.state !== 'ended') { if (dialog.open) dialog.close(); return; }
  document.getElementById('matchResultText').textContent = match.result || '경기 종료';
  if (!dialog.open) dialog.showModal();
}
document.getElementById('resignBtn').addEventListener('click', () => {
  if (inPlay()) forfeitMatch(getMyId(), '포기').catch(() => { roomMsg.textContent = '포기 처리 실패'; });
});
document.getElementById('matchResultOkBtn').addEventListener('click', () => matchOkBtn.click());
document.getElementById('matchResultDialog').addEventListener('cancel', event => event.preventDefault());
