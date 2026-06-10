# サンプル

`examples/` には、公開仕様を使うための最小例を置いています。

## basic-rule

`examples/basic-rule/rule.taqu` は、最小構成のルール例です。

正解で `x` が増え、誤答で `y` が増えます。

## browser-extension

`examples/browser-extension/` は、ブラウザ拡張の形を示す簡単な例です。

この例は、選択されたルール文字列をローカルで扱う想定です。非公開 taQu サーバー API は使いません。

## external-tool

`examples/external-tool/evaluate-rule.js` は、Node.js から参考実装を読み込み、ルールイベントを実行する例です。

```bash
node examples/external-tool/evaluate-rule.js
```

出力例:

```js
{ name: 'Alice', x: 2, status: 'win' }
```
