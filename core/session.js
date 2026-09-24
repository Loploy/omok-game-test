

  function saveSession() {
    try {
      localStorage.setItem(SESSION_KEY, JSON.stringify({
        seed,
        modes: selectedModes,
        intensity,
        allowTangle: allowTangleCheck.checked,
        moves: moveHistory.map(m => [m.i, m.j, m.player, m.color])
      }));
    } catch (e) {  }
    pushState();
  }

  function restoreSession() {
    let s = null;
    try {
      const raw = localStorage.getItem(SESSION_KEY);
      s = raw ? JSON.parse(raw) : null;
    } catch (e) {
      return false;
    }
    if (!s || typeof s.seed !== 'number' || typeof s.intensity !== 'number') return false;

    selectedModes = normalizeModes(s.modes, s.intensity);
    renderModes();
    allowTangleCheck.checked = !!s.allowTangle;
    warpSlider.value = Math.round(s.intensity * 100);
    warpVal.textContent = warpSlider.value + '%';
    generateGrid(s.seed, s.intensity);
    resetGame(true);

    const restored = normalizeState(s);
    for (const mv of restored.moves) placeStone(mv[0], mv[1], mv[2], mv[3]);
    updateHud();
    draw();
    saveSession();
    return true;
  }

