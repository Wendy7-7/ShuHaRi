# 组装基础包 zip：exe + 工作区模板 + 便携标记 + 双语说明
# 用法: python scripts/build-base.py <exe路径> <输出zip路径> [版本号]
# 本地（portable 版 python）和 CI（系统 python）通用，无第三方依赖。
import os
import sys
import zipfile

# CI/控制台编码非 UTF-8 时 print 中文会抛 UnicodeEncodeError（GitHub Actions 踩过）
try:
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")
    sys.stderr.reconfigure(encoding="utf-8", errors="replace")
except Exception:
    pass

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))


def main():
    if len(sys.argv) < 3:
        print("用法: python scripts/build-base.py <exe> <out.zip> [version]")
        return 1
    exe, out = sys.argv[1], sys.argv[2]
    version = sys.argv[3] if len(sys.argv) > 3 else "dev"
    if not os.path.exists(exe):
        print(f"exe 不存在: {exe}")
        return 1

    # CI 上 release/ 不存在，zipfile 不会自动建目录
    out_dir = os.path.dirname(os.path.abspath(out))
    if out_dir:
        os.makedirs(out_dir, exist_ok=True)

    tpl = os.path.join(ROOT, "workspace-template")
    manual = os.path.join(ROOT, "assets", "使用说明.txt")
    if not os.path.isdir(tpl):
        print("workspace-template 缺失")
        return 1

    with zipfile.ZipFile(out, "w", zipfile.ZIP_DEFLATED, compresslevel=6) as z:
        z.write(exe, "learn-platform.exe")
        z.writestr(".portable", "")  # 便携标记：数据落 exe 同目录 Data/
        if os.path.exists(manual):
            z.write(manual, "使用说明.txt")
        count = 0
        for base, _dirs, files in os.walk(tpl):
            for f in files:
                full = os.path.join(base, f)
                rel = os.path.relpath(full, tpl).replace("\\", "/")
                z.write(full, "workspace/" + rel)
                count += 1
    size = os.path.getsize(out) / 1024 / 1024
    print(f"基础包已生成: {out} ({size:.1f}MB, 工作区文件 {count} 个, 版本 {version})")
    return 0


if __name__ == "__main__":
    sys.exit(main())
