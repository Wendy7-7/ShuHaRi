# C 语言基础速览

## 1. 一个最小的 C 程序

```c
#include <stdio.h>

int main(void) {
    printf("Hello\n");
    return 0;
}
```

- `#include <stdio.h>`：引入标准输入输出库（printf 就住在这里）
- `int main(void)`：程序入口，从这里开始执行
- `return 0;`：正常退出的惯例

## 2. 变量与类型

| 类型 | 用途 | 例子 |
|------|------|------|
| `int` | 整数 | `int age = 20;` |
| `double` | 浮点数 | `double pi = 3.14;` |
| `char` | 单个字符 | `char c = 'A';` |

## 3. 编译运行

```bash
gcc hello.c -o hello.exe
./hello.exe
```

## 练习

改写 `hello.c`：打印 1 到 10 的平方。提示：`for (int i = 1; i <= 10; i++)`。
