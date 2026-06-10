# 基本ルール例

最小構成の taQu カスタムルール例です。

```taqu
rule = "Free"
x.label = "Correct"
y.label = "Wrong"

def correct():
  x += 1

def wrong():
  y += 1
```

このルールでは、正解で `x` が 1 増え、誤答で `y` が 1 増えます。
