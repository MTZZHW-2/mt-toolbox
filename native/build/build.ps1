# 使用 PyInstaller 打包为独立可执行文件

$ErrorActionPreference = "Stop"

Write-Host "🚀 开始打包脚本..." -ForegroundColor Green

Set-Location $PSScriptRoot\..

$scriptsFile = "build\targets.txt"

if (-not (Test-Path $scriptsFile)) {
    Write-Host "❌ 配置文件不存在: $scriptsFile" -ForegroundColor Red
    exit 1
}

$scripts = @()

Get-Content $scriptsFile | ForEach-Object {
    $line = $_.Trim()

    # 跳过空行和注释
    if ($line -and -not $line.StartsWith("#")) {
        if (Test-Path $line) {
            $scripts += $line
        } else {
            Write-Host "⚠️  脚本不存在,跳过: $line" -ForegroundColor Yellow
        }
    }
}

if ($scripts.Count -eq 0) {
    Write-Host "❌ 没有找到要打包的脚本" -ForegroundColor Red
    exit 1
}

Write-Host "📋 将打包 $($scripts.Count) 个脚本: $($scripts -join ', ')" -ForegroundColor Cyan
Write-Host ""

# 虚拟环境目录
$venvDir = ".venv"

# 检查并创建虚拟环境
if (-not (Test-Path $venvDir)) {
    Write-Host "📦 创建 Python 虚拟环境..." -ForegroundColor Cyan
    python -m venv $venvDir
}

# 激活虚拟环境
Write-Host "🔌 激活虚拟环境..." -ForegroundColor Cyan
& "$venvDir\Scripts\Activate.ps1"

# 安装依赖
Write-Host "📦 安装依赖..." -ForegroundColor Cyan
pip install -q pyinstaller
pip install -q -r requirements.txt

# 检测平台架构
$arch = $env:PROCESSOR_ARCHITECTURE
$platform = switch ($arch) {
    "AMD64"  { "windows-x64" }
    default  {
        Write-Host "❌ 不支持的处理器架构: $arch" -ForegroundColor Red
        exit 1
    }
}

Write-Host ""
Write-Host "🔨 打包平台: $platform" -ForegroundColor Cyan
Write-Host ""

# 清理旧的构建文件
if (Test-Path dist) {
    Remove-Item -Recurse -Force dist
}

if (Test-Path build) {
    Get-ChildItem build -Recurse | Where-Object {
        $_.Extension -notin @('.sh', '.txt', '.ps1')
    } | Remove-Item -Recurse -Force
}

# 打包每个脚本
$successCount = 0
$failCount = 0

foreach ($script in $scripts) {
    $scriptBase = [System.IO.Path]::GetFileNameWithoutExtension($script)
    $binaryName = "$scriptBase-$platform"

    Write-Host "🔨 打包 $script -> $binaryName.exe" -ForegroundColor Cyan

    $result = pyinstaller `
        --onefile `
        --name $binaryName `
        --distpath dist `
        --workpath build `
        --specpath build `
        --collect-all telethon `
        $script 2>&1

    if ($LASTEXITCODE -eq 0) {
        Write-Host "✅ $script 打包成功" -ForegroundColor Green
        $successCount++
    } else {
        Write-Host "❌ $script 打包失败" -ForegroundColor Red
        $failCount++
    }

    Write-Host ""
}

Write-Host ""
Write-Host "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━" -ForegroundColor Gray
Write-Host "📊 打包统计:" -ForegroundColor Cyan
Write-Host "  成功: $successCount" -ForegroundColor Green
Write-Host "  失败: $failCount" -ForegroundColor $(if ($failCount -gt 0) { "Red" } else { "Gray" })
Write-Host "  总计: $($scripts.Count)" -ForegroundColor Cyan
Write-Host ""
Write-Host "📦 输出目录: dist\" -ForegroundColor Cyan

if (Test-Path dist) {
    Get-ChildItem dist | Format-Table Name, Length, LastWriteTime -AutoSize
}

# 如果有失败的脚本,返回退出码
if ($failCount -gt 0) {
    exit 1
}
