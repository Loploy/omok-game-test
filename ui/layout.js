let boardFocusActive = false;
let boardFocusZoom = 1;
let boardFocusScroll = [0, 0];
const boardView = document.getElementById('boardView');
const boardFocusBtn = document.getElementById('boardFocusBtn');

function setBoardFocus(active) {
  if (active === boardFocusActive) return;
  if (active) {
    boardFocusZoom = zoom;
    boardFocusScroll = [boardScroll.scrollLeft, boardScroll.scrollTop];
    zoom = ZOOM_MIN;
  } else {
    zoom = boardFocusZoom;
  }
  boardFocusActive = active;
  document.body.classList.toggle('board-focus', active);
  boardFocusBtn.textContent = active ? UI_TEXT.boardView.close : UI_TEXT.boardView.open;
  boardFocusBtn.setAttribute('aria-pressed', String(active));
  fitBoardToPanel();
  applyZoom();
  boardScroll.scrollLeft = active ? 0 : boardFocusScroll[0];
  boardScroll.scrollTop = active ? 0 : boardFocusScroll[1];
  boardFocusBtn.focus();
}

function toggleBoardFocus() {
  setBoardFocus(!boardFocusActive);
}

boardFocusBtn.textContent = UI_TEXT.boardView.open;
boardFocusBtn.addEventListener('click', toggleBoardFocus);
document.addEventListener('keydown', event => {
  if (event.key === 'Escape' && boardFocusActive) {
    event.preventDefault();
    toggleBoardFocus();
  }
});

function fitBoardToPanel() {
  const frame = boardView.querySelector('.board-frame');
  if (!boardFocusActive && window.innerWidth <= 900) { frame.style.width = ''; return; }
  let controlsHeight = 0;
  for (const child of boardView.children) {
    if (child === frame) continue;
    const style = getComputedStyle(child);
    if (style.display === 'none') continue;
    controlsHeight += child.getBoundingClientRect().height + parseFloat(style.marginTop || 0) + parseFloat(style.marginBottom || 0);
  }
  const panelStyle = getComputedStyle(boardView);
  const horizontalPadding = parseFloat(panelStyle.paddingLeft) + parseFloat(panelStyle.paddingRight);
  const verticalPadding = parseFloat(panelStyle.paddingTop) + parseFloat(panelStyle.paddingBottom);

  const available = Math.min(boardView.clientWidth - horizontalPadding, boardView.clientHeight - verticalPadding - controlsHeight - 4);
  frame.style.width = Math.max(boardFocusActive ? 20 : 160, available) + 'px';
}
const boardLayoutObserver = new ResizeObserver(() => requestAnimationFrame(fitBoardToPanel));
boardLayoutObserver.observe(boardView);
for (const child of boardView.children) {
  if (!child.classList.contains('board-frame')) boardLayoutObserver.observe(child);
}
window.addEventListener('resize', fitBoardToPanel);
