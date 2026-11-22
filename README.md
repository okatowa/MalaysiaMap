# マレーシア ショッピングモールガイド

マレーシアのショッピングモールを Google マップ上で紹介するウェブサイトです（HTML / CSS / JavaScript のみ）。

## 機能

- Google マップ上にモールをピンで表示し、クリックすると詳細を表示
- 一覧表示と、名前・州による絞り込み
- モールの追加：地図をクリックするとピンが置かれ、ドラッグで位置を調整できる
- 削除、サンプルデータへのリセット
- データはブラウザの localStorage に保存

## セットアップ

1. Google Cloud Console で **Maps JavaScript API** を有効にし、API キーを作成する
2. API キーに**必ず**次の制限をかける（ブラウザで使うキーは誰でも見られるため）
   - アプリケーションの制限：ウェブサイト（例：`http://localhost:8000/*`、本番ドメイン）
   - API の制限：Maps JavaScript API のみ
3. `js/config.example.js` を `js/config.js` にコピーし、`GOOGLE_MAPS_API_KEY` を設定する（`js/config.js` は Git の管理対象外）
4. ローカルサーバーで起動する（`file://` で開くとリファラー制限が効かない）

   ```sh
   python -m http.server 8000
   ```

   ブラウザで http://localhost:8000 を開く

API キーがなくても、一覧表示と緯度・経度を直接入力しての追加は使えます。

## GitHub Pages で公開

`main` ブランチに push すると、GitHub Actions（`.github/workflows/deploy.yml`）が自動で公開する。
API キーはリポジトリに含めず、Secret から `js/config.js` を生成する。

1. GitHub のリポジトリで **Settings → Pages → Build and deployment → Source** を「**GitHub Actions**」にする
2. **Settings → Secrets and variables → Actions → New repository secret** で
   `GOOGLE_MAPS_API_KEY` に API キーを登録する
   （任意：**Variables** タブで `MAP_ID` を登録すると本番用 Map ID を使える）
3. Google Cloud Console で API キーのウェブサイト制限に `https://okatowa.github.io/MalaysiaMap/*` を追加する
4. **Actions** タブで「Deploy to GitHub Pages」を実行（または main に push）
5. `https://okatowa.github.io/MalaysiaMap/` で公開される

※ 公開後のサイトでは、API キーは閲覧者のブラウザから見える（Maps JavaScript API の仕組み上避けられない）。そのため手順 3 のリファラー制限は必須。

## セキュリティ上の対策

- ユーザー入力は `textContent` で描画し、`innerHTML` は使わない（XSS 対策）
- URL は `http:` / `https:` のみ許可。外部リンクには `rel="noopener noreferrer"` を付ける
- localStorage から読み込んだデータも毎回検証する
- CSP でインラインスクリプトを禁止し、スクリプトの読み込み元を自サイトと Google Maps に限定する
- API キーはリファラーと API の両方で制限し、Git にはコミットしない

## 制限事項

- 追加したデータは各ブラウザ内にだけ保存されるため、他のユーザーとは共有されない。共有するにはサーバー側（データベース、認証、入力検証）が必要
- `frame-ancestors`（クリックジャッキング対策）は meta タグでは指定できないため、公開時はサーバーの HTTP ヘッダーで設定すること
- サンプルデータの座標や URL は目安なので、公開前に確認すること
