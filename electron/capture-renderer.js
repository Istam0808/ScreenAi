(function () {
  const overlay = document.getElementById('overlay');
  const selection = document.getElementById('selection');

  let startX = 0, startY = 0;
  let isSelecting = false;

  function setSelectionRect(x, y, w, h) {
    selection.style.left = x + 'px';
    selection.style.top = y + 'px';
    selection.style.width = Math.max(0, w) + 'px';
    selection.style.height = Math.max(0, h) + 'px';
    selection.classList.add('visible');
  }

  overlay.addEventListener('mousedown', function (e) {
    isSelecting = true;
    startX = e.clientX;
    startY = e.clientY;
    setSelectionRect(startX, startY, 0, 0);
  });

  window.addEventListener('mousemove', function (e) {
    if (!isSelecting) return;
    var x = Math.min(startX, e.clientX);
    var y = Math.min(startY, e.clientY);
    var w = Math.abs(e.clientX - startX);
    var h = Math.abs(e.clientY - startY);
    setSelectionRect(x, y, w, h);
  });

  window.addEventListener('mouseup', function (e) {
    if (!isSelecting) return;
    isSelecting = false;
    var x = Math.min(startX, e.clientX);
    var y = Math.min(startY, e.clientY);
    var w = Math.abs(e.clientX - startX);
    var h = Math.abs(e.clientY - startY);
    if (w < 10 || h < 10) {
      selection.classList.remove('visible');
      return;
    }
    if (window.electronCapture && typeof window.electronCapture.sendSelection === 'function') {
      window.electronCapture.sendSelection({
        x: Math.round(x),
        y: Math.round(y),
        width: Math.round(w),
        height: Math.round(h),
        devicePixelRatio: window.devicePixelRatio || 1
      });
    }
  });

  window.addEventListener('keydown', function (e) {
    if (e.key === 'Escape') {
      if (window.electronCapture && typeof window.electronCapture.cancel === 'function') {
        window.electronCapture.cancel();
      }
    }
  });
})();
