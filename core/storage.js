

  const STORAGE_KEY = STORAGE_PREFIX + 'boards';
  const SESSION_KEY = STORAGE_PREFIX + 'current';
  const savedList = document.getElementById('savedList');
  const undoBtn = document.getElementById('undoBtn');
  const resetBtn = document.getElementById('resetBtn');
  const reshuffleBtn = document.getElementById('reshuffleBtn');
  const saveBoardBtn = document.getElementById('saveBoardBtn');
  const loadBoardBtn = document.getElementById('loadBoardBtn');
  const deleteBoardBtn = document.getElementById('deleteBoardBtn');

  function readSavedBoards() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      const list = raw ? JSON.parse(raw) : [];
      return Array.isArray(list) ? list : [];
    } catch (e) {
      return [];
    }
  }

  function writeSavedBoards(list) {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(list));
      return true;
    } catch (e) {
      msg.textContent = '이 브라우저에서는 저장을 쓸 수 없음';
      return false;
    }
  }

  function refreshSavedList() {
    const list = readSavedBoards();
    savedList.innerHTML = '';
    if (list.length === 0) {
      const opt = document.createElement('option');
      opt.textContent = '저장한 판 없음';
      savedList.appendChild(opt);
    } else {
      for (const b of list) {
        const opt = document.createElement('option');
        opt.value = b.id;
        opt.textContent = b.name;
        savedList.appendChild(opt);
      }
    }
    savedList.disabled = list.length === 0;
    loadBoardBtn.disabled = list.length === 0;
    deleteBoardBtn.disabled = list.length === 0;
  }

  function saveCurrentBoard() {
    const list = readSavedBoards();
    const pct = Math.round(intensity * 100);
    const suggested = '판 ' + (list.length + 1) + ' (' + pct + '%' + (allowTangleCheck.checked ? ', 꼬임' : '') + ')';
    const name = (prompt('저장할 이름', suggested) || '').trim() || suggested;
    list.push({
      id: String(Date.now()),
      name,
      seed,
      modes: selectedModes,
      intensity,
      allowTangle: allowTangleCheck.checked
    });
    if (!writeSavedBoards(list)) return;
    refreshSavedList();
    savedList.value = list[list.length - 1].id;
    msg.textContent = '"' + name + '" 저장함';
  }

  function loadSelectedBoard() {
    const list = readSavedBoards();
    const target = list.find(b => b.id === savedList.value);
    if (!target) return;
    allowTangleCheck.checked = !!target.allowTangle;
    warpSlider.value = Math.round(target.intensity * 100);
    warpVal.textContent = warpSlider.value + '%';
    generateGrid(target.seed, target.intensity);
    resetGame(true);
    saveSession();
    msg.textContent = '"' + target.name + '" 불러옴';
  }

  function deleteSelectedBoard() {
    const list = readSavedBoards();
    const target = list.find(b => b.id === savedList.value);
    if (!target) return;
    if (!confirm('"' + target.name + '" 삭제할까요?')) return;
    if (!writeSavedBoards(list.filter(b => b.id !== target.id))) return;
    refreshSavedList();
    msg.textContent = '"' + target.name + '" 삭제함';
  }

