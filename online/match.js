

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
      cur[me] = true;
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

    if (match.state === 'counting') {
      const left = COUNTDOWN_MS - (serverNow() - (match.countStart || 0));
      if (left > 0) return;

      const list = readyList();
      if (list.length < SEATS) { matchRef.update({ state: 'idle', countStart: null }); return; }
      const prev = match.lastChooser;
      const next = (prev && list.indexOf(prev) !== -1)
        ? list[(list.indexOf(prev) + 1) % list.length]
        : list[Math.floor(Math.random() * list.length)];
      matchRef.update({
        state: 'choosing',
        countStart: null,
        chooser: next,
        chooseStart: serverNow()
      });
      return;
    }

    if (match.state === 'choosing') {
      const left = CHOOSE_MS - (serverNow() - (match.chooseStart || 0));

      if (left <= 0) pickColor(1, true);
    }
  }

  function pickColor(color, auto) {
    if (!matchRef || !match || match.state !== 'choosing') return;
    const chooser = match.chooser;
    if (!auto && chooser !== getMyId()) return;

    const list = readyList();
    const other = list.filter(id => id !== chooser)[0] || '';
    if (!chooser || !other) {
      matchRef.update({ state: 'idle', chooser: null, chooseStart: null });
      return;
    }

    if (gameRef) gameRef.child('moves').remove().catch(() => {  });

    matchRef.update({
      state: 'playing',
      chooseStart: null,
      black: color === 1 ? chooser : other,
      white: color === 1 ? other : chooser,
      lastChooser: chooser
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

    const iChoose = state === 'choosing' && match.chooser === getMyId();
    pickBlackBtn.hidden = !iChoose;
    pickWhiteBtn.hidden = !iChoose;

    matchOkBtn.hidden = state !== 'ended';

    readyBtn.hidden = state === 'choosing' || state === 'playing' || state === 'ended';

    if (state === 'choosing') {
      const left = Math.max(0, CHOOSE_MS - (serverNow() - (match.chooseStart || 0)));
      const sec = Math.ceil(left / 1000);
      matchState.textContent = iChoose
        ? '색을 고르세요 · ' + sec + '초'
        : seatName(match.chooser) + ' 님이 색을 고르는 중 · ' + sec + '초';
      matchPlayers.textContent = '';
      startCountTimer();
      return;
    }

    if (state === 'playing') {
      matchState.textContent = seatLeftTimer ? '상대 접속 끊김 — 기다리는 중' : '대국 중';
      matchPlayers.textContent = '흑 ' + seatName(match.black) + ' · 백 ' + seatName(match.white);
      stopCountTimer();
      return;
    }

    if (state === 'ended') {
      matchState.textContent = match.result || '대국 종료';
      matchPlayers.textContent = '흑 ' + seatName(match.black) + ' · 백 ' + seatName(match.white);
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
  pickBlackBtn.addEventListener('click', () => pickColor(1));
  pickWhiteBtn.addEventListener('click', () => pickColor(2));
  matchOkBtn.addEventListener('click', () => {
    resetMatch();

    resetGame(true);
    saveSession();
  });

