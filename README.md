This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## GitHub Pages への公開

このリポジトリには `.github/workflows/deploy.yml` が含まれており、`main` ブランチに push すると自動でビルド＆公開されます。

1. GitHub のリポジトリ設定 → Pages で、ブランチに `gh-pages`、フォルダーに `/` を指定します（初回のみ）。
2. `main` に変更を push すると Actions が `npm ci && npm run build` を実行し、`out/` を GitHub Pages へデプロイします。
3. `workflow_dispatch` から手動実行も可能です。ベースパスは自動でリポジトリ名（`username.github.io` リポジトリの場合は空）に設定されます。
4. 独自ドメインを使う場合は `public/CNAME` を追加すると、エクスポート時に `out/CNAME` が含まれます。

これによりローカルでは `npm run dev`、本番公開は push だけで完結します。
