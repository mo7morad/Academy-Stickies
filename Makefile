# Academy Stickies — Cloudflare deploy
# The site is served from the Cloudflare Pages link: https://<PROJECT>.pages.dev
# Run `make help` to list targets. Override any variable, e.g. `make deploy PROJECT=my-app`.

PROJECT   ?= academy-stickies
D1_NAME   ?= stickies-db
R2_NAME   ?= stickies-media
BRANCH    ?= main
SITE_URL  ?= https://$(PROJECT).pages.dev
WRANGLER  ?= npx wrangler

.DEFAULT_GOAL := help
.PHONY: help install login create schema build deploy secret-session secrets-email \
        seed links invite tail url setup release

help: ## List available targets
	@grep -hE '^[a-zA-Z_-]+:.*?## ' $(MAKEFILE_LIST) \
	  | awk 'BEGIN{FS=":.*?## "}{printf "  \033[36m%-15s\033[0m %s\n", $$1, $$2}'
	@echo ""
	@echo "  PROJECT=$(PROJECT)   SITE_URL=$(SITE_URL)"

install: ## Install npm dependencies
	npm install

login: ## Authenticate wrangler with your Cloudflare account
	$(WRANGLER) login

create: ## One-time: create the Pages project, D1 database and R2 bucket
	-$(WRANGLER) pages project create $(PROJECT) --production-branch=$(BRANCH)
	-$(WRANGLER) r2 bucket create $(R2_NAME)
	@echo "==> Creating D1 database $(D1_NAME)"
	@out=$$($(WRANGLER) d1 create $(D1_NAME) 2>&1 || true); echo "$$out"; \
	  id=$$(echo "$$out" | grep -oiE '[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}' | head -1); \
	  if [ -n "$$id" ]; then \
	    sed -i.bak "s/REPLACE_WITH_D1_DATABASE_ID/$$id/" wrangler.toml && rm -f wrangler.toml.bak; \
	    echo "==> Wired database_id=$$id into wrangler.toml"; \
	  else \
	    echo "==> No new database_id captured (it may already exist) — check wrangler.toml."; \
	  fi

schema: ## Apply schema.sql to the remote D1 database
	npm run db:remote

build: ## Build the frontend (vite -> dist/)
	npm run build

deploy: build ## Build and deploy to Cloudflare Pages (production)
	$(WRANGLER) pages deploy --project-name=$(PROJECT) --branch=$(BRANCH) --commit-dirty=true
	@echo "==> Live at $(SITE_URL)"

secret-session: ## Generate + set SESSION_SECRET on Pages (required)
	@SECRET=$$(openssl rand -base64 48 | tr -d '\n'); \
	  printf '%s' "$$SECRET" | $(WRANGLER) pages secret put SESSION_SECRET --project-name=$(PROJECT); \
	  echo "==> SESSION_SECRET set"

secrets-email: ## Set email secrets (needs BREVO_API_KEY, EMAIL_FROM)
	@test -n "$(BREVO_API_KEY)" && test -n "$(EMAIL_FROM)" || { \
	  echo "Provide the email vars, e.g.:"; \
	  echo "  make secrets-email BREVO_API_KEY=xkeysib-xxx EMAIL_FROM=you@gmail.com"; \
	  exit 1; }
	@printf '%s' "$(BREVO_API_KEY)" | $(WRANGLER) pages secret put BREVO_API_KEY --project-name=$(PROJECT)
	@printf '%s' "$(EMAIL_FROM)"    | $(WRANGLER) pages secret put EMAIL_FROM --project-name=$(PROJECT)
	@echo "==> Email secrets set"

seed: ## Load seed/roster.json into the remote D1 database
	npm run seed:remote

links: ## Print each member's magic link (pointing at the Pages URL)
	npm run links:remote -- --site=$(SITE_URL)

invite: ## Email each member their magic link (requires email configured)
	npm run invite:remote -- --site=$(SITE_URL)

tail: ## Stream live logs from the deployed Pages Functions
	$(WRANGLER) pages deployment tail --project-name=$(PROJECT)

url: ## Print the site URL
	@echo $(SITE_URL)

setup: install create schema secret-session ## First-time bootstrap (deps, resources, schema, secret)
	@echo "==> Setup done. Next: make deploy && make seed && make links"

release: deploy seed links ## Deploy, load the roster, and print the magic links
