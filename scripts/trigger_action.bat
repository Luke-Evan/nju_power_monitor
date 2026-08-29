@echo off
chcp 65001 >nul
cd /d %~dp0..
set TOKEN=%NJU_POWER_TOKEN%
if not defined TOKEN if exist .token set /p TOKEN=<.token
if not defined TOKEN (
  echo 未找到令牌：请设置环境变量 NJU_POWER_TOKEN，或在本目录放一个 .token 文件
  echo （经典 PAT，勾选 repo 权限；仅用于触发，不会入库）
  pause
  exit /b 1
)
set REPO=%GITHUB_REPO%
if not defined REPO set REPO=Luke-Evan/nju_power_monitor
echo 触发云端 Actions：%REPO% ...
curl -s -o nul -w HTTP %%{http_code} -X POST ^
  -H "Authorization: token %TOKEN%" ^
  -H "Accept: application/vnd.github+json" ^
  "https://api.github.com/repos/%REPO%/actions/workflows/auto_monitor_schedule.yml/dispatches" ^
  -d "{\"ref\":\"master\"}"
echo.
echo HTTP 204 = 触发成功，去 Actions 页面看运行
pause
