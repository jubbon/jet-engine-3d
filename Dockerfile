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
#
# --ignore-scripts, because npm ci otherwise runs whatever install hooks the
# dependency tree carries — here esbuild's, which is one compromised release
# away from executing during the image build with the build context on disk.
# Checked, not assumed: esbuild resolves its binary from the platform package
# in optionalDependencies, and without its hook the tests still pass and the
# bundle comes out with the same content hash.
RUN npm ci --ignore-scripts

COPY . .
RUN npm run build

# =============================== 2. serve ===============================
# Nothing crosses from the build stage except dist/. No node_modules, no
# sources, no npm, no compiler — the runtime image holds the three files Vite
# emits and a web server, and there is nothing in it that could rebuild them.
# The unprivileged variant, not plain nginx:alpine. The stock image runs its
# master process as root, and nothing here has a use for it: the server reads
# dist/ and hands it out, and never writes anything.
#
# Not because of the port, which is the reflex answer and does not survive a
# look. The usual reason an nginx image keeps root is the bind below 1024, and
# inside a container that reason has already gone — Docker sets
# net.ipv4.ip_unprivileged_port_start=0, against 1024 on the host. Built with
# `listen 80` and run as UID 101 this image binds it and answers 200, with
# CapEff 0000000000000000 in the container's own /proc/1/status. So the choice
# of port and the choice of user are independent, and 5188 is not what buys
# this; the root was simply never earning anything.
#
# The variant is the nginx team's own, same release cadence, and it is the
# supported way round rather than a chown of the stock image: it ships an
# nginx.conf with no `user` directive and with the pid and temp paths moved
# somewhere UID 101 can write. Patching those into nginx:alpine by hand means
# owning that list, and it grows quietly between releases.
FROM nginxinc/nginx-unprivileged:1.29-alpine AS serve

# The image drops to UID 101 as its last step, and the two commands below need
# a writable /usr/share/nginx/html, so they run before that is undone.
USER root

COPY docker/nginx.conf /etc/nginx/conf.d/default.conf

# The base image seeds the document root with its own index.html and 50x.html.
# Ours overwrites the first; the second would survive and be served at
# /50x.html — a stray page belonging to nobody, since the config that referred
# to it is the one just replaced. The root holds what Vite produced, nothing
# else.
RUN rm -rf /usr/share/nginx/html/*
COPY --from=build /app/dist /usr/share/nginx/html

# Back to the unprivileged user the image is built around. Nothing after this
# point needs more, and nothing the running server does needs more either: the
# document root is read, never written.
USER 101

# 5188 everywhere: it is what the dev server, the preview server, the README
# and docs/08 all say, and what people have bookmarked when the model is shown
# to them over the local network. A container that answered on 80 instead
# would be the one place the number differs.
#
# The stray 80/tcp that `docker ps` used to advertise is gone as a side effect
# of the base image change — this one declares 8080, which is no more true, but
# EXPOSE is inherited and a Dockerfile still cannot withdraw one. Nothing
# listens on either: the server block in docker/nginx.conf binds 5188 alone.
EXPOSE 5188
