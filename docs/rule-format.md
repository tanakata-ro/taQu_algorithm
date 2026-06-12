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

`rule` と `description` は、`+` で文字列を連結できます。数値の定数や式は文字列として連結されます。`+=` で現在の文字列に追記できます。

```taqu
const TARGET = 10
rule = "Freeze" + TARGET
description = "勝ち抜け: " + TARGET + "問"

if TARGET >= 10:
  rule += " hard"
  desc += " / 高難度"
```

`name` は `rule`、`desc` は `description` の別名です。

## 変数

基本の得点変数は `x`, `y`, `z`, `w` です。

```taqu
x.label = "○"
y.label = "×"
z.label = "Pts"
w.label = "Bonus"
w.size = small
```

ラベル未設定の変数は画面に表示されません。4つすべてを表示すると、プレイヤーカードは1変数分だけ横に広がります。

表示サイズは `normal`（通常）または `small`（小さめ）を指定できます。`w.size = "小さめ"` のように日本語名も使えます。

カード上に並べる専用マークは `mark` で扱えます。`mark += 1` で表示数が増え、5個まではマークを並べ、6以上は `×6` のようにマークと数字で表示します。表示マークは `mark.symbol` で変更できます。

```taqu
mark.symbol = "👑"

def wrong():
  mark += 1
```

`miss` は `mark` の旧名として引き続き使えます。

ルール適用時やラウンド切替時に基本変数や mark の現在値を保持したい場合は、`keep(x)` や `keep(mark)` のように指定します。

```taqu
keep(x)
keep(y)
keep(mark)
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
```

- `initialization`: ルール適用時や参加者初期化時
- `push`: 早押しボタンを押した時
- `correct`: 正解判定時
- `wrong`: 誤答判定時
- `through`: スルー時
- `next`: 問題終了後の後処理

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
