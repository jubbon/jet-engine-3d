# The commands themselves stay in package.json and the Dockerfile; this file
# does not restate them. What it adds is the thing npm scripts cannot express —
# when work can be skipped. `npm run build` rebuilds unconditionally, every
# time; `make build` compares dist/ against the sources and does nothing if
# nothing moved. Same for the install: npm ci wipes and reinstalls 50 MB on
# every call, and make only calls it when the lockfile is newer than what is
# already unpacked.
#
# The consequence to know about: the file targets below are real files, so
# touching a source is what triggers a rebuild. If a build ever starts
# depending on something outside SOURCES, it belongs in that list or make will
# cheerfully report there is nothing to do.

IMAGE ?= jet-engine-3d
TAG   ?= dev
# host side only — the container always listens on 5188, as everything else in
# this project does
PORT  ?= 5188

SOURCES := $(shell find src -type f) index.html vite.config.js

# A bare `make` explains itself rather than starting a 50 MB install: the first
# person to type it here is more likely to be looking around than building.
.DEFAULT_GOAL := help

.PHONY: help install dev preview build test test-% image run clean distclean

# No colour codes: this gets piped and pasted as often as it gets read in a
# terminal, and escape sequences are noise everywhere except the one case.
help: ## show this list
	@grep -hE '^[a-zA-Z_-]+:.*?## ' $(MAKEFILE_LIST) \
	  | awk 'BEGIN {FS = ":.*?## "}; {printf "  %-12s %s\n", $$1, $$2}'
	@echo
	@echo "  test-<name>  run one test, e.g. make test-geometry"
	@echo "  Overrides:   IMAGE=$(IMAGE) TAG=$(TAG) PORT=$(PORT)"

## ------------------------------- node --------------------------------

install: node_modules ## install dependencies (only if the lockfile moved)

# ci rather than install, for the reason the CI workflow and the Dockerfile
# give: the lockfile is committed and is meant to be obeyed. The touch is not
# cosmetic — npm ci leaves the directory mtime older than the lockfile it just
# read, so without it every make invocation would reinstall.
node_modules: package-lock.json package.json
	npm ci
	@touch $@

dev: node_modules ## Vite dev server on 5188
	npm run dev

build: dist ## build into dist/ (skipped when nothing changed)

dist: node_modules $(SOURCES)
	npm run build
	@touch $@

preview: dist ## serve the built dist/ on 5188
	npm run preview

test: node_modules ## run all test files
	npm test

# One test by name: `make test-geometry` runs test/geometry.test.mjs. The tests
# take no runner and no flags, which is what makes this one line rather than a
# wrapper.
test-%: node_modules
	node test/$*.test.mjs

## ------------------------------ docker -------------------------------

image: ## build the container image
	docker build -t $(IMAGE):$(TAG) .

run: image ## build the image and serve it on the host port (PORT)
	docker run --rm -p $(PORT):5188 $(IMAGE):$(TAG)

## ------------------------------ cleaning -----------------------------

clean: ## remove dist/
	rm -rf dist

distclean: clean ## remove dist/ and node_modules/
	rm -rf node_modules
