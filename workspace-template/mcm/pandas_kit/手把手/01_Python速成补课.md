# 第 1 课：Python 速成补课（只补 pandas 用得上的部分）

你说之前学的可能忘了，那我们从零捡起。**这一课不讲任何用不上的语法**，目标是让你读得懂后面每一行 pandas。

---

## 1.1 变量：给东西起名字

```python
a = 88
name = "XJTLU"
df = 100
```

`=` 不是"等于"，是**"把右边的东西装进左边的名字里"**。

```python
a = 88
a = 90
print(a)     # 90，旧的被覆盖了
```

判断相等要用两个等号：

```python
print(a == 90)    # True
print(a == 88)    # False
```

**这是新手最常犯的错之一：把 `if a = 90` 写成赋值。**

---

## 1.2 四种常见数据类型

```python
88          # int，整数
88.5        # float，小数
"缺考"      # str，文本，必须有引号
True        # bool，只有 True 和 False 两个值
```

还有一个特殊的：`None`，表示"什么都没有"。pandas 里的缺失值显示为 `NaN`。

**文本和数字不能混着算：**

```python
print("88" + "76")     # 8876  ← 文本拼接，不是加法！
print(88 + 76)         # 164
print("88" * 2)        # 8888
```

**这就是为什么 Score 列里有"缺考"两个字会出大问题**：整列被当成文本，求平均根本无从谈起。

查看类型：

```python
print(type(88))       # <class 'int'>
print(type("88"))     # <class 'str'>
```

---

## 1.3 列表：一排东西

```python
scores = [88, 76, 91]
print(scores[0])      # 88，第 1 个（从 0 开始数！）
print(scores[1])      # 76
print(len(scores))    # 3，长度
```

**从 0 开始数**是铁律：`scores[0]` 是第一个，`scores[2]` 是第三个。

```python
cols = ["Team ID", "School", "Score"]     # 文本列表，后面选列要用
```

---

## 1.4 字典：带标签的一对一对

```python
info = {"school": "XJTLU", "year": 2026}
print(info["school"])    # XJTLU
```

后面 `agg(avg="mean", n="count")` 里那种"名字=值"的写法，和字典是同一个思路：**左边是标签，右边是内容**。

---

## 1.5 点号 `.`：找某个对象要它做事

```python
text = "xjtlu "
print(text.strip())     # "xjtlu"，去掉两端空格
print(text.upper())     # "XJTLU "，转大写
```

读法：**对象.方法(参数)**。
`text.strip()` = "让 text 这段文本执行 strip（去空格）这个动作"。

pandas 里全是这种写法：

```python
df.head()          # 让 df 这张表显示前几行
df.shape           # df 的形状（注意：这个没有括号）
```

**有的带括号，有的不带，怎么办？**
- 要"做一个动作" → 带括号：`head()`、`mean()`、`dropna()`
- 只是"看一个属性" → 不带括号：`shape`、`columns`、`dtypes`

记不住没关系，报 `TypeError` 时检查一下就知道。

---

## 1.6 函数：你之前学过的，这里只复习用法

```python
def add(a, b):
    return a + b

print(add(3, 4))     # 7
```

pandas 里你暂时不需要自己写函数，但要看懂**参数**：

```python
pd.read_csv("data/a.csv", encoding="utf-8-sig")
#           └─ 位置参数：文件路径      └─ 关键字参数：名字=值
```

关键字参数的好处是**顺序无所谓、可读性强**：

```python
df.to_csv("out.csv", index=False, encoding="utf-8-sig")
```

---

## 1.7 import：借用别人的工具

```python
import pandas as pd
```

翻译：把 pandas 这个工具箱搬进来，并且**给它起个短名叫 pd**。
所以后面都写 `pd.read_csv(...)`，就是"用 pandas 工具箱里的 read_csv"。

**这行必须写在文件最上面，且每次新建文件都要写。**

---

## 1.8 注释：井号后面是给人看的

```python
# 这一行不会被执行
df = pd.read_csv("data/a.csv")   # 注释也可以写在代码后面
```

**要求：你的每一行清洗代码后面都要写注释说明理由。** 这些理由以后直接搬进论文。

---

## 1.9 缩进：Python 用空格表示归属

```python
if True:
    print("在 if 里面")     # 前面有 4 个空格
print("在 if 外面")          # 没有空格
```

```python
for d in [1, 2, 3]:
    print(d)      # 会执行 3 次
```

**缩进错了就报 `IndentationError`。** 统一用 4 个空格，VS Code 里按 Tab 会自动转。

---

## 1.10 循环：后面统一两张表的键要用

```python
names = ["a", "b"]
for n in names:
    print(n.upper())
```

读法：把 names 里的东西**一个一个**取出来，每次叫 n，然后执行缩进的那几行。

---

## 1.11 布尔条件：筛选的基础

```python
score = 85
print(score > 80)                 # True
print(score > 80 and score < 90)  # True
```

在 pandas 里要写成 `&` 和 `|`，而且**每个条件必须加括号**：

```python
# Python 里（单个值）
score > 80 and score < 90

# pandas 里（整列）
(df["Score"] > 80) & (df["Score"] < 90)
```

---

## 1.12 f-string：打印时拼接变量（可选手残党友好）

```python
before = 22
after = 21
print(f"去重前 {before} 行，去重后 {after} 行")
```

字符串前面加 `f`，里面就能用 `{}` 塞变量。比 `print("去重前", before)` 更直观。

---

## 本课自测（不运行，先心算，再运行对答案）

```python
x = "80"
y = 20
# 1. print(x + x) 会输出什么？
# 2. print(y + y) 会输出什么？
# 3. print(x == 80) 会输出什么？为什么？
# 4. scores = [70, 80, 90]，print(scores[2]) 输出什么？
# 5. print("xjtlu ".strip().upper()) 输出什么？
# 6. 下面这行错在哪？
#    if x = "80":
```

答案：
1. `8080`（文本拼接）
2. `40`
3. `False`，因为 `"80"` 是文本，`80` 是数字，类型不同不相等
4. `90`（从 0 数）
5. `XJTLU`
6. 判断相等要写 `==`，写成 `=` 会变成赋值（另外 if 末尾的冒号和下一行缩进也不能少）

全对就可以进入下一课。错两个以上，把这一课再读一遍——**这些就是后面所有报错的发源地**。
