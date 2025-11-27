#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
解析Telegram Bot深链并下载返回的资源
支持格式: https://t.me/BotUsername?start=参数

用法:
python bot_downloader.py "https://t.me/xxx?start=xxx" --out /Users/xxx/Downloads
"""

import argparse
import asyncio
import time
from pathlib import Path
from urllib.parse import urlparse, parse_qs
from textwrap import dedent

from telethon import TelegramClient
from telethon.errors import (
    UsernameInvalidError,
    UsernameNotOccupiedError,
    SessionPasswordNeededError,
    PhoneCodeInvalidError,
    PasswordHashInvalidError,
    FloodWaitError
)


async def custom_login(client):
    """
    自定义登录流程，确保所有提示都输出到 stdout
    """

    # 请求手机号
    print("Please enter your phone (or bot token): ", end="", flush=True)
    phone = input().strip()
    if not phone:
        print("❌ 手机号不能为空")
        return False
    try:
        print(f"📤 正在向 {phone} 发送验证码...")
        await client.send_code_request(phone)
        print("✅ 请在 Telegram 客户端中查看验证码")
    except FloodWaitError as e:
        print(f"❌ 请求过于频繁，请等待 {e.seconds} 秒后重试")
        return False
    except Exception as e:
        print(f"❌ 发送验证码失败: {e}")
        return False

    # 请求验证码
    print("Please enter the code you received: ", end="", flush=True)
    code = input().strip()
    if not code:
        print("❌ 验证码不能为空")
        return False
    try:
        # 尝试使用手机号和验证码登录
        await client.sign_in(phone, code)
        print("✅ 登录成功！")
        return True
    except SessionPasswordNeededError:
        # 需要两步验证密码
        print("Please enter your password: ", end="", flush=True)
        password = input().strip()
        if not password:
            print("❌ 密码不能为空")
            return False
        try:
            await client.sign_in(password=password)
            print("✅ 登录成功！")
            return True
        except PasswordHashInvalidError:
            print("❌ 密码错误")
            return False
    except PhoneCodeInvalidError:
        print("❌ 验证码错误")
        return False
    except Exception as e:
        print(f"❌ 登录失败: {e}")
        return False



def parse_bot_deeplink(url: str):
    """
    解析Bot深链
    格式: https://t.me/BotUsername?start=参数
    """
    u = urlparse(url)
    if u.netloc not in ("t.me", "telegram.me", "www.t.me", "www.telegram.me"):
        raise ValueError("请输入合法的 t.me 链接")

    parts = [p for p in u.path.split("/") if p]
    if len(parts) < 1:
        raise ValueError("链接路径不完整，缺少Bot用户名")

    # 获取Bot用户名
    bot_username = parts[0]
    if bot_username.startswith("@"):
        bot_username = bot_username[1:]

    # 检查是否有start参数
    query_params = parse_qs(u.query)
    start_param = None
    if 'start' in query_params:
        start_param = query_params['start'][0]
    else:
        raise ValueError("缺少start参数")

    return bot_username, start_param


def format_bytes(bytes_size):
    """格式化字节大小"""
    for unit in ['B', 'KB', 'MB', 'GB']:
        if bytes_size < 1024.0:
            return f"{bytes_size:.2f}{unit}"
        bytes_size /= 1024.0
    return f"{bytes_size:.2f}TB"


def format_speed(bytes_per_sec):
    """格式化下载速度"""
    return f"{format_bytes(bytes_per_sec)}/s"


def progress_callback(filename):
    """创建下载进度回调函数"""
    start_time = time.time()
    last_update_time = start_time
    last_downloaded = 0

    def callback(current, total):
        nonlocal last_update_time, last_downloaded

        # 每0.3秒更新一次，避免刷新太频繁
        now = time.time()
        if now - last_update_time < 0.3 and current < total:
            return

        # 计算进度百分比
        percent = (current / total) * 100 if total > 0 else 0

        # 计算速度
        elapsed = now - start_time
        if elapsed > 0:
            speed = current / elapsed
            speed_str = format_speed(speed)

            # 计算剩余时间
            if speed > 0 and current < total:
                remaining_bytes = total - current
                eta_seconds = int(remaining_bytes / speed)
                if eta_seconds < 60:
                    eta_str = f"剩余{eta_seconds}秒"
                else:
                    eta_minutes = eta_seconds // 60
                    eta_secs = eta_seconds % 60
                    eta_str = f"剩余{eta_minutes}分{eta_secs}秒"
            else:
                eta_str = ""
        else:
            speed_str = "计算中..."
            eta_str = ""

        # 生成进度条
        bar_length = 30
        filled_length = int(bar_length * current / total) if total > 0 else 0
        bar = '█' * filled_length + '░' * (bar_length - filled_length)

        # 构建进度信息（固定长度，避免残留字符）
        progress_line = f"[{bar}] {percent:5.1f}% | {format_bytes(current):>10}/{format_bytes(total):<10} | {speed_str:>12} | {eta_str:<15}"

        # 打印进度（使用特殊前缀 __PROGRESS__ 标记进度行）
        print(f"__PROGRESS__{progress_line}", flush=True)

        last_update_time = now
        last_downloaded = current

    return callback


async def download_media_messages(client, messages, base_dir: Path, start_index=0):
    """
    下载消息中的所有媒体文件
    图片保存到 images/ 文件夹，视频保存到 videos/ 文件夹
    """
    media_messages = []

    # 提取所有包含媒体的消息（排除自己发送的）
    for msg in messages:
        if msg.out:
            continue
        if msg.photo or msg.video or msg.document:
            media_messages.append(msg)

    if not media_messages:
        print("⚠️ 没有找到媒体消息")
        return 0

    # 按消息ID排序（从小到大，即时间正序）
    media_messages.sort(key=lambda m: m.id)

    # 创建图片和视频子目录
    images_dir = base_dir / "图片"
    videos_dir = base_dir / "视频"
    images_dir.mkdir(parents=True, exist_ok=True)
    videos_dir.mkdir(parents=True, exist_ok=True)

    print(f"\n开始下载 {len(media_messages)} 个媒体文件...")

    downloaded = 0
    for idx, msg in enumerate(media_messages, start=start_index + 1):
        try:
            # 确定文件类型和扩展名
            is_image = False
            is_video = False

            if msg.photo:
                ext = "jpg"
                media_type = "图片"
                is_image = True
            elif msg.video:
                ext = "mp4"
                media_type = "视频"
                is_video = True
            elif msg.document:
                # 从document中获取文件扩展名
                mime_type = msg.document.mime_type
                if mime_type.startswith("image/"):
                    ext = mime_type.split("/")[-1]
                    media_type = "图片"
                    is_image = True
                elif mime_type.startswith("video/"):
                    ext = mime_type.split("/")[-1]
                    media_type = "视频"
                    is_video = True
                else:
                    ext = mime_type.split("/")[-1] if "/" in mime_type else "bin"
                    media_type = "文件"
            else:
                continue

            # 确定保存目录
            if is_image:
                save_dir = images_dir
            elif is_video:
                save_dir = videos_dir
            else:
                save_dir = base_dir  # 其他类型文件保存在根目录

            # 生成临时文件名（用于下载）
            temp_filename = f"{idx:03d}.{ext}"
            temp_filepath = save_dir / temp_filename

            # 下载文件（带进度条）
            print(f"  [{idx}/{start_index + len(media_messages)}] 下载{media_type}: {temp_filename}")
            await client.download_media(
                msg,
                file=str(temp_filepath),
                progress_callback=progress_callback(temp_filename)
            )

            # 下载完成后重命名：毫秒时间戳_原始文件名
            timestamp = int(time.time() * 1000)  # 毫秒时间戳
            new_filename = f"{timestamp}_{temp_filename}"
            new_filepath = save_dir / new_filename

            # 重命名文件
            temp_filepath.rename(new_filepath)
            print(f"    ✓ 保存为: {new_filename}")

            downloaded += 1

        except Exception as e:
            print(f"  ❌ 下载失败 (消息ID: {msg.id}): {e}")
            continue

    return downloaded


async def find_next_page_button(messages, current_page):
    """
    查找下一页按钮
    返回按钮对象和回调数据
    优先查找▶️按钮，否则查找下一页页码按钮
    只返回最新消息的按钮
    """
    # 先按消息ID排序，最新的在前
    sorted_messages = sorted([m for m in messages if not m.out and m.buttons], key=lambda m: m.id, reverse=True)

    if not sorted_messages:
        return None, None

    # 只查找最新的有按钮的消息
    latest_msg = sorted_messages[0]

    next_arrow_btn = None
    next_page_btn = None
    next_page_number = str(current_page + 1)  # 目标页码

    # 遍历这个消息的所有按钮
    for row in latest_msg.buttons:
        for btn in row:
            # 检查按钮是否有回调数据（排除URL按钮）
            if not hasattr(btn, 'data') or not btn.data:
                continue

            # 检查回调数据是否包含分页信息（排除page_info）
            btn_data_str = btn.data.decode('utf-8') if isinstance(btn.data, bytes) else str(btn.data)

            # 排除page_info（这是当前页或信息按钮）
            if btn_data_str == 'page_info':
                continue

            # 优先查找"下一页"类按钮
            text = btn.text
            ARROW_TOKENS = ("▶️", "➡️")
            if any(tok in text for tok in ARROW_TOKENS):
                next_arrow_btn = btn

            # 查找下一页的页码按钮
            elif next_page_number in btn.text:
                next_page_btn = btn

    # 优先返回▶️按钮
    if next_arrow_btn:
        return latest_msg, next_arrow_btn

    # 其次返回下一页页码按钮
    if next_page_btn:
        return latest_msg, next_page_btn

    return None, None


async def interact_with_bot(client, bot_username, start_param, out_dir: Path, max_pages=100):
    """
    与Bot交互，发送start命令并下载所有返回的媒体资源
    """
    try:
        # 获取Bot实体
        print(f"🤖 连接Bot: @{bot_username}")
        bot_entity = await client.get_entity(bot_username)

        # 记录发送命令前的最新消息ID
        old_messages = await client.get_messages(bot_entity, limit=1)
        last_msg_id_before = old_messages[0].id if old_messages else 0

        # 发送/start命令（带参数）
        command = f"/start {start_param}"
        print(f"📤 发送命令: {command}")

        # 发送消息
        await client.send_message(bot_entity, command)

        # 等待Bot回复
        print("⏳ 等待Bot回复...")
        await asyncio.sleep(5)

        total_downloaded = 0
        current_page = 1
        downloaded_msg_ids = set()  # 记录已下载的消息ID，避免重复

        # 如果max_pages为0，表示不限制页数
        unlimited = (max_pages == 0)

        # 循环处理所有页面
        while unlimited or current_page <= max_pages:
            print(f"\n{'='*60}")
            print(f"📄 处理第 {current_page} 页")
            print(f"{'='*60}")

            # 获取最近的消息（只获取新消息）
            messages = await client.get_messages(bot_entity, limit=50)

            # 只处理本次对话的新消息
            new_messages = [msg for msg in messages if msg.id > last_msg_id_before and msg.id not in downloaded_msg_ids]

            if not new_messages:
                print("⚠️ 没有新消息")
                break

            # 记录这些消息的媒体ID
            for msg in new_messages:
                if msg.photo or msg.video or msg.document:
                    downloaded_msg_ids.add(msg.id)

            # 下载当前页的媒体
            downloaded = await download_media_messages(
                client,
                new_messages,
                out_dir,
                start_index=total_downloaded
            )
            total_downloaded += downloaded

            print(f"✅ 第 {current_page} 页完成，已下载 {downloaded} 个文件")

            # 查找下一页按钮
            msg_with_btn, next_btn = await find_next_page_button(new_messages, current_page)

            if not next_btn or not msg_with_btn:
                print("\n✅ 没有更多页面了")
                break

            # 点击下一页按钮
            print(f"\n🔘 点击按钮: {next_btn.text}")
            await msg_with_btn.click(data=next_btn.data)

            # 等待新内容加载
            print("⏳ 等待加载...")
            await asyncio.sleep(4)

            current_page += 1

        print(f"\n{'='*60}")
        print(f"🎉 下载完成！")
        print(f"📊 总计下载: {total_downloaded} 个文件")
        print(f"📁 保存位置: {out_dir}")
        print(f"{'='*60}")

    except (UsernameInvalidError, UsernameNotOccupiedError):
        print(f"❌ 找不到Bot: @{bot_username}")
        raise
    except Exception as e:
        print(f"❌ 错误: {e}")
        import traceback
        traceback.print_exc()
        raise


async def main():
    parser = argparse.ArgumentParser(
        description="解析Telegram Bot深链并下载返回的资源",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog=dedent("""
            示例用法:
              python scripts/bot_downloader.py "https://t.me/ZywjaBotBot?start=55a59508" --out /Users/mtzzhw/Downloads
              python scripts/bot_downloader.py "https://t.me/ZywjaBotBot?start=55a59508" --out ./downloads --max-pages 3
        """)
    )
    parser.add_argument("url", help="Bot深链URL，格式: https://t.me/BotUsername?start=参数")
    parser.add_argument("--api-id", required=True, help="Telegram API ID")
    parser.add_argument("--api-hash", required=True, help="Telegram API Hash")
    parser.add_argument("--out", default="downloads", help="输出目录 (默认: downloads)")
    parser.add_argument("--session", default="downloader", help="会话文件名 (默认: downloader)")
    parser.add_argument("--session-dir", default=None, help="会话文件目录 (默认: 脚本所在目录)")
    parser.add_argument("--max-pages", type=int, default=100, help="最大翻页次数 (默认: 100，设为0表示不限制)")

    args = parser.parse_args()

    api_id = args.api_id
    api_hash = args.api_hash

    # 解析深链
    try:
        bot_username, start_param = parse_bot_deeplink(args.url)
        print(f"✅ 解析成功:")
        print(f"  - Bot用户名: @{bot_username}")
        print(f"  - Start参数: {start_param}")
        print(f"  - 输出目录: {args.out}")
        print(f"  - 最大页数: {args.max_pages}")
    except ValueError as e:
        print(f"❌ 链接解析失败: {e}")
        return

    # 创建输出目录结构: 输出目录/机器人名/start参数/
    out_dir = Path(args.out) / bot_username / start_param
    out_dir.mkdir(parents=True, exist_ok=True)

    print(f"  - 保存路径: {out_dir}")

    # 创建Telegram客户端
    # 确保session文件路径是绝对路径
    if args.session_dir:
        session_path = Path(args.session_dir) / args.session
    else:
        # 默认放在脚本所在目录
        script_dir = Path(__file__).parent
        session_path = script_dir / args.session

    # 确保 session 目录存在
    session_path.parent.mkdir(parents=True, exist_ok=True)

    client = TelegramClient(str(session_path), int(api_id), api_hash)

    try:
        await client.connect()

        # 确保已登录
        if not await client.is_user_authorized():
            print("⚠️ 需要登录，请按提示操作...")
            success = await custom_login(client)
            if not success:
                print("❌ 登录失败")
                return

        # 与Bot交互并下载资源
        await interact_with_bot(client, bot_username, start_param, out_dir, args.max_pages)
    finally:
        if client.is_connected():
            client.disconnect()


if __name__ == "__main__":
    asyncio.run(main())
