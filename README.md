# taQu Algorithm Public Kit v1.13.0

このリポジトリは、taQu のルール記述仕様・判定アルゴリズム・参考実装を外部公開するためのものです。

拡張機能、外部ツール、カスタムクライアント、連携機能、ルールエディタ、静的解析ツールなどの開発を歓迎します。

このリポジトリには、認証情報・運営用機能・管理画面・本番サーバー設定・DB・音源・非公開 API の内部仕様は含めません。

## ライセンス

コードとドキュメントは Apache License 2.0 で公開します。詳細は [LICENSE](LICENSE) を参照してください。

ただし、Apache License 2.0 は taQu の名称・ロゴ・ブランド資産を自分のプロダクト名や公式表示として使う許可を与えるものではありません。taQu の名称・ロゴ・ブランド利用には別途許可が必要です。

## 内容

- [docs/rule-format.md](docs/rule-format.md): ルール記述言語の仕様
- [docs/algorithm.md](docs/algorithm.md): 判定・ルール実行アルゴリズムの概要
- [docs/extension-api.md](docs/extension-api.md): 拡張機能・外部ツール向けの公開インターフェース方針
- [docs/examples.md](docs/examples.md): サンプルの説明
- [src/](src): 参考実装と型定義
- [examples/](examples): 最小ルール、ブラウザ拡張、外部ツールの例

## クイックスタート

```bash
npm install
npm run check
node examples/external-tool/evaluate-rule.js
```

```js
const { applyAction } = require('./src');

const rule = `
rule = "Free"
x.label = "Correct"

def correct():
  x += 1
`;

const player = applyAction(rule, 'correct', { name: 'Alice' });
console.log(player.x);
```

## 公開範囲

この公開キットは taQu サービス本体ではありません。

含めるもの:

- ルール記述の仕様
- 判定ロジックの考え方
- 参考実装
- 型定義
- 拡張機能・外部ツール向けの説明
- サンプルコード

含めないもの:

- 認証情報
- 運営用機能
- 管理画面
- 不正対策の詳細
- DB スキーマや本番データ
- サーバー設定
- 非公開 API の内部仕様
- 音源、ロゴ、ブランド資産

拡張機能や外部ツールを作る場合は、`src/` と `docs/` を公開された安定面として扱ってください。taQu サービス本体の内部実装には依存しない設計を推奨します。
