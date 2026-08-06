import { defineConfig } from 'vite';

/* Порт зафиксирован: он указан в README и docs/08-development, и на него же
   настроены закладки у тех, кому модель показывают по локальной сети.
   strictPort не даёт Vite молча переехать на соседний порт, если 5188 занят, -
   лучше явная ошибка, чем страница, открывающаяся не там, где обещано. */
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
