

  function saveSession() {
    try {
      localStorage.setItem(SESSION_KEY, JSON.stringify({
        seed,
        modes: selectedModes,
        intensity,
        allowTangle: allowTangleCheck.checked,
        moves: moveHistory.map(m => [m.i, m.j])
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

    const moves = Array.isArray(s.moves) ? s.moves : [];
    for (const mv of moves) {
      if (!Array.isArray(mv)) continue;
      const [i, j] = mv;
      if (!Number.isInteger(i) || !Number.isInteger(j)) continue;
      if (i < 0 || i >= N || j < 0 || j >= N) continue;
      placeStone(i, j);
    }
    updateHud();
    draw();
    saveSession();
    return true;
  }

