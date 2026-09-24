
const ZOOM_MIN = 1;
const ZOOM_MAX = 4;
const ZOOM_STEP = 0.5;

  function applyZoom() {
    canvas.style.width = (zoom * 100) + '%';
    canvas.style.height = 'auto';
    zoomVal.textContent = Math.round(zoom * 100) + '%';
  }

  const DRAG_THRESHOLD = 6;
  const pointers = new Map();
  let dragMoved = false;
  let startX = 0, startY = 0, startScrollLeft = 0, startScrollTop = 0;
  let pinchStartDist = 0, pinchStartZoom = 1;

  function pointerList() { return [...pointers.values()]; }
  function pinchDistance(a, b) { return Math.hypot(a.x - b.x, a.y - b.y); }

  function zoomAround(newZoom, clientX, clientY) {
    const prevW = canvas.getBoundingClientRect().width;
    const rect = boardScroll.getBoundingClientRect();
    const relX = clientX - rect.left;
    const relY = clientY - rect.top;

    const fx = prevW ? (boardScroll.scrollLeft + relX) / prevW : 0;
    const fy = prevW ? (boardScroll.scrollTop + relY) / prevW : 0;
    zoom = Math.max(ZOOM_MIN, Math.min(ZOOM_MAX, newZoom));
    applyZoom();
    const newW = canvas.getBoundingClientRect().width;
    boardScroll.scrollLeft = fx * newW - relX;
    boardScroll.scrollTop = fy * newW - relY;
  }

  canvas.addEventListener('pointerdown', (e) => {
    pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
    canvas.setPointerCapture(e.pointerId);
    if (pointers.size === 1) {
      dragMoved = false;
      startX = e.clientX;
      startY = e.clientY;
      startScrollLeft = boardScroll.scrollLeft;
      startScrollTop = boardScroll.scrollTop;
    } else if (pointers.size === 2) {
      const [a, b] = pointerList();
      pinchStartDist = pinchDistance(a, b);
      pinchStartZoom = zoom;
      dragMoved = true;
    }
  });

  canvas.addEventListener('pointermove', (e) => {
    if (!pointers.has(e.pointerId)) return;
    pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });

    if (pointers.size >= 2) {
      const [a, b] = pointerList();
      const dist = pinchDistance(a, b);
      if (pinchStartDist > 0) {
        zoomAround(pinchStartZoom * (dist / pinchStartDist), (a.x + b.x) / 2, (a.y + b.y) / 2);
      }
      return;
    }

    const dx = e.clientX - startX;
    const dy = e.clientY - startY;
    if (!dragMoved && Math.hypot(dx, dy) > DRAG_THRESHOLD) dragMoved = true;
    if (dragMoved) {
      boardScroll.scrollLeft = startScrollLeft - dx;
      boardScroll.scrollTop = startScrollTop - dy;
    }
  });

  function endPointer(e, allowTap) {
    if (!pointers.has(e.pointerId)) return;
    const wasSingle = pointers.size === 1;
    pointers.delete(e.pointerId);
    if (allowTap && wasSingle && !dragMoved) handlePick(e.clientX, e.clientY);

    if (pointers.size === 1) {
      const [p] = pointerList();
      startX = p.x;
      startY = p.y;
      startScrollLeft = boardScroll.scrollLeft;
      startScrollTop = boardScroll.scrollTop;
      dragMoved = true;
    }
  }
  canvas.addEventListener('pointerup', (e) => endPointer(e, true));
  canvas.addEventListener('pointercancel', (e) => endPointer(e, false));

