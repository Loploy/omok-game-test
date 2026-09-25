

  function openNickModal() {
    loadNick();
    nickModalInput.value = nickDisplay.textContent;
    nickModal.hidden = false;
    nickModalInput.focus();
    nickModalInput.select();
  }

  function cancelNickModal() {
    nickModal.hidden = true;
    onlineCheck.checked = false;
  }

  function confirmNickModal() {
    nickDisplay.textContent = nickModalInput.value.trim().slice(0, 12);
    if (!nickDisplay.textContent) nickDisplay.textContent = getNick();
    try { localStorage.setItem(NICK_KEY, getNick()); } catch (e) {  }
    nickModal.hidden = true;
    connectOnline();
  }

  nickOkBtn.addEventListener('click', confirmNickModal);
  nickCancelBtn.addEventListener('click', cancelNickModal);
  nickModalInput.addEventListener('keydown', e => {
    if (e.key === 'Enter') { e.preventDefault(); confirmNickModal(); }
    if (e.key === 'Escape') { e.preventDefault(); cancelNickModal(); }
  });

  nickModal.addEventListener('click', e => {
    if (e.target === nickModal) cancelNickModal();
  });

  function adminWipe(path, label, after) {
    if (!window.confirm(label + '?')) return;
    const db = ensureDb();
    if (!db) { adminMsg.textContent = '연결할 수 없음'; return; }
    adminMsg.textContent = '지우는 중…';
    db.ref(path).remove()
      .then(() => {
        adminMsg.textContent = label + ' 완료';
        if (after) after();
      })
      .catch(() => { adminMsg.textContent = label + ' 실패'; });
  }

  if (new URLSearchParams(location.search).get('view') === 'admin') {
    adminPanel.hidden = false;
  }

  document.getElementById('adminClearChatBtn').addEventListener('click', () => {

    adminWipe(placePath(CHAT_PATH), '대화 초기화', clearChatLog);
  });

  document.getElementById('adminClearGameBtn').addEventListener('click', () => {

    adminWipe(placePath(GAME_PATH), '판 초기화', () => {
      resetGame(true);
      saveSession();
    });
  });

  document.getElementById('adminClearUsersBtn').addEventListener('click', () => {

    adminWipe(placePath(USERS_PATH), '이름 목록 정리', () => {
      nickMap = {};
      refreshChatNames();
      publishNick();
    });
  });

  onlineCheck.addEventListener('change', () => {
    if (onlineCheck.checked) openNickModal();
    else disconnectOnline();
  });

