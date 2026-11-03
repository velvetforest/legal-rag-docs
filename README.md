# legal-rag-docs

Static design pages for Vietnamese Legal RAG, served by GitHub Pages from `main` at the repo root.

Live: https://velvetforest.github.io/legal-rag-docs/

## First deploy (once)

Run in this folder. Pages on a free account needs a public repo, so everything here is public.

```bash
gh repo create velvetforest/legal-rag-docs --public --source . --remote origin --push
gh api -X POST repos/velvetforest/legal-rag-docs/pages -f "source[branch]=main" -f "source[path]=/"
```

The site is up 1–2 minutes later. Check the build with:

```bash
gh api repos/velvetforest/legal-rag-docs/pages/builds/latest --jq .status
```

## Update a page

```bash
cp ../vietnamese-legal-rag/docs/model-ladder-design.html index.html
git add -A && git commit -m "Update model ladder page" && git push
```

## Add another page

Copy any self-contained `.html` file in, for example `slides.html`, then commit and push. It is served at
`https://velvetforest.github.io/legal-rag-docs/slides.html`. `.nojekyll` keeps GitHub from running Jekyll over the files.
