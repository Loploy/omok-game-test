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
