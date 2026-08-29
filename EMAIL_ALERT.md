# 📧 邮件推送配置指南

余额低于阈值时，Actions 可以自动发送提醒邮件，正文内嵌近 20 次电量曲线图。

## 工作原理

- 每次采集后，云端读取 `config_workflow.json` 的三档阈值与当前余额比较；
- 触发后经 SMTP 发信（凭据来自 Secrets），内嵌 `recent_20_changes.png`；
- 与页面阈值**独立**：页面弹层的单阈值只是个人视觉覆盖，不影响邮件。

## 1. 配置 SMTP Secrets

仓库 Settings → Secrets and variables → Actions → New repository secret，共 6 项：

| Secret | 说明 | 示例 |
|---|---|---|
| `EMAIL_SMTP_HOST` | SMTP 服务器 | `smtp.qq.com` / `smtp.163.com` / `smtp.gmail.com` |
| `EMAIL_SMTP_PORT` | 端口 | `465` |
| `EMAIL_SMTP_USER` | 发件邮箱 | `xxx@qq.com` |
| `EMAIL_SMTP_PASSWORD` | **SMTP 授权码**（不是邮箱登录密码） | 16 位字符串 |
| `EMAIL_FROM` | 发件人地址（通常同 USER） | `xxx@qq.com` |
| `EMAIL_TO` | 收件人，多个用英文逗号分隔 | `a@qq.com,b@163.com` |

> 💡 **可以发给自己**：把 `EMAIL_SMTP_USER`、`EMAIL_FROM`、`EMAIL_TO` 填成同一个地址即可
> （QQ/163 要求 FROM 与 USER 一致；自己发自己不会被判垃圾邮件）。

### 授权码获取

- [**QQ 邮箱**](https://wx.mail.qq.com/list/readtemplate?name=app_intro.html#/agreement/authorizationCode)：网页版 → 设置 → 账户 → IMAP/SMTP 服务 → 开启 → 短信验证生成授权码；
- **163 邮箱**：设置 → POP3/SMTP → 开启并设置客户端授权密码；
- **Gmail**：需开启两步验证后生成「应用专用密码」。

## 2. 开关与阈值

编辑 `config_workflow.json` 后 push：

```json
"enable_email_alert": true,
"alert_threshold_warn": 15,
"alert_threshold_high": 10,
"alert_threshold_critical": 5
```

三档对应邮件的提醒/重要/紧急分级；想关邮件把 `enable_email_alert` 设 `false`。

> ⚠️ **与页面阈值的关系**：本文件 **alert_threshold_warn** 值会经 stats.py 同步为网页的**默认**预警阈值
>
> 网页「设置房间」里改的阈值只存浏览器、覆盖默认值。邮件**始终**按本文件三档判断，不受网页设置影响。

## 常见问题

- **只有文字没有图**：数据首日未生成 `recent_20_changes.png`，属正常，次日恢复；
- **SMTP 连接失败**：465 对应 SSL；QQ/163 必须用授权码而非登录密码；
- **没收到邮件**：确认 `enable_email_alert` 为 true、余额确实低于阈值、检查垃圾邮件箱。
