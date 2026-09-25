

  function syncRoomWatchers() {
    const db = ensureDb();
    if (!db || !online || currentRoom) { clearRoomWatchers(); return; }

    for (const code of Object.keys(roomWatchers)) {
      if (rooms[code]) continue;
      roomWatchers[code].ref.off('value', roomWatchers[code].handler);
      delete roomWatchers[code];
      delete roomCounts[code];
    }

    for (const code of Object.keys(rooms)) {
      if (roomWatchers[code]) continue;
      const ref = db.ref(ROOMS_PATH + '/' + code + '/' + USERS_PATH);
      const handler = ref.on('value', snap => {
        roomCounts[code] = snap.exists() ? Object.keys(snap.val()).length : 0;
        renderRoomList();

      }, () => {  });
      roomWatchers[code] = { ref: ref, handler: handler };
    }
  }

  function clearRoomWatchers() {
    for (const code of Object.keys(roomWatchers)) {
      roomWatchers[code].ref.off('value', roomWatchers[code].handler);
    }
    roomWatchers = {};
    roomCounts = {};
  }

  function clampMax(v) {
    const n = Math.floor(Number(v));
    if (!Number.isFinite(n)) return ROOM_MAX_DEFAULT;
    return Math.min(ROOM_MAX_LIMIT, Math.max(SEATS, n));
  }

  function makeRoomCode() {
    let out = '';
    for (let i = 0; i < CODE_LEN; i++) {
      out += CODE_CHARS[Math.floor(Math.random() * CODE_CHARS.length)];
    }
    return out;
  }

  function inviteLink() {
    return location.origin + location.pathname + '?room=' + currentRoom;
  }

  function updateRoomUI() {
    const inRoom = !!currentRoom;
    roomBrowse.hidden = inRoom;
    roomInvite.hidden = !inRoom;
    roomMaxRow.hidden = !isRoomHost();
    roomLeaveBtn.hidden = !inRoom;
    if (inRoom) {
      const info = roomMeta || rooms[currentRoom];
      const title = info ? info.title : '이름 없는 방';
      const max = info ? info.max : ROOM_MAX_DEFAULT;

      const count = Object.keys(nickMap).length;
      roomWhere.textContent = title + ' (' + currentRoom + ') · ' + count + '/' + max + '명';

      if (document.activeElement !== roomMaxInput) roomMaxInput.value = max;
      roomInviteLink.value = inviteLink();
    } else {
      roomWhere.textContent = '로비';
    }
  }

  function renderRoomList() {
    roomListEl.textContent = '';
    const codes = Object.keys(rooms).filter(c => c !== currentRoom);
    if (codes.length === 0) {
      const empty = document.createElement('div');
      empty.className = 'room-empty';
      empty.textContent = '만들어진 방이 없음';
      roomListEl.appendChild(empty);
      return;
    }
    for (const code of codes) {
      const btn = document.createElement('button');
      btn.className = 'room-item';
      btn.addEventListener('click', () => enterRoom(code));

      const name = document.createElement('span');
      name.className = 'name';
      name.textContent = rooms[code].title;

      const countEl = document.createElement('span');
      countEl.className = 'count';
      countEl.textContent = (roomCounts[code] || 0) + '/' + rooms[code].max + '명';

      const codeEl = document.createElement('span');
      codeEl.className = 'code';
      codeEl.textContent = code;

      btn.appendChild(name);
      btn.appendChild(countEl);
      btn.appendChild(codeEl);
      roomListEl.appendChild(btn);
    }
  }

  async function goPlace(code) {
    if (currentRoom === code) return;
    if (inPlay() && [match.black, match.white].includes(getMyId())) {
      try { await forfeitMatch(getMyId(), '퇴장 포기'); }
      catch (error) { roomMsg.textContent = '포기 처리 실패. 다시 시도해 주세요'; return; }
    }
    if (currentRoom) {
      try { await leaveManagedRoom(currentRoom); }
      catch (error) { roomMsg.textContent = '퇴장 처리 실패'; return; }
    }
    detachPlace();
    currentRoom = code;
    roomMsg.textContent = '';
    rememberSession();
    attachPlace();
    syncRoomWatchers();
    renderRoomList();
  }

  async function enterRoom(code) {
    code = (code || '').toUpperCase().trim();
    if (code.length !== CODE_LEN) { roomMsg.textContent = '코드는 ' + CODE_LEN + '글자임'; return; }
    if (currentRoom === code) return;
    try {
      await joinManagedRoom(code);
      roomCodeInput.value = '';
      await goPlace(code);
    } catch (error) { roomMsg.textContent = error.message || '입장 실패'; }
  }

  async function createRoom() {
    if (!ensureDb()) return;
    const title = roomTitleInput.value.trim().slice(0, 20) || '이름 없는 방';
    const max = clampMax(roomMaxNew.value);
    for (let attempt = 0; attempt < 5; attempt++) {
      const code = makeRoomCode();
      try {
        const result = await changeRoom(code, room => room ? undefined : {
          meta: { title, max, created: serverNow(), host: getMyId(), public: true, locked: false, allowControls: true }
        });
        if (!result.committed) continue;
        await joinManagedRoom(code);
        roomTitleInput.value = '';
        await goPlace(code);
        return;
      } catch (error) { roomMsg.textContent = '방 생성 실패'; return; }
    }
    roomMsg.textContent = '방 코드를 만들지 못함';
  }

  roomCreateBtn.addEventListener('click', createRoom);
  roomJoinBtn.addEventListener('click', () => enterRoom(roomCodeInput.value));
  roomCodeInput.addEventListener('keydown', e => {
    if (e.key === 'Enter') { e.preventDefault(); enterRoom(roomCodeInput.value); }
  });
  roomTitleInput.addEventListener('keydown', e => {
    if (e.key === 'Enter') { e.preventDefault(); createRoom(); }
  });
  roomLeaveBtn.addEventListener('click', () => goPlace(null));

  roomCopyBtn.addEventListener('click', () => {
    roomInviteLink.select();

    if (navigator.clipboard) {
      navigator.clipboard.writeText(roomInviteLink.value)
        .then(() => { roomMsg.textContent = '링크 복사됨'; })
        .catch(() => { roomMsg.textContent = '직접 복사해주세요'; });
    } else {
      roomMsg.textContent = '직접 복사해주세요';
    }
  });

