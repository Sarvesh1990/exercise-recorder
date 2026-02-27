/**
 * Lightweight canvas-based chart renderer.
 * No external dependencies — draws directly on <canvas>.
 */
const ExerciseChart = (() => {
  const COLORS = {
    line: '#6c63ff',
    fill: 'rgba(108, 99, 255, 0.15)',
    grid: 'rgba(136, 136, 170, 0.15)',
    text: '#8888aa',
    dot: '#6c63ff',
    dotStroke: '#1a1a2e',
    accent: '#00d4aa',
  };

  function draw(canvas, data) {
    const ctx = canvas.getContext('2d');
    const dpr = window.devicePixelRatio || 1;
    const rect = canvas.getBoundingClientRect();
    canvas.width = rect.width * dpr;
    canvas.height = rect.height * dpr;
    ctx.scale(dpr, dpr);

    const W = rect.width;
    const H = rect.height;
    const PAD = { top: 20, right: 20, bottom: 50, left: 50 };
    const plotW = W - PAD.left - PAD.right;
    const plotH = H - PAD.top - PAD.bottom;

    ctx.clearRect(0, 0, W, H);

    if (!data || data.length === 0) {
      ctx.fillStyle = COLORS.text;
      ctx.font = '14px -apple-system, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('No data yet. Start recording!', W / 2, H / 2);
      return;
    }

    const weights = data.map(d => d.weight);
    const dates = data.map(d => new Date(d.created_at));

    const minW = Math.min(...weights);
    const maxW = Math.max(...weights);
    const range = maxW - minW || 1;
    const padRange = range * 0.1;
    const yMin = Math.max(0, minW - padRange);
    const yMax = maxW + padRange;
    const yRange = yMax - yMin;

    const minDate = dates[0].getTime();
    const maxDate = dates[dates.length - 1].getTime();
    const dateRange = maxDate - minDate || 1;

    function xPos(date) {
      return PAD.left + ((date.getTime() - minDate) / dateRange) * plotW;
    }

    function yPos(weight) {
      return PAD.top + plotH - ((weight - yMin) / yRange) * plotH;
    }

    // Grid lines
    ctx.strokeStyle = COLORS.grid;
    ctx.lineWidth = 1;
    const ySteps = 5;
    for (let i = 0; i <= ySteps; i++) {
      const val = yMin + (yRange / ySteps) * i;
      const y = yPos(val);
      ctx.beginPath();
      ctx.moveTo(PAD.left, y);
      ctx.lineTo(W - PAD.right, y);
      ctx.stroke();

      ctx.fillStyle = COLORS.text;
      ctx.font = '11px -apple-system, sans-serif';
      ctx.textAlign = 'right';
      ctx.fillText(val.toFixed(1), PAD.left - 8, y + 4);
    }

    // X labels
    ctx.textAlign = 'center';
    ctx.fillStyle = COLORS.text;
    ctx.font = '10px -apple-system, sans-serif';
    const maxLabels = Math.min(data.length, 7);
    const step = Math.max(1, Math.floor(data.length / maxLabels));
    for (let i = 0; i < data.length; i += step) {
      const x = xPos(dates[i]);
      ctx.fillText(formatDateShort(dates[i]), x, H - PAD.bottom + 20);
    }
    if (data.length > 1) {
      const lastX = xPos(dates[dates.length - 1]);
      ctx.fillText(formatDateShort(dates[dates.length - 1]), lastX, H - PAD.bottom + 20);
    }

    // Area fill gradient
    ctx.beginPath();
    ctx.moveTo(xPos(dates[0]), yPos(weights[0]));
    for (let i = 1; i < data.length; i++) {
      ctx.lineTo(xPos(dates[i]), yPos(weights[i]));
    }
    ctx.lineTo(xPos(dates[dates.length - 1]), PAD.top + plotH);
    ctx.lineTo(xPos(dates[0]), PAD.top + plotH);
    ctx.closePath();

    const gradient = ctx.createLinearGradient(0, PAD.top, 0, PAD.top + plotH);
    gradient.addColorStop(0, 'rgba(108, 99, 255, 0.25)');
    gradient.addColorStop(1, 'rgba(108, 99, 255, 0.02)');
    ctx.fillStyle = gradient;
    ctx.fill();

    // Line
    ctx.beginPath();
    ctx.strokeStyle = COLORS.line;
    ctx.lineWidth = 2.5;
    ctx.lineJoin = 'round';
    ctx.lineCap = 'round';
    ctx.moveTo(xPos(dates[0]), yPos(weights[0]));
    for (let i = 1; i < data.length; i++) {
      ctx.lineTo(xPos(dates[i]), yPos(weights[i]));
    }
    ctx.stroke();

    // Dots
    for (let i = 0; i < data.length; i++) {
      const x = xPos(dates[i]);
      const y = yPos(weights[i]);
      ctx.beginPath();
      ctx.arc(x, y, 4, 0, Math.PI * 2);
      ctx.fillStyle = COLORS.dot;
      ctx.fill();
      ctx.strokeStyle = COLORS.dotStroke;
      ctx.lineWidth = 2;
      ctx.stroke();
    }

    // Trend line (linear regression) if enough data
    if (data.length >= 3) {
      const n = data.length;
      const xVals = dates.map(d => d.getTime());
      const meanX = xVals.reduce((a, b) => a + b) / n;
      const meanY = weights.reduce((a, b) => a + b) / n;
      let num = 0, den = 0;
      for (let i = 0; i < n; i++) {
        num += (xVals[i] - meanX) * (weights[i] - meanY);
        den += (xVals[i] - meanX) ** 2;
      }
      const slope = num / (den || 1);
      const intercept = meanY - slope * meanX;

      ctx.beginPath();
      ctx.strokeStyle = COLORS.accent;
      ctx.lineWidth = 1.5;
      ctx.setLineDash([6, 4]);
      ctx.moveTo(PAD.left, yPos(slope * minDate + intercept));
      ctx.lineTo(W - PAD.right, yPos(slope * maxDate + intercept));
      ctx.stroke();
      ctx.setLineDash([]);
    }
  }

  function formatDateShort(date) {
    const m = date.toLocaleString('default', { month: 'short' });
    return `${m} ${date.getDate()}`;
  }

  function calcStats(data) {
    if (!data || data.length === 0) return null;
    const weights = data.map(d => d.weight);
    const max = Math.max(...weights);
    const latest = weights[weights.length - 1];
    const first = weights[0];
    const change = latest - first;
    return {
      max: max.toFixed(1),
      latest: latest.toFixed(1),
      change: (change >= 0 ? '+' : '') + change.toFixed(1),
      entries: data.length
    };
  }

  return { draw, calcStats };
})();
