import { defineConfig } from 'vite';

/* The port is pinned: it is quoted in README and docs/08-development, and it is
   what people have bookmarked when the model is shown to them over the local
   network. strictPort stops Vite from silently moving to the next port if 5188
   is taken - an explicit error beats a page that opens somewhere other than
   where it was promised. */
export default defineConfig({
  server: {
    host: '0.0.0.0',
    port: 5188,
    strictPort: true,
  },
  preview: {
    host: '0.0.0.0',
    port: 5188,
    strictPort: true,
  },
});
