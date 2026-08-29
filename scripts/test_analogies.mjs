/* 类比算法回归测试：node scripts/test_analogies.mjs */
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const code = readFileSync(path.join(root, 'docs', 'js', 'analogies.js'), 'utf8');
const api = new Function(code + '\nreturn { selectBestAnalogy, getConsumptionDescriptions, ANALOGY_TABLE };')();

const cases = [
  [0.03, 'LED灯照明'],
  [0.4, '手机充满电'],
  [1, '笔记本工作'],
  [3.2, '可烧开的水'],
  [5.76, '可烧开的水'],
  [9.77, '洗衣机洗衣'],
  [25, '空调制冷'],
  [100, '空调制冷']
];
let fail = 0;
for (const [k, label] of cases) {
  const got = api.selectBestAnalogy(k).label;
  if (got !== label) { console.error('FAIL selectBestAnalogy(' + k + ') -> ' + got + ', expected ' + label); fail = 1; }
}
if (api.selectBestAnalogy(0).label !== '可烧开的水') { console.error('FAIL kwh=0'); fail = 1; }
if (api.selectBestAnalogy(null).label !== '可烧开的水') { console.error('FAIL kwh=null'); fail = 1; }
if (api.getConsumptionDescriptions(1).length !== 7) { console.error('FAIL list length'); fail = 1; }
if (!api.ANALOGY_TABLE.some(e => e.fallback)) { console.error('FAIL no fallback entry'); fail = 1; }
// 所有非 fallback 条目都应能被某个 kwh 选中（无死条目）
for (const e of api.ANALOGY_TABLE.filter(x => !x.fallback)) {
  let reachable = false;
  for (let k = 0.001; k <= 10000 && !reachable; k *= 1.02) {
    if (api.selectBestAnalogy(k).label === e.label) reachable = true;
  }
  if (!reachable) { console.error('FAIL dead entry: ' + e.label); fail = 1; }
}
if (fail) process.exit(1);
console.log('analogies tests OK (' + cases.length + ' cases + edge + reachability)');
