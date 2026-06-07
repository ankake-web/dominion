# ドミニオン（基本セット）— スマホ対戦アプリ

ドミニオン基本セットのWebアプリです。インストール不要、ブラウザで動きます。
日本語UI・スマホ縦画面・タップ操作に対応。実物の美麗カード画像つき。

### 遊べるモード
- **対戦をはじめる**：2〜4人。各席を「人間 / CPU（弱・普通・強）」に自由割り当て（混在OK）。**サーバー不要・オフラインで動く**。
- **1台で2人プレイ（クイック）**：1台を回して2人で対戦（相手の番は手札を隠す画面）。**サーバー不要**。
- **オンラインで対戦（2〜4台）**：数字4桁の部屋コードで対戦。空席はCPUで充填。**WebSocketサーバー**を使う（下の手順で公開）。
- **遊び方 / カード一覧**：ルール説明と全カード一覧（タップで拡大・コスト/効果つき）。

```
Dominion/
├── index.html          ← アプリ本体（ブラウザで開く / GitHub Pages で配信）
├── css/ js/            ← フロント（engine/cpu/store/net/ui）
├── js/net.js           ← ★オンラインの接続先サーバURLはここの1定数★
├── assets/             ← カード画像（<カード名>.png 原本 + 軽量 .jpg。アプリは.jpgを使用）
├── server/             ← オンライン対戦サーバ（Node + ws。Renderで公開）
│   ├── index.js        ← 起動エントリ（PORT / /health / Origin許可）
│   └── gameServer.js   ← ルーム/ロビー/サーバ権威/視点別マスク/CPU駆動
├── render.yaml         ← Render デプロイ定義（サーバ）
├── .github/workflows/  ← GitHub Pages デプロイ（フロント）
└── test/               ← テスト（遊ぶには不要）
```

実装している王国カード10種（初回おすすめ）:
**地下貯蔵庫・村・木こり・工房・堀・民兵・鍛冶屋・改築・市場・鉱山**

### 設計（カタンと同じ考え方）
- **サーバー権威**：ゲームの“正”の状態はサーバーが持ち、ルールはフロントと同じ `js/engine.js` を
  サーバーでも `require` して使う（二重実装・ルールのズレなし）。
- **秘匿マスク**：各クライアントには「自分の手札＋公開情報」だけ配信。他人の手札・山札は中身を送らず
  `back`（裏向き）で伏せる → **開発者ツールでも相手の手札は覗けない**。
- **CPU充填**：空席はCPU（弱/普通/強）で埋め、CPUの手番はサーバー側で進める。
- **切断耐性**：切断中はそのプレイヤーをCPUが代行し、トークンで再接続すると人間に復帰。

---

## いますぐ遊ぶ（サーバー不要）

`index.html` を **ダブルクリック**で開くだけ。
- CPUと遊ぶ → 「**対戦をはじめる**」→「この設定で開始」
- 人と2人 → 「**1台で2人プレイ（クイック）**」

スマホで試す（同じWi-FiのPCから配信）:
```bash
cd /Users/inouenaoki/games/Dominion
python3 -m http.server 8000
```
→ スマホのブラウザで `http://(PCのIP):8000`（例 `http://192.168.0.5:8000`）。
（この段階では「対戦をはじめる/クイック」が動けばOK。オンラインは下の公開後に使えます）

---

## ローカルでオンライン対戦を試す（PCで2窓 / 同Wi-Fiの2台）

オンラインは**WebSocketサーバー**を使います。ローカルでは2つのサーバーを起動します。

```bash
cd /Users/inouenaoki/games/Dominion
npm install              # 最初の1回（ws などを入れる）
node server/index.js     # ① 対戦サーバ（ポート8787） … 別タブで起動したまま
python3 -m http.server 8000   # ② 静的配信（ポート8000） … さらに別タブ
```
（`npm run dev` で①②をまとめて起動もできます）

- PCのブラウザで `http://localhost:8000` を2窓開く（または同Wi-Fiの2台で `http://(PCのIP):8000`）。
- 片方で「**オンラインで対戦 → 部屋を作る**」→ 4桁コードが出る。
- もう片方で「**部屋に参加する**」→ コードを入れて参加（または「参加用リンクをコピー」を共有）。
- ロビーでホストがCPU人数・強さを決めて「**ゲーム開始**」。

> フロント(8000)が `localhost` / `192.168.x.x` で開かれている時は、自動的に
> `ws://(同じホスト):8787/ws` のサーバに繋ぎます（`js/net.js` が判定）。設定不要。

---

## ネットに公開する（あなたの操作。フロント=GitHub Pages / サーバ=Render）

「相手はURLを開くだけ」にします。**サーバ(Render)** と **フロント(GitHub Pages)** を1回ずつ用意します。

### 手順0：GitHubにpushする
このリポジトリを自分のGitHubへ push してください（このフォルダで `gh` が使えれば自動作成済み。
README末尾の出力に作成したリポジトリURLが出ます）。手動なら:
```bash
gh repo create <あなた>/dominion --public --source=. --push
# gh が無ければ: GitHubでリポジトリを作成し git remote add origin ... && git push -u origin main
```

### 手順1：サーバを Render に公開（無料）
1. <https://render.com> に GitHub でログイン。
2. 「**New +」→「Blueprint**」→ このリポジトリを選ぶ（`render.yaml` が読まれる）。
3. デプロイが終わると公開URLが出る（例 `https://dominion-xxxx.onrender.com`）。**控える**。
4. そのサービスの「**Environment**」で環境変数 **`ALLOWED_ORIGINS`** を、
   次の手順で決まる GitHub Pages のオリジンにする（例 `https://<あなた>.github.io`）。
   ※ スキーム+ホストのみ。`/dominion` のようなパスは付けない。

### 手順2：フロントの接続先URLを貼り替える（★1か所だけ★）
`js/net.js` の先頭付近の定数を、手順1のURLを **`wss://`** にして貼り替える:
```js
// js/net.js
const PROD_SERVER_URL = 'wss://dominion-xxxx.onrender.com';   // ← ここだけ
```
保存して push:
```bash
git add js/net.js && git commit -m "set prod server url" && git push
```

### 手順3：フロントを GitHub Pages に公開
1. GitHub のリポジトリ → **Settings → Pages**。
2. 「**Build and deployment**」の Source を「**GitHub Actions**」にする。
   （`.github/workflows/deploy.yml` が main への push で自動デプロイします）
3. 数十秒後、`https://<あなた>.github.io/dominion/` が本番URLになる。

### 遊び方（相手の操作）
1. あなたが本番URLを開き「**オンラインで対戦 → 部屋を作る**」。
2. 出た **4桁コード** か「**参加用リンクをコピー**」したURL（`...github.io/dominion/?room=1234`）を相手に送る。
3. 相手はそのリンクを開く → 名前を入れて「参加する」 → ロビー → ホストが開始！

> 更新したら `git push` するだけで Pages は自動再デプロイ、サーバは Render が自動再ビルドします。
> Render無料枠は無アクセスでスリープします。初回接続が遅い場合は少し待つ／再接続されます
> （アプリは自動で再接続を試みます）。

---

## 困ったとき
- **「サーバに接続できません」**
  → ローカル: `node server/index.js` を起動しているか。本番: `js/net.js` の `PROD_SERVER_URL` を
    正しい `wss://...onrender.com` にしたか。Renderがスリープからの復帰中なら数十秒待つ。
- **本番で繋がらない / 403**
  → Render の `ALLOWED_ORIGINS` を GitHub Pages のオリジン（`https://<user>.github.io`）に設定したか。
- **「ルームが見つかりません」**
  → コードの打ち間違い、または相手がまだ部屋を作っていない。
- **1台プレイは動くがスマホで開けない**
  → PCとスマホが同じWi-Fiか確認。

## ルールの実装メモ
- 初期デッキ: 各自 銅貨7＋屋敷3、毎ターン手札5枚。
- 手番: ①アクション → ②購入（財宝を出してコイン化）→ ③クリーンアップ（5枚引く）。
- 終了: 属州枯渇、または任意の3山が空でターン終了時。勝利点合計が多い方が勝ち（同点はターン数が少ない方）。
- 2〜4人でサプライ枚数を調整（勝利点 2人=各8/3〜4人=各12、呪い=(人数−1)×10、王国=各10）。
- カード効果は基本セット第2版に準拠。

## 開発者向け：テスト
```bash
npm test                     # engine/cpu/ui/server/online をまとめて実行
node test/engine.test.js     # ルールエンジン（多人数・各カード）
node test/cpu.test.js        # CPU対局（終了性・強さの序列）
node test/ui.test.js         # 画面操作（jsdom）
node test/server.test.js     # 対戦サーバ（実wsクライアント・マスク/手番ガード/再接続）
node test/online.test.js     # オンラインE2E（実サーバ+jsdom2ブラウザ+実WebSocket）

# 実機確認（Chromium）。先にサーバを起動しておく
node server/index.js & python3 -m http.server 8000 &
npm run verify:visual        # レスポンシブ＆はみ出し（360/768/1280px）
node test/verify-online.js   # 実ブラウザ2窓で 作成→参加→開始→同期＋手札秘匿
```
