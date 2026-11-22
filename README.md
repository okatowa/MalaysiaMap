# マレーシア ショッピングモールガイド

マレーシアのショッピングモールを地図上で紹介するウェブサイトです（HTML / CSS / JavaScript のみ）。
地図は [Leaflet](https://leafletjs.com/) と [OpenStreetMap](https://www.openstreetmap.org/) を使っており、API キーや登録は不要です。

## 機能

- 地図上にモールをピンで表示し、クリックすると詳細を表示
- 一覧表示と、名前・州による絞り込み
- モールの追加：地図をクリックすると赤いピンが置かれ、ドラッグで位置を調整できる
- 削除、サンプルデータへのリセット
- データはブラウザの localStorage に保存

## ローカルで確認

`index.html` をダブルクリックで開く（`file://`）と、OpenStreetMap が地図画像を返さないことがあるため、ローカルサーバー経由で開く。

- VS Code の拡張機能「Live Server」を入れ、`index.html` を右クリック →「Open with Live Server」
- または Python がある場合：`python -m http.server 8000` を実行し、http://localhost:8000 を開く

## GitHub Pages で公開

`main` ブランチに push すると、GitHub Actions（`.github/workflows/deploy.yml`）が自動で公開する。

1. GitHub のリポジトリで **Settings → Pages → Build and deployment → Source** を「**GitHub Actions**」にする
2. **Actions** タブで「Deploy to GitHub Pages」を実行（または main に push）
3. `https://okatowa.github.io/MalaysiaMap/` で公開される

## フォルダ構成

- `index.html` / `css/style.css` / `js/app.js` … サイト本体
- `vendor/leaflet/` … Leaflet 1.9.4（BSD-2-Clause、同梱。外部 CDN には依存しない）

## セキュリティ上の対策

- ユーザー入力は `textContent` で描画し、`innerHTML` は使わない（XSS 対策）。ポップアップにも文字列ではなく DOM 要素を渡す
- URL は `http:` / `https:` のみ許可。外部リンクには `rel="noopener noreferrer"` を付ける
- localStorage から読み込んだデータも毎回検証する
- CSP でスクリプト・CSS を自サイトのみに限定し、インラインスクリプトを禁止。外部から読み込むのは OpenStreetMap の地図画像だけ
- Leaflet は公式の SRI ハッシュと照合したファイルを同梱

## 制限事項

- 追加したデータは各ブラウザ内にだけ保存されるため、他のユーザーとは共有されない。共有するにはサーバー側（データベース、認証、入力検証）が必要
- OpenStreetMap 公式のタイルサーバーは[利用ポリシー](https://operations.osmfoundation.org/policies/tiles/)により大量アクセス用途には使えない。アクセスが増えたら商用のタイル配信サービスに切り替えること
- `frame-ancestors`（クリックジャッキング対策）は meta タグでは指定できない。GitHub Pages ではヘッダーを設定できないため未対応
- サンプルデータの座標や URL は目安なので、公開前に確認すること
