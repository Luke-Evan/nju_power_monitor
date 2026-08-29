#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""本地静态服务器：服务 docs/ 目录（纯标准库，参考 nju-power-watch 的 serve_docs.py）。

用法: python src/web_panel.py [port]   或设置环境变量 PORT（默认 8000）
"""
import http.server
import os
import socketserver
import sys
import webbrowser
from pathlib import Path

DOCS_DIR = Path(__file__).resolve().parent.parent / "docs"


class Handler(http.server.SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=str(DOCS_DIR), **kwargs)

    def end_headers(self):
        # 本地测试不缓存，保证每次拿到最新 stats.json
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Methods", "GET")
        self.send_header("Cache-Control", "no-store, no-cache, must-revalidate")
        super().end_headers()


def main():
    port = int(sys.argv[1]) if len(sys.argv) > 1 else int(os.environ.get("PORT", "8000"))
    if not (DOCS_DIR / "index.html").exists():
        print(f"[web_panel] 未找到 {DOCS_DIR / 'index.html'}")
        return 1
    print(f"Web 面板地址: http://127.0.0.1:{port}/")
    try:
        webbrowser.open(f"http://127.0.0.1:{port}/")
    except Exception:
        pass
    socketserver.TCPServer.allow_reuse_address = True
    with socketserver.TCPServer(("127.0.0.1", port), Handler) as httpd:
        try:
            httpd.serve_forever()
        except KeyboardInterrupt:
            print("\n[web_panel] 已停止")
    return 0


if __name__ == "__main__":
    sys.exit(main())
