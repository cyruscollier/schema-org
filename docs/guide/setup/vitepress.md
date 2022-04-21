# VitePress Schema.org

## Install

```bash
# NPM
npm install -D vueuse-schema-org
# or Yarn
yarn add -D vueuse-schema-org
# or PNPM
pnpm add -D vueuse-schema-org
```


This package depends on `useHead` being available from `@vueuse/head`. You'll need to install this package
if you haven't already got it.

```bash
# NPM
npm install -D @vueuse/head
# or Yarn
yarn add -D @vueuse/head
# or PNPM
pnpm add -D @vueuse/head
```

## Usage

Modify your `.vitepress/theme/index.ts` file to add the plugin.

```ts
import DefaultTheme from 'vitepress/theme'
import { createSchemaOrg } from 'vueuse-schema-org'
import { createHead, useHead } from '@vueuse/head'
import { useRoute } from 'vitepress'
import MyLayout from './MyLayout.vue'

export default {
  ...DefaultTheme,
  Layout: MyLayout,
  enhanceApp({ app }) {
    const head = createHead()
    const schemaOrg = createSchemaOrg({
      // providing a host is required for SSR
      canonicalHost: 'https://schema-org.vueuse.com',
      useHead,
      useRoute,
    })
    app.use(head)
    app.use(schemaOrg)
  },
}
```

## Next Steps


When writing markdown files in VitePress you can provide page data through the frontmatter.

For example, in VitePress we have the exposed meta as follows:

<script setup>
import { useSchemaOrg } from 'vueuse-schema-org'
const { currentRouteMeta } = useSchemaOrg()
</script>

```json
{ 
  "title": "Using Route Meta",
  "description": "", 
  "frontmatter": {}, 
  "headers": [], 
  "relativePath": "guide/using-route-meta.md"
}
```