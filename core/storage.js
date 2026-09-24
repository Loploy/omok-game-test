

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
    refreshSavedMenu();
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
    refreshSavedMenu();
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

function refreshSavedMenu() {
  const button = document.getElementById('savedMenuBtn');
  button.textContent = (savedList.selectedOptions[0]?.textContent || '저장한 판 없음') + ' ▴';
  button.disabled = savedList.disabled;
  closeSavedMenu();
}

function closeSavedMenu() {
  document.getElementById('savedMenu').hidden = true;
  document.getElementById('savedMenuBtn').setAttribute('aria-expanded', 'false');
}

function openSavedMenu() {
  const menu = document.getElementById('savedMenu');
  const trigger = document.getElementById('savedMenuBtn');
  if (!menu.hidden) { closeSavedMenu(); return; }
  menu.replaceChildren();
  for (const option of savedList.options) {
    const button = document.createElement('button');
    button.type = 'button';
    button.textContent = option.textContent;
    button.addEventListener('click', () => {
      savedList.value = option.value;
      refreshSavedMenu();
      trigger.focus();
    });
    menu.append(button);
  }
  const rect = trigger.getBoundingClientRect();
  menu.style.left = rect.left + 'px';
  menu.style.width = rect.width + 'px';
  menu.style.bottom = (window.innerHeight - rect.top + 4) + 'px';
  menu.style.maxHeight = Math.max(0, rect.top - 12) + 'px';
  menu.hidden = false;
  trigger.setAttribute('aria-expanded', 'true');
  menu.querySelector('button')?.focus();
}
document.getElementById('savedMenuBtn').addEventListener('click', openSavedMenu);
document.addEventListener('click', event => {
  if (!event.target.closest('#savedMenu, #savedMenuBtn')) closeSavedMenu();
});
document.addEventListener('keydown', event => {
  if (event.key === 'Escape' && !document.getElementById('savedMenu').hidden) {
    closeSavedMenu();
    document.getElementById('savedMenuBtn').focus();
  }
});
window.addEventListener('resize', closeSavedMenu);
document.addEventListener('scroll', event => {
  if (event.target !== document.getElementById('savedMenu')) closeSavedMenu();
}, true);
