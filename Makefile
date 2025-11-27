SHELL := /bin/bash

.PHONY: install dev build
.PHONY: native-build-unix native-build-win native-copy
.PHONY: build-mac build-linux build-win

install:
	@echo "📦 安装 Node.js 依赖..."
	@pnpm install
	@echo "📦 安装 Python 依赖..."
	@if [ ! -d "native/.venv" ]; then \
		cd native && python3 -m venv .venv; \
	fi
	@if [ "$(OS)" = "Windows_NT" ]; then \
		cd native && source .venv/Scripts/activate && pip install -r requirements.txt; \
	else \
		cd native && source .venv/bin/activate && pip install -r requirements.txt; \
	fi

dev:
	@echo "🚀 启动开发服务器..."
	@pnpm run dev

native-build-unix:
	@echo "🔨 构建 Python 二进制 (Unix)..."
	@cd native/build && ./build.sh

native-build-win:
	@echo "🔨 构建 Python 二进制 (Windows)..."
	@cd native/build && pwsh -ExecutionPolicy Bypass -File build.ps1

native-copy:
	@echo "📦 复制 Python 二进制到 resources..."
	@mkdir -p resources/bin
	@cp -r native/dist/* resources/bin/

build-mac: native-build-unix native-copy
	@echo "🍎 构建 macOS 应用..."
	@pnpm run build:mac

build-linux: native-build-unix native-copy
	@echo "🐧 构建 Linux 应用..."
	@pnpm run build:linux

build-win: native-build-win native-copy
	@echo "🪟 构建 Windows 应用..."
	@pnpm run build:win
