

  function sigOf(st) {
    return [
      (st.modes || []).join(","),
      st.seed,
      Math.round(st.intensity * 100),
      st.allowTangle ? 1 : 0,
      JSON.stringify(st.moves)
    ].join('|');
  }

  function currentState() {
    return {
      seed,
      modes: selectedModes,
      intensity,
      allowTangle: allowTangleCheck.checked,
      moves: moveHistory.map(m => [m.i, m.j, m.player, m.color, m.owner || ""])
    };
  }

  function normalizeState(raw) {
    if (!raw || typeof raw.seed !== 'number' || typeof raw.intensity !== 'number') return null;
    const moves = [];
    const list = Array.isArray(raw.moves) ? raw.moves : [];
    for (const mv of list) {
      if (!Array.isArray(mv)) continue;
      const [i, j] = mv;
      if (!Number.isInteger(i) || !Number.isInteger(j)) continue;
      if (i < 0 || i >= N || j < 0 || j >= N) continue;
      const player = mv[2] === 1 || mv[2] === 2 || (typeof mv[2] === 'string' && mv[2].startsWith('user:') && mv[2].length <= 160) ? mv[2] : (moves.length % 2 + 1);
      const color = STONE_COLORS.includes(mv[3]) ? mv[3] : (player === 1 ? 'black' : 'white');
      const owner = typeof mv[4] === 'string' && mv[4].length <= 160 ? mv[4] : (typeof player === 'string' ? player.slice(5) : '');
      moves.push([i, j, player, color, owner]);
    }
    return { seed: raw.seed, modes: normalizeModes(raw.modes, raw.intensity), intensity: raw.intensity, allowTangle: !!raw.allowTangle, moves };
  }

  function pushState() {
    if (!online || !gameRef || applyingRemote) return;
    const st = currentState();
    lastSig = sigOf(st);
    gameRef.set(st).catch(() => setOnlineStatus('전송 실패'));
  }

  function applyRemote(st) {
    selectedModes = normalizeModes(st.modes, st.intensity);
    renderModes();
    applyingRemote = true;
    try {

      if (st.seed !== seed || st.intensity !== intensity || st.allowTangle !== allowTangleCheck.checked) {
        allowTangleCheck.checked = st.allowTangle;
        warpSlider.value = Math.round(st.intensity * 100);
        warpVal.textContent = warpSlider.value + '%';
        generateGrid(st.seed, st.intensity);
      }
      resetGame(true);
      for (const mv of st.moves) placeStone(mv[0], mv[1], mv[2], mv[3], mv[4], true);
      updateHud();
      draw();
      saveSession();
    } finally {
      applyingRemote = false;
    }
    syncMatchEnd();
  }

  function placePath(sub) {
    return (currentRoom ? ROOMS_PATH + '/' + currentRoom : LOBBY_PATH) + '/' + sub;
  }

  function attachPlace() {
    const db = ensureDb();
    if (!db) return;

    gameRef = db.ref(placePath(GAME_PATH));
    gameHandler = gameRef.on('value', snap => {
      const st = normalizeState(snap.val());
      if (!st) {

        resetGame(true);
        saveSession();
        return;
      }
      const sig = sigOf(st);
      if (sig === lastSig) return;
      lastSig = sig;
      applyRemote(st);
    }, () => setOnlineStatus('수신 오류'));

    clearChatLog();
    setChatEnabled(true);

    usersRef = db.ref(placePath(USERS_PATH));
    usersHandler = usersRef.on('value', snap => {
      const raw = snap.val() || {};
      const next = {};
      for (const id of Object.keys(raw)) {
        const n = raw[id] && raw[id].name;
        if (typeof n === 'string' && n.trim()) next[id] = n.slice(0, 12);
      }
      nickMap = next;
      refreshChatNames();
      renderMatch();
      checkSeatLeft();

      updateRoomUI();

      const myName = nickMap[getMyId()];
      if (myName && myName !== nickInput.value) {
        nickInput.value = myName;
        try { if (!accountUser) localStorage.setItem(NICK_KEY, myName); } catch (e) {  }
      }
    }, () => {  });

    const meRef = usersRef.child(getMyId());
    meRef.onDisconnect().remove();
    publishNick();

    chatRef = db.ref(placePath(CHAT_PATH));
    chatQuery = chatRef.limitToLast(CHAT_LIMIT);
    chatHandler = chatQuery.on('child_added', snap => {
      const m = snap.val();
      if (!m || typeof m.text !== 'string') return;

      const fallback = (typeof m.name === 'string' && m.name.trim()) ? m.name.slice(0, 12) : '';
      appendChatLine(snap.key, m.from, fallback, m.text.slice(0, 200));
    }, () => setOnlineStatus('채팅 수신 오류'));

    chatRemoveHandler = chatQuery.on('child_removed', snap => {
      const box = chatLog.querySelector('.chat-msg[data-key="' + snap.key + '"]');
      if (box) box.remove();
      if (!chatLog.querySelector('.chat-msg')) {
        chatEmpty.hidden = false;
        lastChatFrom = null;
      }
    });

    if (currentRoom) {
      matchRef = db.ref(placePath(MATCH_PATH));
      matchHandler = matchRef.on('value', snap => {
        const raw = snap.val() || {};
        match = {
          state: typeof raw.state === 'string' ? raw.state : 'idle',
          ready: raw.ready || {},
          countStart: typeof raw.countStart === 'number' ? raw.countStart : 0,
          chooser: typeof raw.chooser === 'string' ? raw.chooser : '',
          chooseStart: typeof raw.chooseStart === 'number' ? raw.chooseStart : 0,
          black: typeof raw.black === 'string' ? raw.black : '',
          white: typeof raw.white === 'string' ? raw.white : '',
          lastChooser: typeof raw.lastChooser === 'string' ? raw.lastChooser : '',
          result: typeof raw.result === 'string' ? raw.result : ''
        };
        renderMatch();
      }, () => { roomMsg.textContent = '대국 상태를 받지 못함'; });
    } else {
      match = null;
      renderMatch();
    }

    updateRoomUI();
  }

  function detachPlace() {
    if (usersRef) {
      const meRef = usersRef.child(getMyId());
      meRef.onDisconnect().cancel();
      meRef.remove().catch(() => {  });
    }

    if (matchRef && isReady()) {
      const me = getMyId();
      matchRef.child('ready/' + me).remove().catch(() => {  });
      matchRef.update({ state: 'idle', countStart: null }).catch(() => {  });
    }
    if (matchRef && matchHandler) matchRef.off('value', matchHandler);
    matchRef = matchHandler = null;
    match = null;
    stopCountTimer();
    clearSeatTimer();
    renderMatch();

    if (gameRef && gameHandler) gameRef.off('value', gameHandler);
    if (usersRef && usersHandler) usersRef.off('value', usersHandler);
    if (chatQuery && chatHandler) chatQuery.off('child_added', chatHandler);
    if (chatQuery && chatRemoveHandler) chatQuery.off('child_removed', chatRemoveHandler);
    gameRef = gameHandler = null;
    usersRef = usersHandler = null;
    chatRef = chatQuery = chatHandler = chatRemoveHandler = null;
    nickMap = {};
    lastSig = null;
    clearChatLog();
  }

  function connectOnline() {

    if (typeof firebase === 'undefined') {
      setOnlineStatus('연결 불가 (오프라인?)');
      onlineCheck.checked = false;
      return;
    }
    const db = ensureDb();
    if (!db) {
      setOnlineStatus('연결 실패');
      onlineCheck.checked = false;
      return;
    }

    online = true;
    setOnlineStatus('연결 중…');
    roomPanel.hidden = false;

    timeOffsetRef = db.ref('.info/serverTimeOffset');
    timeOffsetHandler = timeOffsetRef.on('value', snap => {
      timeOffset = typeof snap.val() === 'number' ? snap.val() : 0;
    });

    connRef = db.ref('.info/connected');
    connHandler = connRef.on('value', snap => {
      if (!online) return;
      setOnlineStatus(snap.val() ? '연결됨' : '끊김 — 재접속 중…');
    });

    roomListRef = db.ref(ROOM_LIST_PATH);
    roomListHandler = roomListRef.on('value', snap => {
      rooms = {};
      const raw = snap.val() || {};
      for (const code of Object.keys(raw)) {
        const r = raw[code] || {};
        rooms[code] = {
          title: (typeof r.title === 'string' && r.title.trim()) ? r.title.slice(0, 20) : '이름 없는 방',
          created: typeof r.created === 'number' ? r.created : 0,
          max: clampMax(r.max)
        };
      }
      syncRoomWatchers();
      renderRoomList();
      updateRoomUI();
    }, () => { roomMsg.textContent = '방 목록을 받지 못함'; });

    let saved = null;
    try { saved = sessionStorage.getItem(SESSION_ROOM_KEY); } catch (e) {  }
    const wanted = new URLSearchParams(location.search).get('room') || saved;

    currentRoom = null;
    rememberSession();
    attachPlace();
    syncRoomWatchers();

    if (wanted) enterRoom(wanted);
  }

  function disconnectOnline() {
    detachPlace();
    if (connRef && connHandler) connRef.off('value', connHandler);
    if (roomListRef && roomListHandler) roomListRef.off('value', roomListHandler);
    if (timeOffsetRef && timeOffsetHandler) timeOffsetRef.off('value', timeOffsetHandler);
    timeOffsetRef = timeOffsetHandler = null;
    connRef = connHandler = null;
    roomListRef = roomListHandler = null;
    online = false;
    currentRoom = null;
    clearRoomWatchers();
    rooms = {};
    roomPanel.hidden = true;
    setOnlineStatus('꺼짐');
    setChatEnabled(false);
    rememberSession();
  }

