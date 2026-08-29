# ⚡ nju_power_monitor · 南大宿舍电费监控

监控南京大学宿舍电费余额的自动化工具：每天定时采集一次，静态网站可视化，余额不足自动提醒。
单房间、零服务器、全托管在 GitHub。

> 📱💻 **部署完成后，手机或电脑浏览器打开 Pages 网址即可立刻查看**——余额、趋势、预警一目了然，
> 不用装任何软件、不用开电脑跑服务，收藏链接随时看。

本页面界面设计借鉴自 <a href="https://github.com/Chen-Rong-Zi/nju-power-watch" target="_blank" rel="noopener">nju-power-watch</a>（MIT 协议）, 本项目数据采集继承自 <a href="https://github.com/Nanxzi/nju_electric_monitor" target="_blank" rel="noopener">nju_electric_monitor</a>（MIT 协议）

## 功能

**触发（执行都在云端 Actions）**

- ⏰ **定时触发**：cron 每日 21:00（北京）自动运行，无需干预
- 🔌 **手动触发**：`scripts\trigger_action.bat` 或 Actions 页 Run workflow，充值后想立刻看就用它

**采集**

- 🤖 **自动采集**：Selenium 登录 epay 查询余额（ddddocr 验证码 + AI 滑块识别）
- 💾 **数据回传**：`electricity_data.csv` + `stats.json`（指标/日级序列）随每次运行提交回仓库

**查看**

- 🌐 **GitHub Pages**：`docs/` 为站点根，每次采集后自动更新，手机随时看，不用开电脑
- 🖥️ **本地面板**：`src/web_panel.py` 纯标准库静态服务器，零依赖启动

**面板功能**

- 📊 **数据可视化**：余额徽章、统计四卡（日均/本周/预计可用/最低）、7/30/全部趋势图、充值建议
- ⚠️ **电量预警**：页面徽章/预警卡按阈值变色脉冲
- ⚙️ **阈值说明**：网页「设置房间」里改的阈值只影响当前浏览器前端展示、覆盖默认值
  - `config_workflow.json` 的三档阈值会经 stats.py 同步将 **warn** 作为网页的默认预警阈值
  - 邮件告警始终用 config 的三档，不受网页设置影响
  （邮件配置见 [EMAIL_ALERT.md](EMAIL_ALERT.md)）
- 💡 **耗电类比**：把"度"换算成烧水/手机充电/空调等直观描述，按日轮换不重样
- 🏠 **房间名仅用于展示**：「设置房间」里填的房间号/校区/楼栋只存在当前浏览器（localStorage），
  仅用于页面显示，**不参与数据查询**
   - 据始终来自 Secrets 凭据对应 epay 账号所绑定的宿舍（即你在 epay 里自己设置的那间）
   - 换浏览器、或换URL（ `127.0.0.1` 与 `localhost` 算两个URL），都需各设置一次

## 架构

```
┌─────────────────────────┐        ┌──────────────────────────┐
│      触发① 定时          │        │      触发② 手动           │
│  cron 每日 21:00（北京） │        │  trigger_action.bat /    │
│    自动运行，无需干预     │        │  Actions 页 Run workflow │
└────────────┬────────────┘        └──────────────────────────┘
             └─────────────────┬────────────────┘
                               ↓
                  ┌─────────────────────────┐
                  │      GitHub Actions     │
                  │  Selenium 爬虫登录 epay  │
                  │  → electricity_data.csv │
                  │  → stats.json 指标构建   │
                  │  → 提交 data/docs 回仓库 │
                  └───────────┬─────────────┘
              ┌───────────────┴───────────────┐
              ↓                               ↓
┌─────────────────────────┐        ┌─────────────────────────┐
│   查看① GitHub Pages    │         │     查看② 本地面板       │
│   docs/ 为站点根         │        │  web_panel.py 静态服务器 │
│   每次采集后自动更新      │        │  http://127.0.0.1:8000  │
│   手机随时看，不用开电脑  │        │  纯标准库，零依赖         │
└─────────────────────────┘        └─────────────────────────┘
```

- 两种触发都在 GitHub runner 上执行、使用仓库 Secrets，本地零凭据零依赖；
- 两种查看使用对应的静态前端（`docs/`），数据源为 `docs/data/stats.json`。

## 目录结构

```
.github/workflows/auto_monitor_schedule.yml   采集调度 + 提交 + artifact
src/            爬虫主脚本 / 包装器 / stats 构建器 / 本地面板服务器 / PIL 补丁
docs/           静态面板（Pages 站点根）+ docs/data/（stats.json、CSV 副本）
data/           electricity_data.csv（唯一入库数据）
scripts/        trigger_action.bat（触发云端）、test_analogies.mjs（类比回归测试）
config_workflow.json   阈值/邮件/重试配置（凭据空白，凭据走 Secrets）
```

## 使用方法

### 1. Fork 项目

GitHub 打开本仓库 → 右上 **Fork** → 复制一份到你自己的账号（后续 Secrets/Pages 都配在你 fork 出的仓库里）。

### 2. 克隆到本地

```powershell
git clone https://github.com/your-username/nju_power_monitor.git
cd nju_power_monitor
```

> 💡 **不想要我的历史数据？** 可直接清空 `data/electricity_data.csv`（保留表头行 `time,num,unit`）
> 及 `docs/data/` 下的 stats.json 与 CSV 副本。**修改后记得 push**——云端与 Pages 才会以清空后的状态运行，
> 数据从下次采集起自动积累。

### 3. 获取 GIT_UPDATE_TOKEN

workflow 运行后要把数据推回仓库，需要一个有写权限的 token：

1. GitHub 右上头像 → **Settings** → 左侧最底部 **Developer settings** → **Personal access tokens** → **Fine-grained tokens** → **Generate new token**；
2. Token name 随意，设有效期建议**No expiration**，仓库访问权限选择 **Only select repositories** 再选择自己fork的**对应仓库**；
3. 权限使用 
   - Actions -- read and write
   - Contents -- read and write
   - Metadata -- read‑only
   - Pages -- read‑only
   - Workflows -- read and write
4. 点 Generate，**立即复制**（只显示这一次）；建议存到仓库根目录 `.token` 文件（已 .gitignore，不会公开，用于`scripts\trigger_action.bat` 自动读取，方便本地触发）；

### 4. 配置 Secrets

**仓库** Settings → Secrets and variables → Actions → New repository secret：

| Secret | 用途 | 必需 |
|---|---|---|
| `NJU_USERNAME` | 统一认证学号 | ✅ |
| `NJU_PASSWORD` | 统一认证密码 | ✅ |
| `GIT_UPDATE_TOKEN` | 上一步的 token | ✅ |

### 5. 启用 Pages

Settings → Pages → Deploy from a branch → `main` / `/docs` → Save；约 1 分钟后访问 `https://<用户名>.github.io/<仓库名>/`。

> ✨ **手机、电脑打开同一个网址都能立刻看到**，建议加入书签；每次采集后页面自动更新，无需任何本地操作。

### 6. 邮件预警（可选）

SMTP 授权码、六项 Secrets、阈值与排障见 [EMAIL_ALERT.md](EMAIL_ALERT.md)。

### 7. 手动补数据（可选）

往**根目录** `data/electricity_data.csv` 追加一行 `时间,数值,度`（如 `2026-08-28T21:00:00,1512.1,度`）。

> ⚠️ **一定要改根目录的 `data/electricity_data.csv`，不要改 `docs/data/`！**
> `docs/data/` 下的 CSV 副本和 stats.json 是**生成物**：运行 `stats.py` 时会从根 CSV 重新生成并覆盖它们，
> 手动编辑 docs 副本会在下次运行后丢失。

补完后重跑生成，push 后线上同步：

```powershell
uv run --no-project python src\stats.py
```

每日代表点 = 当日最后一条记录；消耗 = 相邻日代表点之差。
## 本地使用

```powershell
# ① 看面板（零依赖）
uv run --no-project python src\web_panel.py              # 默认端口 8000 → http://127.0.0.1:8000
uv run --no-project python src\web_panel.py 9000         # 参数换端口 → http://127.0.0.1:9000

# ② 手动触发云端采集
scripts\trigger_action.bat      # token 读自第三步保存的根目录 .token 文件或自行设置 NJU_POWER_TOKEN 环境变量
```

## 隐私与安全

- 仓库**不含任何凭据**：学号密码只存在于 Secrets；`config_workflow.json` 凭据字段空白；
- 入库数据仅电量余额，不含个人信息；`logs/`、调试图 均被 .gitignore 挡在库外。

## 许可

- 本项目以 [MIT](LICENSE) 许可发布

## 免责声明

非官方项目，仅供个人学习研究；请遵守南京大学相关规定，凭据仅用于查询本人宿舍，勿高频请求。
