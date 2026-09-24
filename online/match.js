
const MATCH_INTRO_MS = 3000;
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
  if (!active) { if (dialog.open) dialog.close(); matchColorRenderKey = ''; return; }
  const key = match.chooseStart + ':' + matchColor(getMyId());
  if (key !== matchColorRenderKey) {
    matchColorRenderKey = key;
    const container = document.getElementById('matchColorChoices');
    container.replaceChildren();
    for (const color of STONE_COLORS) {
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'color-choice';
      button.style.backgroundColor = color;
      button.title = UI_TEXT.account.colors[color];
      button.setAttribute('aria-label', button.title);
      button.setAttribute('aria-pressed', String(color === matchColor(getMyId())));
      button.addEventListener('click', () => chooseMatchColor(color));
      container.append(button);
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
    current.ready[me] = { color };
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

    matchRef.child('ready').transaction(cur => {
      cur = cur || {};
      if (cur[me]) {
        delete cur[me];
        return cur;
      }
      if (Object.keys(cur).length >= SEATS) return;
      cur[me] = { color: accountProfile?.stoneColor || DEFAULT_STONE_COLOR };
      return cur;
    }, (err, committed, snap) => {
      if (err || !committed) return;
      const now = snap.val() || {};
      const n = Object.keys(now).length;
      if (n >= SEATS) {

        matchRef.update({ state: 'counting', countStart: serverNow() });
      } else {

        matchRef.update({ state: 'idle', countStart: null });
      }
    });
  }

  function checkCountdown() {
    if (!matchRef || !match) return;
    if (match.state === 'counting' && serverNow() - match.countStart >= COUNTDOWN_MS) {
      matchRef.transaction(current => {
        if (current?.state !== 'counting' || serverNow() - current.countStart < COUNTDOWN_MS) return;
        if (Object.keys(current.ready || {}).length !== SEATS) return;
        return { ...current, state: 'choosing', chooseStart: serverNow(), countStart: null };
      });
    }
    if (match.state === 'choosing' && serverNow() - match.chooseStart >= CHOOSE_MS) startRandomMatch();
  }

  function startRandomMatch() {
    if (!matchRef) return;
    const firstIndex = Math.floor(Math.random() * SEATS);
    matchRef.parent.transaction(room => {
      const current = room?.match;
      if (current?.state !== 'choosing' || serverNow() - current.chooseStart < CHOOSE_MS) return;
      const players = Object.keys(current.ready || {});
      if (players.length !== SEATS) return;
      if (room.game) room.game.moves = [];
      room.match = { ...current, state: 'playing', startedAt: serverNow(), chooseStart: null,
        black: players[firstIndex], white: players[(firstIndex + 1) % SEATS] };
      return room;
    });
  }

  function endMatch(result) {
    if (!matchRef || !match || match.state !== 'playing') return;
    matchRef.update({ state: 'ended', result: result });
  }

  function syncMatchEnd() {
    if (!inPlay() || !gameOver) return;

    endMatch(msg.textContent || '대국 종료');
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
      result: null
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
      const gone = nickMap[match.black] ? seatName(match.white) : seatName(match.black);
      endMatch((gone || '대국자') + ' 님이 나감');
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
    if (!inPlay()) return true;
    if (serverNow() < (match.startedAt || 0) + MATCH_INTRO_MS) return false;
    const me = getMyId();
    if (me !== match.black && me !== match.white) return false;
    return turn === (me === match.black ? 1 : 2);
  }

  function updateControlLock() {

    const locked = inPlay() || (online && currentRoom && match && match.state === 'ended');
    document.getElementById("modeOptions").disabled = locked;
    warpSlider.disabled = locked;
    allowTangleCheck.disabled = locked;
    undoBtn.disabled = locked;
    resetBtn.disabled = locked;
    reshuffleBtn.disabled = locked;
    loadBoardBtn.disabled = locked;
    saveBoardBtn.disabled = false;
  }

  function seatName(id) {
    return id ? (nickMap[id] || '손님') : '';
  }

  function renderMatch() {
    updateHud();
    renderMatchColors();
    renderMatchIntro();
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
      matchState.textContent = seatLeftTimer ? '상대 접속 끊김 — 기다리는 중' : '대국 중';
      matchPlayers.textContent = '선공 ' + seatName(match.black) + ' (' + UI_TEXT.account.colors[matchColor(match.black)] + ') · 후공 ' + seatName(match.white) + ' (' + UI_TEXT.account.colors[matchColor(match.white)] + ')';
      stopCountTimer();
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
    }, 200);
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

