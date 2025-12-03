#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
下载Telegram话题(Topic)中的媒体资源
支持格式: https://t.me/ChannelUsername/TopicID

用法:
python topic_downloader.py "https://t.me/xxx/xxx" --out /Users/xxx/Downloads --api-id YOUR_API_ID --api-hash YOUR_API_HASH
"""

import argparse
import asyncio
import time
from pathlib import Path
from urllib.parse import urlparse
from textwrap import dedent

from telethon import TelegramClient
from telethon.errors import (
    ChannelPrivateError,
    ChatAdminRequiredError
)
from telethon.tl.types import Channel

from telegram_utils import custom_login, progress_callback


def parse_topic_link(url: str):
    """
    解析话题链接
    格式: https://t.me/ChannelUsername/TopicID
    """
    u = urlparse(url)
    if u.netloc not in ("t.me", "telegram.me", "www.t.me", "www.telegram.me"):
        raise ValueError("请输入合法的 t.me 链接")

    parts = [p for p in u.path.split("/") if p]

    # 处理公开频道链接: /ChannelUsername/TopicID
    if len(parts) >= 2:
        channel_username = parts[0]
        if channel_username.startswith("@"):
            channel_username = channel_username[1:]

        try:
            topic_id = int(parts[1])
            return channel_username, topic_id
        except ValueError:
            raise ValueError("话题ID必须是数字")

    raise ValueError("链接格式不正确，应为 https://t.me/ChannelUsername/TopicID")


async def download_media_from_message(client, message, base_dir: Path, index: int):
    """
    下载单个消息中的媒体文件
    图片保存到 images/ 文件夹，视频保存到 videos/ 文件夹
    """
    try:
        # 确定文件类型和扩展名
        is_image = False
        is_video = False

        if message.photo:
            ext = "jpg"
            media_type = "图片"
            is_image = True
        elif message.video:
            ext = "mp4"
            media_type = "视频"
            is_video = True
        elif message.document:
            # 从document中获取文件扩展名
            mime_type = message.document.mime_type
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
            return False

        # 确定保存目录
        if is_image:
            save_dir = base_dir / "图片"
        elif is_video:
            save_dir = base_dir / "视频"
        else:
            save_dir = base_dir  # 其他类型文件保存在根目录

        save_dir.mkdir(parents=True, exist_ok=True)

        # 生成临时文件名（用于下载）
        temp_filename = f"{index:03d}.{ext}"
        temp_filepath = save_dir / temp_filename

        # 下载文件（带进度条）
        print(f"  [{index}] 下载{media_type}: {temp_filename}")
        await client.download_media(
            message,
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

        return True

    except Exception as e:
        print(f"  ❌ 下载失败 (消息ID: {message.id}): {e}")
        return False


async def download_topic_media(
    client,
    channel_username: str,
    topic_id: int,
    out_dir: Path
):
    """
    下载指定话题中的所有媒体资源

    Args:
        channel_username: 频道用户名
        topic_id: 话题ID
        out_dir: 输出目录
    """
    try:
        # 获取频道实体
        print(f"🔍 连接频道: @{channel_username}")
        channel_entity = await client.get_entity(channel_username)

        # 验证是否是频道
        if not isinstance(channel_entity, Channel):
            print("❌ 提供的链接不是一个频道")
            return

        channel_title = getattr(channel_entity, 'title', '未知频道')
        print(f"✅ 已连接到频道: {channel_title}")

        # 获取话题中的所有消息
        print(f"📄 获取话题 {topic_id} 的消息...")

        messages = []
        offset_id = 0
        batch_size = 100  # 每次获取的消息数量

        while True:
            # 获取一批消息（使用reply_to参数指定话题ID）
            batch = await client.get_messages(
                channel_entity,
                limit=batch_size,
                offset_id=offset_id,
                reply_to=topic_id
            )

            if not batch:
                break

            messages.extend(batch)

            # 如果这批消息数量小于batch_size，说明已经获取完毕
            if len(batch) < batch_size:
                break

            # 更新offset_id为最后一条消息的ID
            offset_id = batch[-1].id

            print(f"  已获取 {len(messages)} 条消息...")

        print(f"✅ 共获取到 {len(messages)} 条消息")

        # 过滤出包含媒体的消息
        media_messages = [
            msg for msg in messages
            if msg.photo or msg.video or msg.document
        ]

        if not media_messages:
            print("⚠️ 话题中没有找到媒体文件")
            return

        print(f"📦 找到 {len(media_messages)} 条包含媒体的消息")

        # 按消息ID排序（从小到大，即时间正序）
        media_messages.sort(key=lambda m: m.id)

        # 开始下载
        print(f"\n{'='*60}")
        print(f"开始下载媒体文件...")
        print(f"{'='*60}\n")

        downloaded_count = 0
        for idx, msg in enumerate(media_messages, start=1):
            if await download_media_from_message(client, msg, out_dir, idx):
                downloaded_count += 1

        print(f"\n{'='*60}")
        print(f"🎉 下载完成！")
        print(f"📊 总计下载: {downloaded_count}/{len(media_messages)} 个文件")
        print(f"📁 保存位置: {out_dir}")
        print(f"{'='*60}")

    except ChannelPrivateError:
        print("❌ 这是一个私有频道，您没有访问权限")
        raise
    except ChatAdminRequiredError:
        print("❌ 您需要管理员权限才能访问此话题")
        raise
    except Exception as e:
        print(f"❌ 错误: {e}")
        import traceback
        traceback.print_exc()
        raise


async def main():
    parser = argparse.ArgumentParser(
        description="下载Telegram话题(Topic)中的媒体资源",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog=dedent("""
            示例用法:
              python topic_downloader.py "https://t.me/xxx/xxx" --out /Users/xxx/Downloads --api-id YOUR_API_ID --api-hash YOUR_API_HASH
        """)
    )
    parser.add_argument("url", help="话题链接，格式: https://t.me/ChannelUsername/TopicID")
    parser.add_argument("--api-id", required=True, help="Telegram API ID")
    parser.add_argument("--api-hash", required=True, help="Telegram API Hash")
    parser.add_argument("--out", default="downloads", help="输出目录 (默认: downloads)")
    parser.add_argument("--session", default="downloader", help="会话文件名 (默认: downloader)")
    parser.add_argument("--session-dir", default=None, help="会话文件目录 (默认: 脚本所在目录)")

    args = parser.parse_args()

    api_id = args.api_id
    api_hash = args.api_hash

    # 解析话题链接
    try:
        channel_username, topic_id = parse_topic_link(args.url)
        print(f"✅ 解析成功:")
        print(f"  - 频道用户名: @{channel_username}")
        print(f"  - 话题ID: {topic_id}")
        print(f"  - 输出目录: {args.out}")
    except ValueError as e:
        print(f"❌ 链接解析失败: {e}")
        return

    # 创建输出目录结构: 输出目录/频道用户名/话题ID/
    out_dir = Path(args.out) / channel_username / str(topic_id)
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

        # 下载话题中的媒体资源
        await download_topic_media(
            client,
            channel_username,
            topic_id,
            out_dir
        )

    finally:
        if client.is_connected():
            client.disconnect()


if __name__ == "__main__":
    asyncio.run(main())
