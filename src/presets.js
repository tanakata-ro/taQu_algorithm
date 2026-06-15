// ルールプリセット定義
// name: セレクトボックスの表示名
// desc: ルール説明文
// code: ルールコード

const RULE_PRESETS = {
    'free': {
        name: "Free",
        desc: "正解で〇、誤答で×が増えるシンプルなルール。",
        code: `description = "正解で〇、誤答で×が増えるシンプルなルール。"
rule="Free"
maxAns=1
x.label = "〇"
y.label = "×"

def correct():
  x += 1

def wrong():
  y += 1

def through():
  pass`
    },
    'monx': {
        name: "M〇N×",
        desc: "設定した回数([M]回正解、[N]回誤答)で勝敗が決まります。",
        code: `rule="[M]〇[N]×"
description = "[M]回正解で勝ち抜け、[N]回誤答で失格"
maxAns=1
x.label = "〇"
y.label = "×"
const M = 7 # 勝ち抜け点数
const N = 3 # 失格点数

def correct():
  x += 1
  if x >= M: win()

def wrong():
  y += 1
  if y >= N: lose()
`
    },
    'm〇n休': {
      name: "M〇N休",
      desc: "[M]回正解で勝ち抜け、誤答で[N]回休み",
      code: `rule="[M]〇[N]休"
description = "[M]回正解で勝ち抜け、誤答で[N]回休み"
maxAns=1
x.label = "〇"
y.label = "Lock"
const M = 7 # 勝ち抜け点数
const N = 3 # 休み回数

def correct():
  x += 1

def wrong():
  y = N + 1
  lock(y)

def next():
  if y > 0:
    y -= 1
  if y <= 0:
    unlock()
  if x >= M: win()`
    },
    'nupdown': {
        name: "N updown",
        desc: "[N]〇勝ち。1×で0〇に戻り、2×で失格。",
        code: `rule="[N]updown"
description = "[N]〇で勝ち、1回目の誤答で0〇に戻り、2回目の誤答で失格"
maxAns=1
x.label = "Pts"
y.label = "×"
const N = 10 # 勝ち抜け点数

def correct():
  x += 1


def wrong():
  y += 1
  if y == 1:
    x = 0

  if y >= 2:
    lose()

def next():
  if x >= N:
    win()`
    },
    'swedish': {
        name: "Swedish10",
        desc: "10〇で勝ち、10×で負け。誤答ペナルティ: 0〇: 1×, 1~2〇: 2×, 3~5〇: 3×, 6~9〇: 4×",
        code: `rule="Swedish10"
description = "10〇で勝ち、10×で負け。誤答ペナルティ: 0〇: 1×, 1~2〇: 2×, 3~5〇: 3×, 6~9〇: 4×"
maxAns=1
x.label = "〇"
y.label = "×"
z.label = "Next"
z = 1

def correct():
  x += 1
  if x >= 1 and x < 3: z = 2
  if x >= 3 and x < 6: z = 3
  if x >= 6: z = 4

def wrong():
  y += z
  if y >= 10: lose()

def next():
  if x >= 10: win()`
    },
    'nbyn': {
        name: "N by N",
        desc: "正解数×誤答ポイントが N^2 を超えると勝ち。初期: x=0, y=N。",
        code: `rule="[N]by[N]"
description = "XとYの積が [N*N] を超えると勝ち。[M]回の誤答で失格"
maxAns=1
x.label = "X"
y.label = "Y"
z.label = "Pts"
const N = 10 # N×N 勝ち抜け点数
const M = 6 # 失格点数
x = 0
y = N

def correct():
  x += 1

def wrong():
  y -= 1
  z = x
  z *= y
  s = N - M
  if y <= s: lose()
  
def next():
  # x * y > N * N
  z = x
  z *= y
  t = N
  t *= N
  if z >= t: win()
`
    },
    'freezen': {
      name: "Freeze N",
      desc: "[N]回正解で勝ち抜け、n回目の誤答でn回休み",
      code: `rule="Freeze[N]"
description = "[N]回正解で勝ち抜け、n回目の誤答でn回休み"
maxAns=1
x.label = "〇"
y.label = "×"
z.label = "Lock"
const N = 10 # 勝ち抜け点数

def correct():
  x += 1

def wrong():
  y += 1
  z = y + 1
  lock(z)

def next():
  if z > 0:
    z -= 1
    if z == 0:
      unlock()

  if x >= N: win()`
    },
    'attacksurvival': {
      name: "Attack Survival",
      desc: "持ち点[M]が無くなると失格、正解で他のプレイヤー-1pt、誤答で自身が-[N]pt",
      code: `rule="Attack Survival"
description = "持ち点[M]が無くなると失格、正解で他のプレイヤー-1pt、誤答で自身が-[N]pt"
# アタック風サバイバル
const M = 20 # 初期点数
const N = 1 # 誤答時の減点

x.label = "Pts"
x = M

winText = "Survived!"

def correct():
  othersAdd(x, -1)

def wrong():
  x -= N
    
def next():
  if x <= 0:
    x = 0
    lose()
  if countIf(x > 0) == 1:
    if x > 0:
      win()`
    },
    '10by10by10mini': {
      name: "10by10by10mini",
      desc: "チーム内の正解数の積が[N]以上で勝ち。誤答でその人のPtsが1にリセット。2回誤答でロック。ただし誰かが2回誤答すると、他の全チームの2回目の誤答が1回に戻り、ロックも解除される。",
      code: `description = "チーム内の正解数の積が[N]以上で勝ち。誤答でその人のPtsが1にリセット。2回誤答でロック。ただし誰かが2回誤答すると、他の全チームの2回目の誤答が1回に戻り、ロックも解除される。"
rule = "10by10by10mini"
x.label = "Pts"
y.label = "×"
z.label = "Prod"
const N = 200 # 勝ち抜け点数
x = 1
z = 1
sync(z)
def correct():
  x += 1
  z = tProd(x)
  if z >= N:
    win()

def wrong():
  x = 1
  y += 1
  z = tProd(x)
  if y >= 2:
    lock()
  scope(mt != my_mt):
    if y == 2:
      y = 1
      unlock()

def through():
  pass`
    }
};
