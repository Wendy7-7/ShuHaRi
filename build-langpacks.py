# 语言包构建：从 portable 全量目录按语言切分出独立 zip（GitHub Releases 分发用）
# 用法: portable/Runtime/python/python.exe build-langpacks.py
import json
import os
import sys
import zipfile

BASE = os.path.dirname(os.path.abspath(__file__))
PORTABLE = os.path.join(BASE, "portable")
BANK = os.path.join(PORTABLE, "workspace", "bank")
MCM = os.path.join(PORTABLE, "workspace", "mcm")
OUT = os.path.join(BASE, "release", "v1.5.0", "langpacks")
os.makedirs(OUT, exist_ok=True)

PACKS = [
    {
        "id": "c-cpp",
        "name": "C / C++",
        "langs": ["c", "cpp"],
        "bank_prefixes": ["c-", "cpp-"],
        "runtime": ["w64devkit"],
        "workspace_dirs": [],
        "desc": "MinGW-w64 编译器（gcc/g++），静态链接判题",
    },
    {
        "id": "python",
        "name": "Python + 数据科学",
        "langs": ["python"],
        "bank_prefixes": ["py-", "mcm-", "mpl-", "st-"],
        "runtime": ["python"],
        "workspace_dirs": ["mcm"],
        "desc": "Python 3.13 + pandas/matplotlib/scipy/numpy，含美赛 pandas/统计/绘图模块与数据集",
    },
    {
        "id": "java",
        "name": "Java",
        "langs": ["java"],
        "bank_prefixes": ["j-"],
        "runtime": ["jdk"],
        "workspace_dirs": [],
        "desc": "JDK 21，Main 入口类判题",
    },
    {
        "id": "go",
        "name": "Go",
        "langs": ["go"],
        "bank_prefixes": ["go-"],
        "runtime": ["go"],
        "workspace_dirs": [],
        "desc": "Go 1.23，go run 判题",
    },
    {
        "id": "node",
        "name": "JavaScript (Node.js)",
        "langs": ["javascript"],
        "bank_prefixes": ["js-"],
        "runtime": ["node"],
        "workspace_dirs": [],
        "desc": "Node 22，直接运行判题",
    },
]


def add_dir(zf, src_dir, arc_root):
    n = 0
    for root, _dirs, files in os.walk(src_dir):
        for f in files:
            full = os.path.join(root, f)
            rel = os.path.relpath(full, src_dir).replace("\\", "/")
            zf.write(full, f"{arc_root}/{rel}")
            n += 1
    return n


def main():
    for p in PACKS:
        name = f"langpack-{p['id']}.zip"
        out_path = os.path.join(OUT, name)
        if os.path.exists(out_path):
            os.remove(out_path)
        manifest = {
            "spec_version": 1,
            "id": p["id"],
            "name": p["name"],
            "version": "1.0.0",
            "runtime_dirs": p["runtime"],
            "bank_langs": p["langs"],
            "description": p["desc"],
        }
        with zipfile.ZipFile(out_path, "w", zipfile.ZIP_DEFLATED, compresslevel=6) as zf:
            zf.writestr("manifest.json", json.dumps(manifest, ensure_ascii=False, indent=2))
            files = 0
            for d in p["runtime"]:
                src = os.path.join(PORTABLE, "Runtime", d)
                if os.path.isdir(src):
                    files += add_dir(zf, src, f"runtime/{d}")
            for pre in p["bank_prefixes"]:
                for f in sorted(os.listdir(BANK)):
                    if f.startswith(pre) and f.endswith(".json"):
                        zf.write(os.path.join(BANK, f), f"bank/{f}")
                        files += 1
            for wd in p["workspace_dirs"]:
                src = os.path.join(os.path.dirname(BANK), wd)
                if os.path.isdir(src):
                    files += add_dir(zf, src, f"workspace/{wd}")
        size_mb = os.path.getsize(out_path) / 1024 / 1024
        print(f"{name}: {size_mb:.0f}MB, {files} files")
    print("DONE")


if __name__ == "__main__":
    sys.exit(main())
