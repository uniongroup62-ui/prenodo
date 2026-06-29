function dashboardReadJsonConfig(id){
  const el = document.getElementById(id);
  if (!el) return {};
  try {
    const parsed = JSON.parse(el.textContent || '{}');
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch (e) {
    return {};
  }
}

let perfChart = null;

const DASHBOARD_CONFIG = dashboardReadJsonConfig('dashboardPageConfig');
const PERF_RANGE = DASHBOARD_CONFIG.perfRange && typeof DASHBOARD_CONFIG.perfRange === 'object' ? DASHBOARD_CONFIG.perfRange : { from: '', to: '' };
const PERF_LOCATION_ID = String(DASHBOARD_CONFIG.locationId || '');

function fmtEUR(v){
  try{ return new Intl.NumberFormat('it-IT',{style:'currency',currency:'EUR'}).format(v||0); }
  catch(e){ return '€ ' + (v||0); }
}
function fmtNum(v){
  try{ return new Intl.NumberFormat('it-IT').format(v||0); }
  catch(e){ return String(v||0); }
}
function fmtHours(v){
  const n = Number(v||0);
  return (Math.round(n*10)/10).toString().replace('.', ',');
}
function setDelta(el, pct){
  if (pct === null || typeof pct === 'undefined'){
    el.className = 'small text-muted';
    el.textContent = '—';
    return;
  }
  const p = Number(pct);
  const sign = p > 0 ? '+' : '';
  const txt = sign + (Math.round(p*10)/10).toString().replace('.', ',') + '%';
  el.className = 'small ' + (p>0 ? 'text-success' : (p<0 ? 'text-danger' : 'text-muted'));
  el.textContent = txt;
}
function setPerfError(message){
  const el = document.getElementById('perfError');
  if (!el) return;
  if (!message){
    el.classList.add('d-none');
    el.textContent = '';
    return;
  }
  el.textContent = message;
  el.classList.remove('d-none');
}

async function loadPerformance(){
  const params = new URLSearchParams({page:'api_dashboard_performance', from: PERF_RANGE.from || '', to: PERF_RANGE.to || '', location_id: PERF_LOCATION_ID});

  setPerfError('');
  const res = await fetch('index.php?' + params.toString(), {headers:{'Accept':'application/json'}});
  let data = null;
  try {
    data = await res.json();
  } catch (err) {
    throw new Error('Statistiche settimanali non disponibili al momento.');
  }
  if (!res.ok || !data || !data.ok) throw new Error('Statistiche settimanali non disponibili al momento.');

  // KPIs
  document.getElementById('kpiAppt').textContent = fmtNum(data.kpis.appointments.value);
  document.getElementById('kpiRevenue').textContent = fmtEUR(data.kpis.revenue.value);
  document.getElementById('kpiHours').textContent = fmtHours(data.kpis.hours.value);
  document.getElementById('kpiNew').textContent = fmtNum(data.kpis.new_clients.value);

  setDelta(document.getElementById('kpiApptDelta'), data.kpis.appointments.delta_pct);
  setDelta(document.getElementById('kpiRevenueDelta'), data.kpis.revenue.delta_pct);
  setDelta(document.getElementById('kpiHoursDelta'), data.kpis.hours.delta_pct);
  setDelta(document.getElementById('kpiNewDelta'), data.kpis.new_clients.delta_pct);

  // Hint range
  document.getElementById('perfRangeHint').textContent = data.range.from.split('-').reverse().join('/') + ' - ' + data.range.to.split('-').reverse().join('/');

  // Chart
  const ctx = document.getElementById('perfChart');
  if (typeof Chart === 'undefined'){
    setPerfError('Grafico non disponibile al momento.');
    return;
  }
  if (perfChart) perfChart.destroy();
  const axisEUR = v => {
    try {
      return '\u20ac ' + new Intl.NumberFormat('it-IT', {maximumFractionDigits: 0}).format(Number(v || 0));
    } catch(e) {
      return '\u20ac ' + (v || 0);
    }
  };
  perfChart = new Chart(ctx, {
    type: 'line',
    data: {
      labels: data.series.labels,
      datasets: [{
        label: 'Ricavi',
        data: data.series.values,
        borderColor: '#2f63f4',
        backgroundColor: 'rgba(47,99,244,.08)',
        pointBackgroundColor: '#2f63f4',
        pointBorderColor: '#2f63f4',
        pointRadius: 2.5,
        pointHoverRadius: 4,
        borderWidth: 2.25,
        tension: 0.4,
        fill: true
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      interaction: { mode: 'index', intersect: false },
      plugins: {
        legend: { display: false },
        tooltip: {
          callbacks: {
            label: ctx => fmtEUR(ctx.parsed.y || 0)
          }
        }
      },
      scales: {
        x: {
          grid: { color: 'rgba(18,44,88,.09)', drawBorder: false },
          ticks: { color: '#405693' }
        },
        y: {
          beginAtZero: true,
          grid: { color: 'rgba(18,44,88,.11)', borderDash: [3, 4], drawBorder: false },
          ticks: { color: '#405693', padding: 10, callback: axisEUR }
        }
      }
    }
  });
}

// Initial load
loadPerformance().catch(err => {
  console.error(err);
  setPerfError(err.message || 'Statistiche settimanali non disponibili al momento.');
});
