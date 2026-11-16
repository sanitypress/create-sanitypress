# create-sanitypress

Create a new [SanityPress](https://sanitypress.dev) website (Next.js + Sanity) with starter content and agent skills.

```sh
npm create sanitypress@latest
# or
bun create sanitypress
pnpm create sanitypress
```

It runs `create-sanity` with the `nuotsu/sanitypress` template, then:

1. Imports starter content into your new dataset
2. Installs the SanityPress agent skills (`sanitypress/skills`)

## Options

```sh
npm create sanitypress@latest my-site -- --seed=demo --no-blog
```

| Option                       | Default   | Description                                                                 |
| ---------------------------- | --------- | --------------------------------------------------------------------------- |
| `[directory]`                | prompt    | Folder to create (first argument only)                                      |
| `--seed=minimal\|demo\|none` | `minimal` | Starter content to import                                                   |
| `--no-blog`                  | blog on   | Leave out the Blog page and blog post template (`minimal` only)             |

Anything else (`--project`, `--dataset`, `--organization`, `--template`, …) is passed to `create-sanity`.

### Seeds

- **minimal**: Site settings (`My SanityPress Website`), Home page (`/`), Blog page (`/blog`, Blog index module) and a global module adding Blog post content to every post (`blog/`).
- **demo**: the `demo.tar.gz` sample dataset shipped with the template (navigation, 404 page, a sample post).
- **none**: an empty dataset.

Documents use fixed IDs and import with `--missing`, so existing content is never overwritten.

## Telemetry

Sends anonymous events (`create_started`, `create_completed`, `create_failed`) with the CLI version, package manager, chosen options, OS and Node version. No names, paths, project IDs or tokens. Disabled in CI and with `DO_NOT_TRACK=1` or `SANITYPRESS_TELEMETRY_DISABLED=1`.

## Development

```sh
node index.js my-site --dry-run   # print commands without running them
```
