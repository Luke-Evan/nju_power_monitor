/* 渲染层：只 fetch data/stats.json 并渲染，不计算指标。
 * 数据契约见 specs/001-room-view-redesign/spec.md。
 */
(function () {
  'use strict';
  var CONFIG_KEY = 'electricity_user_config_room';
  var STATS = null;
  var chart = null;
  var chartRecs = [];
  var currentRange = 7;

  function $(id) { return document.getElementById(id); }

  function loadConfig() {
    try { return JSON.parse(localStorage.getItem(CONFIG_KEY)) || null; } catch (e) { return null; }
  }

  function fmt(v, d) {
    if (v === null || v === undefined || isNaN(v)) return '--';
    return Number(v).toFixed(d);
  }

  function fmtDate(d) {
    return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
  }

  function thresholds() {
    var base = (STATS && STATS.thresholds) || { warn: 15, high: 10, critical: 5 };
    var t = { warn: base.warn, high: base.high, critical: base.critical };
    var cfg = loadConfig();
    if (cfg && cfg.thresholds) {
      ['warn', 'high', 'critical'].forEach(function (k) {
        var v = parseFloat(cfg.thresholds[k]);
        if (!isNaN(v)) t[k] = v;
      });
    }
    return t;
  }

  // ---- 类比：原页范围匹配算法 ----
  function bestAnalogy(kwh) {
    if (typeof selectBestAnalogy !== 'function') return null;
    if (kwh === null || kwh === undefined || kwh <= 0) return null;
    return selectBestAnalogy(kwh);
  }

  function setAnalogyTooltip(cardId, kwh, dateStr) {
    var tip = $(cardId + '-tooltip');
    var val = $(cardId + '-analogy');
    if (!tip || !val) return;
    var a = (dateStr && typeof pickRotationAnalogy === 'function') ? pickRotationAnalogy(kwh, dateStr) : bestAnalogy(kwh);
    if (!a) { tip.style.display = 'none'; return; }
    var icon = tip.querySelector('.tooltip-icon');
    if (icon) icon.textContent = a.icon;
    val.textContent = (kwh * a.factor).toFixed(1) + ' ' + a.unit + ' · ' + a.desc;
    tip.style.display = '';
  }

  function renderHero() {
    var cfg = loadConfig();
    var def = (STATS && STATS.room_default) || {};
    $('room-name').textContent = (cfg && cfg.room) || def.room || '--';
    $('room-campus').textContent = (cfg && cfg.campus) || def.campus || '--';
    $('room-building').textContent = (cfg && cfg.building) || def.building || '--';
    var b = STATS ? STATS.current_balance : null;
    $('current-balance').textContent = (b === null || b === undefined) ? '--度' : fmt(b, 1) + '度';
  }

  // ---- 两态阈值反应（单阈值；样式类用原页设计系统） ----
  function renderAlertState() {
    var b = STATS ? STATS.current_balance : null;
    var th = thresholds();
    var badge = $('current-balance');
    var icon = $('predict-icon');
    var pcard = $('predict-card');
    var note = $('predict-note');
    badge.classList.remove('level-warn', 'level-high', 'level-critical', 'pulse');
    pcard.classList.remove('danger-card', 'pulse');
    icon.className = 'prediction-icon info';
    icon.textContent = '✅';
    note.textContent = '';
    if (b !== null && b !== undefined && b < th.warn) {
      badge.classList.add('level-critical', 'pulse');
      pcard.classList.add('danger-card', 'pulse');
      icon.className = 'prediction-icon danger';
      icon.textContent = '🚨';
      note.textContent = '，请尽快充值';
    }
  }

  function renderStats() {
    var s = (STATS && STATS.stats) || {};
    $('stat-avg').textContent = fmt(s.avg_daily_7d, 1) + '度';
    $('stat-week').textContent = fmt(s.week_consumption, 1) + '度';
    $('stat-days').textContent =
      (s.days_remaining === null || s.days_remaining === undefined) ? '--' : s.days_remaining + '天';
    $('stat-min').textContent = fmt(STATS && STATS.min_balance, 1) + '度';
    var lastDay = ((STATS && STATS.daily) || []).slice(-1)[0];
    setAnalogyTooltip('stat-avg', s.avg_daily_7d, lastDay ? lastDay.date : null);
    setAnalogyTooltip('stat-week', s.week_consumption);
  }

  function renderPrediction() {
    var s = (STATS && STATS.stats) || {};
    $('predict-days').textContent =
      (s.days_remaining === null || s.days_remaining === undefined) ? '--' : s.days_remaining;
    $('predict-date').textContent = s.depletion_date ? s.depletion_date.replace(/-/g, '/') : '--';
    $('predict-avg').textContent = fmt(s.avg_daily_7d, 1);
    var w = s.wow_change_pct;
    $('predict-change').textContent =
      (w === null || w === undefined) ? '--' : (w > 0 ? '+' : '') + Math.round(w) + '%';
  }

  // ---- 主类比卡：移植原页 updateMainAnalogy ----
  function renderAnalogy() {
    var s = (STATS && STATS.stats) || {};
    var tc = s.today_consumption;
    var card = $('main-analogy-card');
    card.style.display = '';
    if (tc === null || tc === undefined) {
      $('main-analogy-icon').textContent = '❓';
      $('main-analogy-value').textContent = '--';
      $('main-analogy-label').textContent = '暂无数据';
      $('main-analogy-consumption').textContent = '--';
      $('main-analogy-extra').textContent = ' · 前一日数据暂缺，无法计算今日耗电';
      return;
    }
    var lastDay = ((STATS && STATS.daily) || []).slice(-1)[0];
    var a = (typeof pickRotationAnalogy === 'function' && lastDay) ? pickRotationAnalogy(tc, lastDay.date) : bestAnalogy(tc);
    if (!a) return;
    $('main-analogy-icon').textContent = a.icon;
    $('main-analogy-value').textContent = (tc * a.factor).toFixed(1) + ' ' + a.unit;
    $('main-analogy-label').textContent = a.label;
    $('main-analogy-consumption').textContent = tc.toFixed(2);
    $('main-analogy-extra').textContent = ' · ' + a.desc;
  }

  function renderRecharge() {
    var wrap = $('recharge-options');
    wrap.innerHTML = '';
    ((STATS && STATS.recharge) || []).forEach(function (r) {
      var d = document.createElement('div');
      d.className = 'recharge-option';
      var days = (r.days === null || r.days === undefined) ? '--' : '约用 ' + r.days + ' 天';
      d.innerHTML = '<div class="recharge-amount">' + r.amount + '度</div>' +
        '<div class="recharge-days">' + days + '</div>';
      wrap.appendChild(d);
    });
  }

  // ---- 趋势图：三幅图统一日级序列（每日一点=21点档），原页同款实现 ----
  function chartRecords() {
    var daily = (STATS && STATS.daily) || [];
    if (currentRange === 'all') return daily;
    return daily.slice(-currentRange);
  }

  function renderChart() {
    chartRecs = chartRecords();
    var labels = chartRecs.map(function (r) { return r.date.slice(5); });
    var data = chartRecs.map(function (r) { return r.end_balance; });
    var canvas = $('trend-chart');
    if (!canvas || typeof Chart === 'undefined') return;
    if (chart) {
      chart.data.labels = labels;
      chart.data.datasets[0].data = data;
      chart.update();
      return;
    }
    chart = new Chart(canvas, {
      type: 'line',
      data: {
        labels: labels,
        datasets: [{
          label: '电量余额',
          data: data,
          borderColor: '#10b981',
          backgroundColor: 'rgba(16, 185, 129, 0.1)',
          fill: true,
          tension: 0.4,
          pointRadius: 0,
          pointHoverRadius: 6
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        interaction: { mode: 'index', intersect: false },
        plugins: {
          legend: { display: false },
          tooltip: {
            backgroundColor: '#1a1a1a',
            titleFont: { family: 'system-ui', size: 14, weight: '600' },
            bodyFont: { family: 'monospace', size: 13 },
            padding: 16,
            displayColors: false,
            layout: { padding: 8 },
            callbacks: {
              title: function (items) {
                return '📅 ' + chartRecs[items[0].dataIndex].date;
              },
              label: function (ctx) {
                var r = chartRecs[ctx.dataIndex];
                var c = (r.consumption === null || r.consumption === undefined) ? 0 : r.consumption;
                return ['余额: ' + r.end_balance.toFixed(1) + ' 度', '消耗: ' + c.toFixed(2) + ' 度'];
              },
              afterBody: function (items) {
                var r = chartRecs[items[0].dataIndex];
                var c = r.consumption;
                if (c && c > 0) {
                  var a = (typeof pickRotationAnalogy === 'function')
                    ? pickRotationAnalogy(c, r.date)
                    : (typeof selectBestAnalogy === 'function' ? selectBestAnalogy(c) : null);
                  var v = (c * a.factor).toFixed(1);
                  return ['', '💡 直观感受:', a.icon + ' ' + v + ' ' + a.unit + ' · ' + a.label];
                }
                return '';
              }
            }
          }
        },
        scales: {
          x: {
            grid: { display: false },
            ticks: { font: { family: 'monospace', size: 11 } }
          },
          y: {
            grid: { color: 'rgba(0,0,0,0.05)' },
            ticks: { font: { family: 'monospace', size: 11 } }
          }
        }
      }
    });
  }
  function renderAll() {
    renderHero();
    renderAlertState();
    renderStats();
    renderPrediction();
    renderAnalogy();
    renderRecharge();
    renderChart();
    var loading = $('initial-loading');
    if (loading) loading.classList.add('hidden');
  }

  // ---- 设置面板：级联选择器（列表内置，无搜索） ----
  function lists() { return (typeof ROOM_LISTS === 'undefined') ? {} : ROOM_LISTS; }

  function fillSelect(sel, items, placeholder) {
    sel.innerHTML = '';
    var o0 = document.createElement('option');
    o0.value = '';
    o0.textContent = placeholder;
    sel.appendChild(o0);
    (items || []).forEach(function (it) {
      var o = document.createElement('option');
      o.value = it;
      o.textContent = it;
      sel.appendChild(o);
    });
  }

  function refreshBuildings(keep) {
    var c = $('config-campus').value;
    var bSel = $('config-building');
    var rSel = $('config-room');
    var bs = c ? Object.keys(lists()[c] || {}) : [];
    if (!c || !bs.length) {
      fillSelect(bSel, [], '请先选择校区'); bSel.disabled = true;
      fillSelect(rSel, [], '请先选择楼栋'); rSel.disabled = true;
      return;
    }
    fillSelect(bSel, bs, '请选择楼栋'); bSel.disabled = false;
    if (keep && bs.indexOf(keep) >= 0) bSel.value = keep;
    refreshRooms($('config-room').value);
  }

  function refreshRooms(keep) {
    var c = $('config-campus').value;
    var b = $('config-building').value;
    var rSel = $('config-room');
    var rs = (c && b) ? (lists()[c] || {})[b] || [] : [];
    if (!b || !rs.length) {
      fillSelect(rSel, [], '请先选择楼栋'); rSel.disabled = true;
      return;
    }
    fillSelect(rSel, rs, '请选择房间'); rSel.disabled = false;
    if (keep && rs.indexOf(keep) >= 0) rSel.value = keep;
  }

  function showConfig() {
    var cfg = loadConfig() || {};
    var base = (STATS && STATS.thresholds) || { warn: 15, high: 10, critical: 5 };
    fillSelect($('config-campus'), Object.keys(lists()), '请选择校区');
    if (cfg.campus && lists()[cfg.campus]) $('config-campus').value = cfg.campus;
    refreshBuildings(cfg.building);
    if (cfg.room) refreshRooms(cfg.room);
    var th = (cfg && cfg.thresholds) || {};
    $('config-th-warn').value = th.warn !== undefined ? th.warn : '';
    $('config-th-warn').placeholder = base.warn;
    $('config-overlay').classList.add('show');
    $('config-panel').classList.add('show');
  }

  function hideConfig() {
    $('config-overlay').classList.remove('show');
    $('config-panel').classList.remove('show');
  }

  function saveConfig() {
    var cfg = {
      room: $('config-room').value,
      campus: $('config-campus').value,
      building: $('config-building').value,
      thresholds: {}
    };
    var wv = parseFloat($('config-th-warn').value);
    if (!isNaN(wv)) cfg.thresholds.warn = wv;
    localStorage.setItem(CONFIG_KEY, JSON.stringify(cfg));
    hideConfig();
    renderAll();
  }

  // ---- 事件 ----
  document.addEventListener('DOMContentLoaded', function () {
    $('btn-config').addEventListener('click', showConfig);
    $('config-overlay').addEventListener('click', hideConfig);
    $('btn-save-config').addEventListener('click', saveConfig);
    $('config-campus').addEventListener('change', function () { refreshBuildings(); });
    $('config-building').addEventListener('change', function () { refreshRooms(); });
    Array.prototype.forEach.call(document.querySelectorAll('[data-range]'), function (btn) {
      btn.addEventListener('click', function () {
        Array.prototype.forEach.call(document.querySelectorAll('[data-range]'), function (b) {
          b.classList.remove('active');
        });
        btn.classList.add('active');
        var r = btn.getAttribute('data-range');
        currentRange = (r === 'all') ? 'all' : parseInt(r, 10);
        renderChart();
      });
    });

    fetch('data/stats.json', { cache: 'no-store' })
      .then(function (r) { if (!r.ok) throw new Error('http ' + r.status); return r.json(); })
      .then(function (s) { STATS = s; renderAll(); })
      .catch(function () { STATS = null; renderAll(); });
  });
})();
