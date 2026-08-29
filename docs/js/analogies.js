/* 耗电量直观类比（移植自 nju-power-watch，MIT；二轮改进：统一表/打分算法/fallback 标记）。
 *
 * 选择算法（selectBestAnalogy）：
 *   对每个非 fallback 条目计算 value = kwh * factor，
 *   取 |log10(value) - 1.5| 最小者（即数值最接近"两位数量级"、最像人话的类比），
 *   同分按表顺序。kwh<=0 返回首条；全部不可用时返回 fallback 条目。
 *   旧版"范围区间首匹配"已废弃（区间重叠导致死条目），表中不再保留 range 字段。
 */

/* 统一类比表：{icon, label, unit, factor(=1度电换算值), desc, fallback?} */
var ANALOGY_TABLE = [
  { icon: '💧', label: '可烧开的水', unit: '升',   factor: 10,  desc: '相当于用电热水壶烧开这些水' },
  { icon: '💡', label: 'LED灯照明',  unit: '小时', factor: 100, desc: '可点亮10W LED灯持续照明' },
  { icon: '📱', label: '手机充满电', unit: '次',   factor: 67,  desc: '可为智能手机完整充电' },
  { icon: '💻', label: '笔记本工作', unit: '小时', factor: 20,  desc: '可供笔记本电脑持续工作' },
  { icon: '❄️', label: '空调制冷',   unit: '小时', factor: 1,   desc: '可供1.5匹空调运行' },
  { icon: '🧺', label: '洗衣机洗衣', unit: '次',   factor: 2,   desc: '可用洗衣机洗衣服' },
  { icon: '🚲', label: '电动车骑行', unit: '公里', factor: 50,  desc: '可骑行电动自行车行驶' },
  { icon: '🪵', label: '木材燃烧',   unit: 'kg',  factor: 0.22, desc: '相当于燃烧木材释放的能量', fallback: true }
];

var ANALOGY_TARGET_LOG = 1.5;

function selectBestAnalogy(kwh) {
  if (!kwh || kwh <= 0) return ANALOGY_TABLE[0];
  var best = null;
  var bestScore = Infinity;
  for (var i = 0; i < ANALOGY_TABLE.length; i++) {
    var e = ANALOGY_TABLE[i];
    if (e.fallback) continue;
    var value = kwh * e.factor;
    if (value <= 0) continue;
    var score = Math.abs(Math.log10(value) - ANALOGY_TARGET_LOG);
    if (score < bestScore - 1e-12) { bestScore = score; best = e; }
  }
  if (best) return best;
  for (var j = 0; j < ANALOGY_TABLE.length; j++) {
    if (ANALOGY_TABLE[j].fallback) return ANALOGY_TABLE[j];
  }
  return ANALOGY_TABLE[0];
}

/* 全量类比列表（由统一表派生，供需要多项展示的场景使用） */
function getConsumptionDescriptions(kwh) {
  if (!kwh || kwh <= 0) return [];
  return ANALOGY_TABLE
    .filter(function (e) { return !e.fallback; })
    .map(function (e) {
      return {
        icon: e.icon,
        title: e.label,
        value: (kwh * e.factor).toFixed(1) + ' ' + e.unit,
        desc: e.desc
      };
    });
}

/* 主类比卡轮换：打分升序取 top-N，按日期数 % N 确定性选择（同一日期永远同一类比）。
 * 表为数据驱动：新增类别只需向 ANALOGY_TABLE 加一行对象，打分/轮换/测试自动纳入。 */
var ROTATION_CANDIDATES = 4;

function pickRotationAnalogy(kwh, dateStr) {
  if (!kwh || kwh <= 0) return ANALOGY_TABLE[0];
  var scored = [];
  for (var i = 0; i < ANALOGY_TABLE.length; i++) {
    var e = ANALOGY_TABLE[i];
    if (e.fallback) continue;
    var value = kwh * e.factor;
    if (value <= 0) continue;
    scored.push({ e: e, s: Math.abs(Math.log10(value) - ANALOGY_TARGET_LOG) });
  }
  scored.sort(function (a, b) { return a.s - b.s; });
  var n = Math.min(ROTATION_CANDIDATES, scored.length);
  if (!n) return ANALOGY_TABLE[0];
  var day = parseInt(String(dateStr).replace(/-/g, ''), 10) || 0;
  return scored[day % n].e;
}