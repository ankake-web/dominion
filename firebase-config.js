/* ============================================================
   Firebase 設定ファイル
   ------------------------------------------------------------
   オンライン対戦（2台のスマホで遊ぶ）を有効にするための設定です。
   ここを書き換えるまでは「1台で2人プレイ」だけが使えます。

   設定手順は README.md の「フェーズ2」を見てください。
   下の firebaseConfig の中身を、自分の Firebase プロジェクトの
   値に置き換えるだけで、オンライン対戦が使えるようになります。
   ============================================================ */

// ↓↓↓ ここを自分の Firebase プロジェクトの値に置き換える ↓↓↓
const firebaseConfig = {
  apiKey: "ここに貼り付け",
  authDomain: "ここに貼り付け",
  databaseURL: "ここに貼り付け",
  projectId: "ここに貼り付け",
  storageBucket: "ここに貼り付け",
  messagingSenderId: "ここに貼り付け",
  appId: "ここに貼り付け",
};
// ↑↑↑ ここまで ↑↑↑

(function () {
  const DOM = (window.DOM = window.DOM || {});
  // まだ設定が貼り付けられていない／Firebase SDK が読めない場合は何もしない
  const notConfigured =
    !firebaseConfig.databaseURL || firebaseConfig.databaseURL.indexOf("貼り付け") >= 0;
  if (typeof firebase === "undefined" || notConfigured) {
    DOM.db = undefined;
    return;
  }
  try {
    firebase.initializeApp(firebaseConfig);
    DOM.db = firebase.database();
  } catch (e) {
    console.warn("Firebase 初期化に失敗:", e);
    DOM.db = undefined;
  }
})();
