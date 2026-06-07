# ドミニオン（基本セット）— スマホ2台対戦アプリ

奥さんとスマホ2台で遊べる、ドミニオン基本セットのWebアプリです。
インストール不要、ブラウザで動きます。日本語UI・スマホ縦画面・タップ操作に対応。

```
Dominion/
├── index.html           ← これがアプリ本体（ブラウザで開く）
├── firebase-config.js   ← オンライン対戦の設定（フェーズ2で編集）
├── css/style.css
├── js/                  ← ゲームのプログラム
├── firebase.json        ← 公開設定（フェーズ3で使用）
├── database.rules.json  ← データベースのルール
└── test/                ← 動作確認用（遊ぶには不要）
```

実装している王国カード10種（初回おすすめ）:
**地下貯蔵庫・村・木こり・工房・堀・民兵・鍛冶屋・改築・市場・鉱山**

---

## フェーズ1：まず1台でルールを試す（いますぐ遊べます）

### いちばん簡単な方法
`index.html` を **ダブルクリック**してブラウザで開くだけ。
「**1台で2人プレイ**」を選べば、端末を回しながら2人で遊べます。
（相手の番になると手札を隠す画面をはさむので、ズルできません）

### スマホでも試したい場合（同じWi-Fiのパソコンから配信）
パソコンのターミナルで、このフォルダに入って次を実行:

```bash
cd /Users/inouenaoki/games/Dominion
python3 -m http.server 8000
```

そのあと、表示された `http://パソコンのIP:8000` をスマホのブラウザで開きます。
（パソコンのIPは「システム設定 → Wi-Fi → 詳細」などで確認できます。
 例: `http://192.168.0.5:8000` ）

> この段階ではまだ「1台で2人プレイ」だけ動けばOKです。
> オンライン（部屋コードで2台）はフェーズ2の設定後に使えます。

---

## フェーズ2：オンライン対戦を有効にする（Firebase）

2台のスマホで部屋コードを使って遊ぶには、無料の **Firebase** を1回だけ設定します。
（Googleアカウントがあれば無料。クレジットカード不要のSparkプランでOK）

### 手順A：Firebaseプロジェクトを作る
1. ブラウザで <https://console.firebase.google.com/> を開き、Googleでログイン
2. 「**プロジェクトを追加**」→ 名前を適当に（例 `dominion-nao`）→ 作成
   （Googleアナリティクスは「無効」でOK。早く済みます）

### 手順B：Realtime Database を作る
1. 左メニュー「**構築 → Realtime Database**」を開く
2. 「**データベースを作成**」をクリック
3. ロケーションは「**asia-southeast1（シンガポール）**」など近いものを選択
4. セキュリティルールは、いったん「**ロックモード**」で作成（あとで置き換えます）

### 手順C：設定値を取得して貼り付ける
1. 左上の「⚙（歯車）→ プロジェクトの設定」を開く
2. 下の方「**マイアプリ**」で `</>`（ウェブ）アイコンをクリック
3. アプリのニックネームを入力（例 `dominion-web`）→「アプリを登録」
4. 表示される `const firebaseConfig = { ... }` の中身をコピー
5. このフォルダの **`firebase-config.js`** を開き、`firebaseConfig` の中身を
   コピーした値に丸ごと置き換えて保存

`firebase-config.js` が例えばこうなればOK（値は自分のもの）:
```js
const firebaseConfig = {
  apiKey: "AIzaSy....",
  authDomain: "dominion-nao.firebaseapp.com",
  databaseURL: "https://dominion-nao-default-rtdb.asia-southeast1.firebasedatabase.app",
  projectId: "dominion-nao",
  storageBucket: "dominion-nao.appspot.com",
  messagingSenderId: "1234567890",
  appId: "1:1234567890:web:abcdef",
};
```
> `databaseURL` が入っていることが大事です（これが無いとオンラインが動きません）。

### 手順D：データベースのルールを開放する（このアプリ用）
このアプリは「部屋(rooms)」だけ読み書きします。
Firebaseコンソールの Realtime Database →「**ルール**」タブを開き、中身を
このフォルダの **`database.rules.json`** と同じ内容（下記）にして「公開」:
```json
{
  "rules": {
    "rooms": { ".read": true, ".write": true }
  }
}
```
> 知り合いと遊ぶ用の簡易ルールです。部屋コードを知っている人だけが触れる想定です。

### 動作確認（まだローカルでOK）
`firebase-config.js` を保存したら、再び `python3 -m http.server 8000` で配信し、
スマホで開いて「**オンラインで対戦 → 部屋を作る**」が動けば成功です。

---

## フェーズ3：ネットに公開して、どこでも遊べるようにする

最後に、インターネット上に公開して「**奥さんはURLを開くだけ**」にします。
Firebase Hosting を使えば、フェーズ2のプロジェクトでそのまま公開できます。

### 1回だけ：Firebaseのコマンドを準備
パソコンのターミナルで:
```bash
npm install -g firebase-tools     # Firebaseのコマンドを入れる（最初の1回だけ）
firebase login                    # ブラウザが開くのでGoogleでログイン
```

### 公開する
このフォルダで:
```bash
cd /Users/inouenaoki/games/Dominion
firebase use --add                # 一覧から フェーズ2で作ったプロジェクトを選ぶ
firebase deploy                   # 公開！（ホスティングとDBルールを反映）
```

成功すると、こんなURLが表示されます:
```
Hosting URL: https://dominion-nao.web.app
```
この **URLが本番のアドレス**です。

### 遊び方（奥さんの操作）
1. あなた（ホスト）が公開URLを開き、「**オンラインで対戦 → 部屋を作る**」
2. 表示された **4文字の部屋コード**、または「**参加用リンクをコピー**」したURLを
   LINEなどで奥さんに送る
3. 奥さんは送られたURL（`...web.app/?room=ABCD`）を開くだけで参加画面になり、
   名前を入れて「参加する」 → 対戦開始！
   （コードを手入力でもOK：URLを開いて「部屋に参加する」→ コード入力）

> 以後アプリを更新したら、`firebase deploy` をもう一度実行すれば反映されます。

---

## 困ったとき
- **オンラインのボタンを押すと「Firebase が未設定です」**
  → フェーズ2の `firebase-config.js` の貼り付けを確認（特に `databaseURL`）
- **参加で「部屋が見つかりません」**
  → コードの打ち間違い、または相手がまだ部屋を作っていない
- **同期しない／書き込めない**
  → 手順Dのデータベースのルールを確認（`rooms` が `.read/.write: true`）
- **1台プレイは動くがスマホで開けない**
  → パソコンとスマホが同じWi-Fiにつながっているか確認

## ルールの実装メモ
- 初期デッキ: 各自 銅貨7＋屋敷3、毎ターン手札5枚
- 手番: ①アクション → ②購入（財宝を出してコイン化して買う）→ ③クリーンアップ（5枚引く）
- 終了: 属州枯渇、または任意の3山が空でターン終了時。勝利点合計が多い方が勝ち（同点はターン数が少ない方）
- カード効果は基本セット第2版に準拠

## 開発者向け：テスト
```bash
node test/engine.test.js   # ルールエンジンの単体テスト
node test/ui.test.js       # 画面操作の統合テスト（jsdom）
```
