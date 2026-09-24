
  saveBoardBtn.addEventListener('click', saveCurrentBoard);
  loadBoardBtn.addEventListener('click', loadSelectedBoard);
  deleteBoardBtn.addEventListener('click', deleteSelectedBoard);

  resetBtn.addEventListener('click', () => { resetGame(true); saveSession(); });
  reshuffleBtn.addEventListener('click', () => { resetGame(false); saveSession(); });
  undoBtn.addEventListener('click', undoMove);
  document.getElementById('zoomInBtn').addEventListener('click', () => {
    zoom = Math.min(ZOOM_MAX, Math.round((zoom + ZOOM_STEP) * 100) / 100);
    applyZoom();
  });
  document.getElementById('zoomOutBtn').addEventListener('click', () => {
    zoom = Math.max(ZOOM_MIN, Math.round((zoom - ZOOM_STEP) * 100) / 100);
    applyZoom();
  });
  document.getElementById('zoomResetBtn').addEventListener('click', () => {
    zoom = 1;
    applyZoom();
    boardScroll.scrollLeft = 0;
    boardScroll.scrollTop = 0;
  });

  warpSlider.addEventListener('input', () => {
    const pct = Number(warpSlider.value);

    warpVal.textContent = pct + '%';
    generateGrid(seed, pct / 100);
    draw();
    saveSession();
  });
  warpVal.textContent = warpSlider.value + '%';

  allowTangleCheck.addEventListener('change', () => {
    generateGrid(seed, intensity);
    draw();
    saveSession();
  });

  loadNick();
  refreshSavedList();
  applyZoom();

  if (!restoreSession()) resetGame(false);

  onlineCheck.checked = true;
  connectOnline();

