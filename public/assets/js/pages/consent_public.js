(function() {
  const canvas = document.getElementById('consentSignatureCanvas');
  const hidden = document.getElementById('consentSignatureData');
  const clearBtn = document.getElementById('consentSignatureClear');
  const form = document.getElementById('consentSignatureForm');
  if (!canvas || !hidden || !clearBtn || !form) return;

  const ctx = canvas.getContext('2d');
  let drawing = false;
  let hasStroke = false;
  let lastX = 0;
  let lastY = 0;

  const resizeCanvas = () => {
    const ratio = Math.max(window.devicePixelRatio || 1, 1);
    const rect = canvas.getBoundingClientRect();
    const saved = hasStroke ? canvas.toDataURL('image/png') : null;
    canvas.width = Math.max(1, Math.round(rect.width * ratio));
    canvas.height = Math.max(1, Math.round(rect.height * ratio));
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.scale(ratio, ratio);
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.lineWidth = 2.2;
    ctx.strokeStyle = '#1f2937';
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, rect.width, rect.height);

    if (saved) {
      const img = new Image();
      img.onload = () => {
        ctx.drawImage(img, 0, 0, rect.width, rect.height);
      };
      img.src = saved;
    }
  };

  const pointFromEvent = (ev) => {
    const rect = canvas.getBoundingClientRect();
    if (ev.touches && ev.touches.length) {
      return {
        x: ev.touches[0].clientX - rect.left,
        y: ev.touches[0].clientY - rect.top,
      };
    }
    return {
      x: ev.clientX - rect.left,
      y: ev.clientY - rect.top,
    };
  };

  const start = (ev) => {
    ev.preventDefault();
    const p = pointFromEvent(ev);
    drawing = true;
    lastX = p.x;
    lastY = p.y;
  };

  const move = (ev) => {
    if (!drawing) return;
    ev.preventDefault();
    const p = pointFromEvent(ev);
    ctx.beginPath();
    ctx.moveTo(lastX, lastY);
    ctx.lineTo(p.x, p.y);
    ctx.stroke();
    lastX = p.x;
    lastY = p.y;
    hasStroke = true;
  };

  const end = () => {
    drawing = false;
  };

  clearBtn.addEventListener('click', () => {
    hasStroke = false;
    hidden.value = '';
    resizeCanvas();
  });

  canvas.addEventListener('mousedown', start);
  canvas.addEventListener('mousemove', move);
  window.addEventListener('mouseup', end);
  canvas.addEventListener('mouseleave', end);

  canvas.addEventListener('touchstart', start, { passive: false });
  canvas.addEventListener('touchmove', move, { passive: false });
  window.addEventListener('touchend', end);
  window.addEventListener('touchcancel', end);

  form.addEventListener('submit', (ev) => {
    if (!hasStroke) {
      ev.preventDefault();
      alert('Inserisci la firma nel riquadro prima di confermare.');
      return;
    }
    hidden.value = canvas.toDataURL('image/jpeg', 0.92);
  });

  window.addEventListener('resize', resizeCanvas);
  resizeCanvas();
})();
