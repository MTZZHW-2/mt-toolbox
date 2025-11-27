#!/bin/bash

# 使用 PyInstaller 打包为独立可执行文件

set -e

echo "🚀 开始打包脚本..."

cd "$(dirname "$0")/.."

SCRIPTS=()
SCRIPTS_FILE="build/targets.txt"

if [ ! -f "$SCRIPTS_FILE" ]; then
    echo "❌ 配置文件不存在: $SCRIPTS_FILE"
    exit 1
fi

while IFS= read -r line || [ -n "$line" ]; do
    line=$(echo "$line" | xargs)
    [[ -z "$line" || "$line" =~ ^# ]] && continue

    if [ ! -f "$line" ]; then
        echo "⚠️  脚本不存在,跳过: $line"
        continue
    fi

    SCRIPTS+=("$line")
done < "$SCRIPTS_FILE"

if [ ${#SCRIPTS[@]} -eq 0 ]; then
    echo "❌ 没有找到要打包的脚本"
    exit 1
fi

echo "📋 将打包 ${#SCRIPTS[@]} 个脚本: ${SCRIPTS[*]}"
echo ""

# 虚拟环境目录
VENV_DIR=".venv"

# 检查并创建虚拟环境
if [ ! -d "$VENV_DIR" ]; then
    echo "📦 创建 Python 虚拟环境..."
    python3 -m venv "$VENV_DIR"
fi

# 激活虚拟环境
echo "🔌 激活虚拟环境..."
source "$VENV_DIR/bin/activate"

# 安装依赖
echo "📦 安装依赖..."
pip install -q pyinstaller
pip install -q -r requirements.txt

# 检测平台
OS=$(uname -s)
ARCH=$(uname -m)

case "$OS" in
    Darwin)
        if [ "$ARCH" = "arm64" ]; then
            PLATFORM="macos-arm64"
        else
            PLATFORM="macos-x64"
        fi
        ;;
    Linux)
        PLATFORM="linux-x64"
        ;;
    *)
        echo "❌ 不支持的操作系统: $OS"
        exit 1
        ;;
esac

echo ""
echo "🔨 打包平台: $PLATFORM"
echo ""

# 清理旧的构建文件
rm -rf dist
if [ -d "build" ]; then
    find build -mindepth 1 ! -name '*.sh' ! -name '*.txt' ! -name '*.ps1' -delete 2>/dev/null || true
fi

# 打包每个脚本
SUCCESS_COUNT=0
FAIL_COUNT=0

for script in "${SCRIPTS[@]}"; do
    SCRIPT_BASE=$(basename "$script" .py)
    BINARY_NAME="${SCRIPT_BASE}-${PLATFORM}"

    echo "🔨 打包 $script -> $BINARY_NAME"

    if pyinstaller \
        --onefile \
        --name "$BINARY_NAME" \
        --distpath dist \
        --workpath build \
        --specpath build \
        --collect-all telethon \
        "$script" > /dev/null 2>&1; then

        echo "✅ $script 打包成功"
        SUCCESS_COUNT=$((SUCCESS_COUNT + 1))
    else
        echo "❌ $script 打包失败"
        FAIL_COUNT=$((FAIL_COUNT + 1))
    fi

    echo ""
done

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "📊 打包统计:"
echo "  成功: $SUCCESS_COUNT"
echo "  失败: $FAIL_COUNT"
echo "  总计: ${#SCRIPTS[@]}"
echo ""
echo "📦 输出目录: dist/"
[ -d "dist" ] && ls -lh dist/ | grep -v "^total"

# 如果有失败的脚本,返回退出码
if [ $FAIL_COUNT -gt 0 ]; then
    exit 1
fi
