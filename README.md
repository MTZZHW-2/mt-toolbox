# MT工具箱

一系列工具合集

## 开发

```bash
pnpm run dev
```

## 预编译

打包前，先执行 start 命令，预览打包后的情况，更早发现问题。

```bash
make native-build-<os> native-copy
pnpm run start
```

## 构建

```bash
make build-<os>
```

## macOS 下载后提示“已损坏/无法验证开发者”的处理

因 CI 产物未签名/未公证，macOS 从浏览器下载的 DMG 会带有隔离标记（com.apple.quarantine），首次打开可能提示“已损坏/无法验证开发者”。可通过移除隔离标记来打开：

```zsh
# 对下载的 DMG（安装之前）
xattr -dr com.apple.quarantine ~/Downloads/<文件名>.dmg

# 或安装后对 App 目录
xattr -dr com.apple.quarantine "/Applications/MT工具箱.app"
```
