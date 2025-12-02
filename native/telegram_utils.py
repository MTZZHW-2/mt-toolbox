#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Telegram 工具函数
包含登录、下载进度显示等通用功能
"""

import time
from telethon.errors import (
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
