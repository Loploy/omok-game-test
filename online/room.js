

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
        removeIfEmpty(code);
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

  function removeIfEmpty(code) {
    if (!online || currentRoom) return;
    if (roomCounts[code] !== 0) return;
    const info = rooms[code];

    if (!info || Date.now() - info.created < ROOM_GRACE_MS) return;
    const db = ensureDb();
    if (!db) return;
    db.ref(ROOM_LIST_PATH + '/' + code).remove().catch(() => {  });
    db.ref(ROOMS_PATH + '/' + code).remove().catch(() => {  });
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
    roomMaxRow.hidden = !inRoom;
    roomLeaveBtn.hidden = !inRoom;
    if (inRoom) {
      const info = rooms[currentRoom];
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
    detachPlace();
    currentRoom = code;
    roomMsg.textContent = '';
    rememberSession();
    attachPlace();
    syncRoomWatchers();
    renderRoomList();
  }

  function enterRoom(code) {
    code = (code || '').toUpperCase().trim();
    if (code.length !== CODE_LEN) {
      roomMsg.textContent = '코드는 ' + CODE_LEN + '글자임';
      return;
    }
    const db = ensureDb();
    if (!db) return;
    db.ref(ROOM_LIST_PATH + '/' + code).once('value')
      .then(snap => {
        if (!snap.exists()) {
          roomMsg.textContent = '없는 방임';
          return null;
        }
        const max = clampMax((snap.val() || {}).max);

        return db.ref(ROOMS_PATH + '/' + code + '/' + USERS_PATH).once('value')
          .then(us => {
            const count = us.exists() ? Object.keys(us.val()).length : 0;
            if (count >= max) {
              roomMsg.textContent = '방이 꽉 참 (' + count + '/' + max + ')';
              return;
            }
            roomCodeInput.value = '';
            goPlace(code);
          });
      })
      .catch(() => { roomMsg.textContent = '확인 실패'; });
  }

  function createRoom() {
    const db = ensureDb();
    if (!db) return;
    const title = roomTitleInput.value.trim().slice(0, 20) || '이름 없는 방';
    const max = clampMax(roomMaxNew.value);
    roomMaxNew.value = max;

    const tryOnce = (left) => {
      if (left <= 0) { roomMsg.textContent = '방을 만들지 못함'; return; }
      const code = makeRoomCode();
      const ref = db.ref(ROOM_LIST_PATH + '/' + code);
      ref.once('value').then(snap => {
        if (snap.exists()) { tryOnce(left - 1); return; }
        return ref.set({ title: title, created: Date.now(), max: max }).then(() => {
          roomTitleInput.value = '';
          goPlace(code);
        });
      }).catch(() => { roomMsg.textContent = '방을 만들지 못함'; });
    };
    tryOnce(5);
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

  roomMaxInput.addEventListener('change', () => {
    if (!currentRoom) return;
    const max = clampMax(roomMaxInput.value);
    roomMaxInput.value = max;
    const db = ensureDb();
    if (!db) return;
    db.ref(ROOM_LIST_PATH + '/' + currentRoom + '/max').set(max)
      .then(() => { roomMsg.textContent = '최대 인원 ' + max + '명으로 바꿈'; })
      .catch(() => { roomMsg.textContent = '바꾸지 못함'; });
  });

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

