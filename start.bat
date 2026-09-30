@echo off
rem Linux 学练营 本地启动脚本（ESM 必须走 HTTP，不能双击 index.html）
cd /d "%~dp0"
echo 正在启动 Linux 学练营： http://localhost:8080  （Ctrl+C 停止）
start "" http://localhost:8080
npx --yes serve -l 8080 .
