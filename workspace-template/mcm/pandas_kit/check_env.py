# pandas 环境自检
#
# 第一次学 pandas 之前跑一次；以后每次换电脑、换 Python、报奇怪的错，也先跑它。
#
# 怎么运行：
#   在工作区根目录执行   python mcm/pandas_kit/check_env.py
#   或者在 VS Code 里直接点运行（脚本会自己找到数据在哪儿）
#
# 它只读文件，不改任何东西。

import sys
from pathlib import Path

try:
    sys.stdout.reconfigure(encoding="utf-8")
except Exception:
    pass

NEEDED = [
    "level1_contest_raw.csv",
    "level2_scores_raw.csv",
    "level2_teams_raw.csv",
    "practice_single.csv",
    "practice_info.csv",
    "exam_main.csv",
    "exam_info.csv",
]

HERE = Path(__file__).resolve().parent
missing = list(NEEDED)
ok_all = True


def find_root():
    """从脚本位置向上找，直到看见 mcm/pandas_kit/data 这个目录。"""
    cur = HERE
    while True:
        if (cur / "mcm" / "pandas_kit" / "data").is_dir():
            return cur
        if cur.parent == cur:
            return None
        cur = cur.parent


ROOT = find_root()


def report(no, name, value, ok, hints=()):
    global ok_all
    print("[%d/5] %-10s %-18s %s" % (no, name, value, "OK" if ok else "失败"))
    if not ok:
        ok_all = False
        for h in hints:
            if h:
                print("      -> " + h)


print("=" * 46)
print(" pandas 环境自检")
print("=" * 46)

# 1. Python 版本
v = sys.version_info
report(
    1,
    "Python 版本",
    "%d.%d.%d" % (v.major, v.minor, v.micro),
    (v.major, v.minor) >= (3, 10),
    [
        "Python 太旧了，需要 3.10 以上。",
        "去 python.org 下载新版，安装时勾选 Add Python to PATH。",
    ],
)

# 2. pandas
pandas_ver = None
try:
    import pandas as pd

    pandas_ver = pd.__version__
    pd_ok = True
except Exception:
    pd_ok = False
report(
    2,
    "pandas",
    pandas_ver or "未安装",
    pd_ok,
    [
        "在终端运行：python -m pip install pandas",
        "如果提示找不到 python，改用：py -m pip install pandas",
        "装完关掉终端重新打开，再跑一次这个文件。",
    ],
)

# 3. 数据文件
if ROOT is None:
    report(
        3,
        "数据文件",
        "找不到",
        False,
        [
            "脚本没找到 mcm/pandas_kit/data 这个文件夹。",
            "请确认教材目录没有被移动或删除。",
        ],
    )
else:
    data_dir = ROOT / "mcm" / "pandas_kit" / "data"
    missing = [n for n in NEEDED if not (data_dir / n).is_file()]
    report(
        3,
        "数据文件",
        "%d/%d" % (len(NEEDED) - len(missing), len(NEEDED)),
        not missing,
        ["缺少：" + ", ".join(missing), "重新解压一份教材目录，或找我要原始数据。"],
    )

# 4. 当前目录
cwd = Path.cwd()
if ROOT is not None and cwd == ROOT:
    cwd_label, cwd_ok = "工作区根", True
elif ROOT is not None and str(cwd).startswith(str(ROOT)):
    cwd_label, cwd_ok = "子目录", False
else:
    cwd_label, cwd_ok = "别的地方", False
report(
    4,
    "当前目录",
    cwd_label,
    cwd_ok,
    [
        "你现在的目录是：" + str(cwd),
        ("应该在：" + str(ROOT)) if ROOT else "",
        "先 cd 到工作区根目录再运行；或者在 VS Code 里直接点这个文件的运行按钮。",
    ],
)

# 5. 试读一次真实数据
if pd_ok and ROOT is not None and not missing:
    try:
        df = pd.read_csv(ROOT / "mcm" / "pandas_kit" / "data" / "level1_contest_raw.csv")
        report(5, "试读数据", str(df.shape), True)
    except Exception as e:
        report(5, "试读数据", "读不了", False, [str(e)[:120]])
else:
    report(5, "试读数据", "跳过", False, ["前面有项目没通过，先修上面的。"])

print("=" * 46)
if ok_all:
    print(" 环境正常，可以开始 Day 1。")
    print(" 打开 README.md，按「五、日程总表」走。")
else:
    print(" 先按上面的 -> 提示修好，再跑一次本文件。")
    print(" 修不好就把这一屏截图发我。")
print("=" * 46)
