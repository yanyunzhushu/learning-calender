@echo off
setlocal
chcp 65001 >nul
cd /d "%~dp0"
if errorlevel 1 goto directory_error

where node >nul 2>nul
if errorlevel 1 goto node_missing

node scripts\serve.mjs
set "CALENDAR_EXIT_CODE=%ERRORLEVEL%"
if not "%CALENDAR_EXIT_CODE%"=="0" if not defined CI pause
exit /b %CALENDAR_EXIT_CODE%

:node_missing
echo 未找到 Node.js，请安装受支持的 Node.js LTS（最低 20.9.0）。
echo 安装后重新打开此启动入口；首次使用请在项目目录运行 pnpm install。
if not defined CI pause
exit /b 1

:directory_error
echo 无法打开项目目录，请将项目解压到本机有写入权限的文件夹。
if not defined CI pause
exit /b 1
