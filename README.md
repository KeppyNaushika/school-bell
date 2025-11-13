# School Bell

学校やイベント会場で使えるシンプルな「次のチャイム表示＆自動再生」アプリです。大型ディスプレイに映せば現在時刻と次ベルの予定が一目で分かり、設定パネルからチャイム時刻を柔軟に編集できます。

## 主な機能

- 現在時刻と次ベル時刻をフルスクリーン表示（日本時間・24h 表記）
- ブラウザー上でベル時刻を追加 / 削除 / 並べ替え（input[type="time"]）
- 指定時刻になると `public/audio/chime.wav` を自動再生（オートプレイ不可時は Web Audio API にフォールバック）
- 設定の JSON エクスポート / インポート、リンク共有、URL パラメーター（`?time=0815-0920&label=2-3`）による即時読み込み
- ローカルストレージ（`school-bell-settings@v1`）への自動保存でブラウザーを閉じても復元
- ガイドパネルで利用手順やトラブルシューティングをすぐ参照可能

## 画面構成と操作

- 右上の歯車ボタン … 設定ドロワーを開き、時間割名やチャイム一覧を編集
- はてなボタン … 教員向けのかんたんガイド
- 「リンクをコピー」 … 現在の時刻一覧とラベルを URL パラメーターに反映して共有
- 「時間割データをダウンロード」 … `{"label":"...", "rows":[{"time":"08:15"}]}` 形式の JSON を保存
- 「時間割データを読み込む」 … 保存済み JSON を選択するとそのまま復元
- 「チャイムをテスト再生」 … ブラウザーのオーディオガードを解除するために初回再生を促す
- 1 行を選択して Enter で下に新しい行を追加、矢印キーで上下移動

## プロジェクト構成

```
app/
  page.tsx        # UI とロジック（App Router, Client Component）
  globals.css     # Tailwind v4 ベースのカスタムスタイル
public/audio/
  chime.wav       # 再生するチャイム音
next.config.ts    # output: export / GitHub Pages 向け basePath 設定
```

主な技術スタックは Next.js 16 (App Router), React 19, TypeScript, Tailwind CSS v4, lucide-react です。

## ローカル開発

Node.js 18 以上を推奨します。

```bash
npm ci          # 依存関係のインストール
npm run dev     # http://localhost:3000 で開発サーバーを起動
npm run lint    # ESLint
npm run build   # 本番ビルド（静的エクスポート）
```

チャイムの初期値は `app/page.tsx` の `DEFAULT_TIMES` を編集すると変更できます。

## デプロイ（GitHub Pages）

`next.config.ts` で `output: "export"` を有効化しているため、`npm run build` で `out/` 配下に静的アセットが生成されます。GitHub Actions などで `out/` を `gh-pages` ブランチへデプロイしてください。

GitHub Pages（リポジトリ名が `username/school-bell` のような場合）では、以下を環境変数に設定するとアセットパスが自動で補正されます。

```bash
NEXT_PUBLIC_BASE_PATH=school-bell
```

独自ドメインを使う場合は `public/CNAME` を追加すると、エクスポート結果にも含まれます。

## ライセンス / 注意

効果音を差し替える場合は `public/audio/chime.wav` を同名で置き換えてください。また、ブラウザーのオートプレイポリシーによってはユーザーが明示的に「チャイムをテスト再生」を押すまで自動再生できない点に注意してください。
