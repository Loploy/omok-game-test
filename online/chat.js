

  let myId = null;
  function getMyId() {
    if (accountUser) return accountUser.uid;
    if (myId) return myId;
    const gen = () => Math.random().toString(36).slice(2, 10);
    try {
      myId = localStorage.getItem(ME_KEY);
      if (!myId) {
        myId = gen();
        localStorage.setItem(ME_KEY, myId);
      }
    } catch (e) {
      myId = gen();
    }
    return myId;
  }

  function getNick() {
    const v = nickInput.value.trim();
    return v || ('손님' + getMyId().slice(0, 4));
  }

  function loadNick() {
    let saved = null;
    try { saved = localStorage.getItem(NICK_KEY); } catch (e) {  }
    nickInput.value = saved || ('손님' + getMyId().slice(0, 4));
  }

  function displayName(from, fallback) {
    return nickMap[from] || fallback || '손님';
  }

  function refreshChatNames() {
    for (const box of chatLog.querySelectorAll('.chat-msg')) {
      const nameEl = box.querySelector('.chat-name');
      if (nameEl) nameEl.textContent = displayName(box.dataset.from, box.dataset.fallbackName);
    }
  }

  function publishNick() {
    if (!online || !usersRef) return;
    usersRef.child(getMyId()).set({ name: getNick() }).catch(() => {  });
  }

  window.addEventListener('storage', e => {
    if (accountUser || e.key !== NICK_KEY || !e.newValue) return;
    nickInput.value = e.newValue.slice(0, 12);
  });

  nickInput.addEventListener('change', () => {
    nickInput.value = nickInput.value.trim().slice(0, 12);
    try { localStorage.setItem(NICK_KEY, getNick()); } catch (e) {  }
    publishNick();
  });

  let lastChatFrom = null;

  function appendChatLine(key, from, fallbackName, text) {
    chatEmpty.hidden = true;
    const mine = from === getMyId();

    const box = document.createElement('div');
    box.className = 'chat-msg ' + (mine ? 'mine' : 'theirs');

    box.dataset.from = from;
    if (fallbackName) box.dataset.fallbackName = fallbackName;
    if (key) box.dataset.key = key;

    if (!mine && from !== lastChatFrom) {
      const nameEl = document.createElement('div');
      nameEl.className = 'chat-name';
      nameEl.textContent = displayName(from, fallbackName);
      box.appendChild(nameEl);
    }

    const el = document.createElement('div');
    el.className = 'chat-line ' + (mine ? 'mine' : 'theirs');
    el.textContent = text;
    box.appendChild(el);

    chatLog.appendChild(box);
    chatLog.scrollTop = chatLog.scrollHeight;
    lastChatFrom = from;
  }

  function clearChatLog() {
    for (const el of [...chatLog.querySelectorAll('.chat-msg')]) el.remove();
    chatEmpty.hidden = false;
    lastChatFrom = null;
  }

  function setChatEnabled(on) {
    chatInput.disabled = !on;
    chatSendBtn.disabled = !on;
    nickInput.disabled = !on;
    chatEmpty.textContent = on ? '아직 대화 없음' : '로비에 연결 중입니다';
  }

  function sendChat() {
    if (!online || !chatRef) return;
    const text = chatInput.value.trim();
    if (!text) return;
    chatInput.value = '';
    chatRef.push({ from: getMyId(), name: getNick(), text: text.slice(0, 200), ts: Date.now() })
      .catch(() => setOnlineStatus('채팅 전송 실패'));
  }

  chatSendBtn.addEventListener('click', sendChat);
  chatInput.addEventListener('keydown', e => {
    if (e.key === 'Enter') { e.preventDefault(); sendChat(); }
  });

