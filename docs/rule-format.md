# ルール記述フォーマット

taQu のカスタムルールは、インデントベースのテキスト形式です。

ルール名、説明、初期値、イベントごとの処理を記述することで、早押しクイズの判定ルールを定義できます。

## メタデータ

```taqu
rule = "7○3×"
description = "7回正解で勝ち、3回誤答で失格"
maxAns = 1
```

- `rule`: ルール名
- `description`: ルール説明
- `maxAns`: 1問あたりの解答権数
  - `1`: 通常の1人解答
  - `0`: 人数制限なし

`rule` と `description` では、定数を `[NAME]` 形式で展開できます。

```taqu
const M = 7
rule = "[M]○"
```

## 変数

基本の得点変数は `x`, `y`, `z` です。

```taqu
x.label = "○"
y.label = "×"
z.label = "Pts"
```

代入するとカスタム変数も作れます。

```taqu
combo = 0
```

## 定数

```taqu
const M = 7
const N = 3
```

定数は式やメタデータ展開で利用できます。

## イベント

主なイベントは次の通りです。

```taqu
def initialization():
  pass

def push():
  pass

def correct():
  pass

def wrong():
  pass

def through():
  pass

def next():
  pass

def judge():
  pass
```

- `initialization`: ルール適用時や参加者初期化時
- `push`: 早押しボタンを押した時
- `correct`: 正解判定時
- `wrong`: 誤答判定時
- `through`: スルー時
- `next`: 問題終了後の後処理
- `judge`: ホストが `/judge` を実行した時の手動判定

## コマンド

勝敗やロックを操作するコマンドです。

```taqu
win()
lose()
lock()
unlock()
tLock()
tUnlock()
throughAns()
```

一括・手動判定:

```taqu
broadcast(x, 0)

def judge():
  if x >= 10:
    win()
  if x < 10:
    lose()
```

変数更新:

```taqu
x += 1
y -= 1
z *= 2
```

条件分岐:

```taqu
if x >= 7:
  win()
else:
  y += 1
```

繰り返し:

```taqu
repeat 3:
  x += 1
```

## scope

`scope` は、条件に一致する複数プレイヤーへ処理を適用するための構文です。

```taqu
scope(mt != my_mt):
  y += 1
```

単体の参考実装では、`scope` はキューとして返されます。実際にどのプレイヤーへ適用するかは、ホストアプリケーション側が決めます。

## 式

算術・比較・論理風の式が使えます。

```taqu
x + 1
x >= 7
x > 0 and y < 3
```

主な関数:

```taqu
floor(x)
ceil(x)
round(x)
abs(x)
sqrt(x)
pow(x, 2)
max(x, y)
min(x, y)
clamp(x, 0, 10)
random(10)
rand(1, 7)
```

チーム・順位系の補助関数:

```taqu
tProd(x)
tAdd(x)
tMax(x)
tMin(x)
tCount(x)
rankVal(x, 1)
countIf(x > 0)
getPushRank()
```

これらの一部は、複数プレイヤー情報をホスト側から渡すことで意味を持ちます。
