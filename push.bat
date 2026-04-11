@echo off
:: 设置 UTF-8 编码以支持中文
chcp 65001 > nul
cls

echo ================================================
echo   WikitDB 同步工具启动中...
echo ================================================

:: 1. 检查是否在 Git 仓库目录
if not exist ".git" (
    echo [错误] 当前文件夹不是 Git 仓库，请确保在项目根目录运行。
    echo.
    pause
    exit /b
)

:: 2. 检查 Git 是否已安装
where git >nul 2>nul
if %errorlevel% neq 0 (
    echo [错误] 系统找不到 Git 命令，请确保已安装 Git 并配置了环境变量。
    echo.
    pause
    exit /b
)

:: 3. 调用 PowerShell 脚本
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0sync.ps1"

:: 4. 如果 PowerShell 报错，在这里停下
if %errorlevel% neq 0 (
    echo.
    echo [警告] 同步过程似乎遇到了问题 (错误码: %errorlevel%)
    echo 请检查上方的报错信息。
)

echo.
echo 脚本执行完毕，按任意键关闭窗口...
pause > nul
