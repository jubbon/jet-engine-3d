# syntax=docker/dockerfile:1

# =============================== 1. build ===============================
# Pinned to 22 rather than tracking the newest: it is the version the project
# is developed and tested on, and an image build is a bad place to find out
# that the toolchain moved.
FROM node:22-alpine AS build

WORKDIR /app

# The manifests are copied on their own, ahead of the sources, so that the slow
# layer — some 50 MB of node_modules — survives every commit that does not
# touch a dependency. Copying everything first would reinstall on every edit.
COPY package.json package-lock.json ./

# ci, not install: the lockfile is committed, and an image that quietly
# resolved a newer Three.js would no longer be the commit it claims to be.
# Same reasoning as the CI workflow.
RUN npm ci

COPY . .
RUN npm run build

# =============================== 2. serve ===============================
# Nothing crosses from the build stage except dist/. No node_modules, no
# sources, no npm, no compiler — the runtime image holds the three files Vite
# emits and a web server, and there is nothing in it that could rebuild them.
FROM nginx:1.29-alpine AS serve

COPY docker/nginx.conf /etc/nginx/conf.d/default.conf

# The base image seeds the document root with its own index.html and 50x.html.
# Ours overwrites the first; the second would survive and be served at
# /50x.html — a stray page belonging to nobody, since the config that referred
# to it is the one just replaced. The root holds what Vite produced, nothing
# else.
RUN rm -rf /usr/share/nginx/html/*
COPY --from=build /app/dist /usr/share/nginx/html

# 5188 everywhere: it is what the dev server, the preview server, the README
# and docs/08 all say, and what people have bookmarked when the model is shown
# to them over the local network. A container that answered on 80 instead
# would be the one place the number differs.
EXPOSE 5188
