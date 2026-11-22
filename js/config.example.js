// このファイルを config.js という名前でコピーし、API キーを設定してください。
// config.js は .gitignore 済みなので Git にはコミットされません。
//
// 重要: ブラウザで使う API キーは誰でも見られます。
// Google Cloud Console で必ず以下の制限をかけてください。
//   - アプリケーションの制限: 「ウェブサイト」(HTTP リファラー) に自分のサイトの URL のみ
//   - API の制限: 「Maps JavaScript API」のみ
window.APP_CONFIG = Object.freeze({
  GOOGLE_MAPS_API_KEY: 'YOUR_API_KEY',
  // Advanced Marker を使うために Map ID が必要です。
  // 'DEMO_MAP_ID' は開発用。本番では Cloud Console で作成した Map ID を指定してください。
  MAP_ID: 'DEMO_MAP_ID',
});
