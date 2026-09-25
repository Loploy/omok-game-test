
let roomMeta = null;
let roomMembers = {};
let hostRoomRef = null;
let hostRoomHandler = null;
let hostTransferTimer = null;
let roomIndexSignature = '';
let hostTransferTarget = '';

async function changeRoom(code, update) {
  const ref = ensureDb().ref(ROOMS_PATH + '/' + code);
  let handler;
  try {
    await new Promise((resolve, reject) => {
      handler = snapshot => resolve(snapshot);
      ref.on('value', handler, reject);
    });
    return await ref.transaction(update, undefined, false);
  } finally { if (handler) ref.off('value', handler); }
}

function isRoomHost() { return !!currentRoom && roomMeta?.host === getMyId(); }

function orderedMembers(users) {
  return Object.keys(users || {}).sort((a, b) => (users[a].joinedAt || 0) - (users[b].joinedAt || 0) || a.localeCompare(b));
}

async function joinManagedRoom(code) {
  const me = getMyId();
  let error = '입장하지 못함';
  const legacyInfo = (await ensureDb().ref(ROOM_LIST_PATH + '/' + code).once('value')).val();
  const result = await changeRoom(code, room => {
    if (room && !room.meta) {
      room.meta = { title: legacyInfo?.title || '이름 없는 방', max: clampMax(legacyInfo?.max), created: legacyInfo?.created || serverNow(), host: orderedMembers(room.users)[0] || me, public: true, locked: false, allowControls: true };
      room.members = room.members || {};
      for (const id of Object.keys(room.users || {})) room.members[id] = { joinedAt: room.users[id].joinedAt || serverNow() };
    }
    if (!room?.meta) { error = '없는 방임'; return; }
    if (room.banned?.[me]) { error = '이 방에서 추방됨'; return; }
    const returning = !!room.members?.[me];
    if (room.meta.locked && !returning) { error = '잠긴 방임'; return; }
    if (!room.users?.[me] && Object.keys(room.users || {}).length >= clampMax(room.meta.max)) { error = '방이 꽉 참'; return; }
    room.members = room.members || {};
    room.users = room.users || {};
    const joinedAt = room.members[me]?.joinedAt || serverNow();
    room.members[me] = { joinedAt };
    room.users[me] = { name: getNick(), joinedAt };
    return room;
  });
  if (!result.committed) throw new Error(error);
}

async function restorePresence() {
  if (!online || !usersRef) return;
  const ref = usersRef, code = currentRoom, me = getMyId();
  try {
    await ref.child(me).onDisconnect().remove();
    if (ref !== usersRef) return;
    if (code) await joinManagedRoom(code);
    else await ref.child(me).update({ name: getNick() });
  } catch (error) {
    if (ref === usersRef) roomMsg.textContent = error.message || '참가 정보 복원 실패';
  }
}

async function leaveManagedRoom(code) {
  const me = getMyId();
  await changeRoom(code, room => {
    if (!room?.meta) return;
    if (room.users) delete room.users[me];
    if (room.members) delete room.members[me];
    if (room.meta.host === me) room.meta.host = orderedMembers(room.users)[0] || '';
    return room;
  });
}

function syncRoomIndex(code, meta) {
  const entry = meta.public === false ? null : { title: meta.title, max: meta.max, created: meta.created, locked: !!meta.locked };
  const signature = JSON.stringify([code, entry]);
  if (signature === roomIndexSignature) return;
  roomIndexSignature = signature;
  ensureDb().ref(ROOM_LIST_PATH + '/' + code).set(entry).catch(() => { roomIndexSignature = ''; });
}

function attachRoomHost() {
  if (!currentRoom) { renderRoomSettings(); return; }
  const code = currentRoom;
  hostRoomRef = ensureDb().ref(ROOMS_PATH + '/' + code);
  hostRoomHandler = hostRoomRef.on('value', snapshot => {
    if (currentRoom !== code) return;
    const room = snapshot.val();
    if (!room?.meta) return;
    roomMeta = room.meta;
    roomMembers = room.users || {};
    if (room.banned?.[getMyId()]) {
      goPlace(null).then(() => { roomMsg.textContent = '방에서 추방되었습니다'; });
      return;
    }
    if (isRoomHost()) syncRoomIndex(code, roomMeta);
    renderRoomSettings();
    updateRoomUI();
    updateControlLock();
    if (roomMembers[roomMeta.host]) { clearTimeout(hostTransferTimer); hostTransferTarget = ''; }
    if (!roomMembers[roomMeta.host] && Object.keys(roomMembers).length) {
      const oldHost = roomMeta.host;
      const target = code + ':' + oldHost;
      if (hostTransferTarget === target) return;
      clearTimeout(hostTransferTimer);
      hostTransferTarget = target;
      hostTransferTimer = setTimeout(() => {
        hostTransferTarget = '';
        changeRoom(code, current => {
          if (!current?.meta || current.meta.host !== oldHost || current.users?.[oldHost]) return;
          current.meta.host = orderedMembers(current.users)[0] || '';
          return current;
        }).catch(() => { roomMsg.textContent = '방장 자동 위임 실패'; });
      }, oldHost ? HOST_RECONNECT_GRACE_MS : 0);
    }
  });
}

function detachRoomHost() {
  if (hostRoomRef && hostRoomHandler) hostRoomRef.off('value', hostRoomHandler);
  hostRoomRef = hostRoomHandler = null;
  roomMeta = null; roomMembers = {}; roomIndexSignature = '';
  clearTimeout(hostTransferTimer);
  hostTransferTarget = '';
  const dialog = document.getElementById('roomSettingsDialog');
  if (dialog.open) dialog.close();
}

async function hostRoomAction(update) {
  if (!isRoomHost()) return;
  try {
    const result = await changeRoom(currentRoom, room => {
      if (room?.meta?.host !== getMyId()) return;
      return update(room);
    });
    if (!result.committed) roomMsg.textContent = '방 설정 변경 권한이 없거나 대상이 나갔습니다';
  } catch (error) { roomMsg.textContent = '방 설정 변경 실패'; }
}

function renderRoomSettings() {
  const host = isRoomHost();
  document.getElementById('roomSettingsBtn').hidden = !host;
  const dialog = document.getElementById('roomSettingsDialog');
  if (!host) { if (dialog.open) dialog.close(); return; }
  for (const [id, value] of [['roomPublic', roomMeta.public !== false], ['roomLocked', !!roomMeta.locked], ['roomAllowControls', roomMeta.allowControls !== false]]) document.getElementById(id).checked = value;
  if (document.activeElement !== roomMaxInput) roomMaxInput.value = clampMax(roomMeta.max);
  const list = document.getElementById('roomSettingsMembers');
  const scrollTop = list.scrollTop;
  list.replaceChildren();
  for (const id of orderedMembers(roomMembers)) {
    const row = document.createElement('div');
    row.className = 'room-member-row';
    const name = document.createElement('span');
    name.textContent = roomMembers[id].name + (id === roomMeta.host ? ' (방장)' : '');
    row.append(name);
    if (id !== getMyId()) {
      for (const action of ['위임', '추방']) {
        const button = document.createElement('button');
        button.textContent = action;
        button.addEventListener('click', () => {
          if (!confirm(name.textContent + ' 님에게 ' + (action === '위임' ? '방장을 넘길까요?' : '추방을 적용할까요?'))) return;
          hostRoomAction(room => {
            if (!room.users?.[id]) return;
            if (action === '위임') room.meta.host = id;
            else {
              room.banned = { ...room.banned, [id]: true };
              delete room.users[id];
              if (room.members) delete room.members[id];
              if (room.match?.state === 'playing' && [room.match.black, room.match.white].includes(id)) {
                const winner = room.match.black === id ? room.match.white : room.match.black;
                room.match = { ...room.match, state: 'ended', winner, result: (room.users[winner]?.name || '상대') + ' 승리! (추방)' };
              } else if (room.match?.ready?.[id] && room.match.state !== 'ended') {
                delete room.match.ready[id]; room.match.state = 'idle';
              }
            }
            return room;
          });
        });
        row.append(button);
      }
    }
    list.append(row);
  }
  list.scrollTop = scrollTop;
}
document.getElementById('roomSettingsBtn').addEventListener('click', () => {
  if (isRoomHost()) { renderRoomSettings(); document.getElementById('roomSettingsDialog').showModal(); }
});
document.getElementById('roomSettingsClose').addEventListener('click', () => document.getElementById('roomSettingsDialog').close());
for (const [id, key] of [['roomPublic','public'],['roomLocked','locked'],['roomAllowControls','allowControls']]) {
  document.getElementById(id).addEventListener('change', event => {
    const checked = event.target.checked;
    hostRoomAction(room => { room.meta[key] = checked; return room; });
  });
}
roomMaxInput.addEventListener('change', () => hostRoomAction(room => {
  room.meta.max = Math.max(clampMax(roomMaxInput.value), Object.keys(room.users || {}).length);
  return room;
}));
