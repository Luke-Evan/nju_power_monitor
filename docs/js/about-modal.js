/**
 * 「关于」弹层。内容占位：在 ABOUT_HTML 中写你的项目经历。
 * 复用 config-overlay / config-panel 样式。
 */
var ABOUT_HTML = [
  '<h3 class="config-title">关于本项目</h3>',
  '<p style="color: var(--muted); font-size: 14px; line-height: 1.8;">',
  '项目地址：<a href="https://github.com/Luke-Evan/nju_power_monitor" target="_blank" rel="noopener">github.com/Luke-Evan/nju_power_monitor</a><br>',
  '数据由 GitHub Actions 每日 21 点自动采集一次。',
  '</p>'
].join('');

function openAboutModal() {
  var overlay = document.getElementById('about-overlay');
  if (!overlay) {
    overlay = document.createElement('div');
    overlay.id = 'about-overlay';
    overlay.className = 'config-overlay';
    overlay.onclick = closeAboutModal;
    var panel = document.createElement('div');
    panel.id = 'about-panel';
    panel.className = 'config-panel';
    panel.innerHTML = ABOUT_HTML +
      '<button class="btn btn-primary" style="width: 100%; margin-top: 8px;" onclick="closeAboutModal()">关闭</button>';
    document.body.appendChild(overlay);
    document.body.appendChild(panel);
  }
  overlay.classList.add('show');
  document.getElementById('about-panel').classList.add('show');
}

function closeAboutModal() {
  var o = document.getElementById('about-overlay');
  var p = document.getElementById('about-panel');
  if (o) o.classList.remove('show');
  if (p) p.classList.remove('show');
}
