(function() {
  const canvas = document.getElementById('gdprSignatureCanvas');
  const clearBtn = document.getElementById('gdprSignatureClear');
  const submitBtn = document.getElementById('gdprSignatureSubmit');
  const hiddenInput = document.getElementById('gdprSignatureData');
  const statusEl = document.getElementById('gdprSignatureStatus');
  const form = document.getElementById('gdprSignatureForm');
  if (!canvas || !clearBtn || !submitBtn || !hiddenInput || !form) return;

  const ctx = canvas.getContext('2d');
  if (!ctx) return;

  let drawing = false;
  let hasStroke = false;

  function setStatus(message) {
    if (statusEl) statusEl.textContent = message;
  }

  function setupCanvas() {
    const ratio = Math.max(window.devicePixelRatio || 1, 1);
    const rect = canvas.getBoundingClientRect();
    canvas.width = Math.max(600, Math.round(rect.width * ratio));
    canvas.height = Math.max(160, Math.round(rect.height * ratio));
    ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.lineWidth = 2.2;
    ctx.strokeStyle = '#111827';
    clearCanvas();
  }

  function clearCanvas() {
    ctx.save();
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.restore();
    hasStroke = false;
    drawing = false;
    hiddenInput.value = '';
    submitBtn.disabled = true;
    setStatus('Traccia la tua firma prima di confermare.');
  }

  function pointFromEvent(event) {
    const rect = canvas.getBoundingClientRect();
    return {
      x: event.clientX - rect.left,
      y: event.clientY - rect.top
    };
  }

  function syncSignature() {
    if (!hasStroke) {
      hiddenInput.value = '';
      submitBtn.disabled = true;
      setStatus('Traccia la tua firma prima di confermare.');
      return false;
    }
    hiddenInput.value = canvas.toDataURL('image/jpeg', 0.92);
    submitBtn.disabled = false;
    setStatus('Firma acquisita. Premi Conferma per aggiungerla al PDF.');
    return true;
  }

  function startDraw(event) {
    event.preventDefault();
    const point = pointFromEvent(event);
    drawing = true;
    ctx.beginPath();
    ctx.moveTo(point.x, point.y);
  }

  function moveDraw(event) {
    if (!drawing) return;
    event.preventDefault();
    const point = pointFromEvent(event);
    ctx.lineTo(point.x, point.y);
    ctx.stroke();
    if (!hasStroke) {
      hasStroke = true;
      submitBtn.disabled = false;
      setStatus('Firma acquisita. Premi Conferma per aggiungerla al PDF.');
    }
  }

  function endDraw(event) {
    if (!drawing) return;
    if (event) event.preventDefault();
    drawing = false;
    ctx.closePath();
    syncSignature();
  }

  canvas.addEventListener('pointerdown', startDraw);
  canvas.addEventListener('pointermove', moveDraw);
  canvas.addEventListener('pointerup', endDraw);
  canvas.addEventListener('pointerleave', endDraw);
  canvas.addEventListener('pointercancel', endDraw);
  window.addEventListener('pointerup', endDraw);

  clearBtn.addEventListener('click', clearCanvas);
  form.addEventListener('submit', function(event) {
    if (!syncSignature()) {
      event.preventDefault();
      return;
    }
    submitBtn.disabled = true;
    setStatus('Salvataggio del documento firmato in corso...');
  });

  window.addEventListener('resize', setupCanvas);
  setupCanvas();
})();
