# Airborne Project Makefile
# Consolidated build system for the entire Airborne project
# Manages server, analytics, infrastructure, and development workflows
SHELL := /usr/bin/env bash
SUPERPOSITION_URL ?= http://localhost:8080
KEYCLOAK_HOST_URL ?= http://localhost:8180/realms/master
LOCALSTACK_HOST_URL ?= http://localhost:4566/_localstack/health
POSTGRES_HOST ?= localhost
POSTGRES_PORT ?= 5433
FMT_FLAGS := --all
LINT_FLAGS := --all-targets
CARGO_FLAGS := --color always --no-default-features


# ANSI color codes
export GREEN := $(shell printf '\033[0;32m')
export YELLOW := $(shell printf '\033[1;33m')
export RED := $(shell printf '\033[0;31m')
export NC := $(shell printf '\033[0m') # No Color


# Docker detection
HAS_DOCKER := $(shell command -v docker > /dev/null; echo $$?)
HAS_PODMAN := $(shell command -v podman > /dev/null; echo $$?)
ifeq ($(HAS_DOCKER),0)
  DOCKER := docker
else ifeq ($(HAS_PODMAN),0)
  DOCKER := podman
  export PODMAN_COMPOSE_WARNING_LOGS = false
else
	$(error "Neither docker nor podman found, please install one of them.")
endif
COMPOSE := $(DOCKER) compose

define read-container-name 
	yq -r '.services["$(2)"].container_name' $(1)/docker-compose.yml
endef

define check-container
	$(DOCKER) ps | grep $(1) 2>&1 > /dev/null; echo $$?
endef

DB_CONTAINER_NAME = $(shell $(call read-container-name,server,postgres))
DB_UP = $(shell $(call check-container,$(DB_CONTAINER_NAME)))

LSTACK_CONTAINER_NAME = $(shell $(call read-container-name,server,localstack))
LSTACK_UP = $(shell $(call check-container,$(LSTACK_CONTAINER_NAME)))

SUPERPOSITION_CONTAINER_NAME = $(shell $(call read-container-name,server,superposition))
SUPERPOSITION_UP = $(shell $(call check-container,$(SUPERPOSITION_CONTAINER_NAME)))

KEYCLOAK_DB_CONTAINER_NAME = $(shell $(call read-container-name,server,keycloak-db))
KEYCLOAK_DB_UP = $(shell $(call check-container,$(KEYCLOAK_DB_CONTAINER_NAME)))

KEYCLOAK_CONTAINER_NAME = $(shell $(call read-container-name,server,keycloak))
KEYCLOAK_UP = $(shell $(call check-container,$(KEYCLOAK_CONTAINER_NAME)))

.PHONY: help env-file db localstack superposition keycloak-db keycloak setup airborne-server superposition-init keycloak-init localstack-init db-migration kill run stop cleanup test status lint-fix check fmt lint commit amend amend-no-edit node-dependencies dashboard docs home analytics-server run-kafka-clickhouse run-victoria-metrics run-analytics

default: help

help:
	@echo "$(GREEN)Airborne Project Management$(NC)"
	@echo ""
	@echo "$(YELLOW)Main Commands:$(NC)"
	@printf "  $(GREEN)%-20s$(NC) %s\n" "run" "Run the complete Airborne server development environment"
	@printf "  $(GREEN)%-20s$(NC) %s\n" "run-analytics" "Run the analytics server development environment"
	@printf "  $(GREEN)%-20s$(NC) %s\n" "stop" "Stop all services gracefully"
	@printf "  $(GREEN)%-20s$(NC) %s\n" "status" "Show current system status"
	@printf "  $(GREEN)%-20s$(NC) %s\n" "test" "Run test suite"
	@printf "  $(GREEN)%-20s$(NC) %s\n" "cleanup" "Clean up containers and volumes"
	@echo ""
	@echo "$(YELLOW)Setup Commands:$(NC)"
	@printf "  $(GREEN)%-20s$(NC) %s\n" "setup" "Set up all dependencies (db, services, etc.)"
	@printf "  $(GREEN)%-20s$(NC) %s\n" "env-file" "Create .env file from .env.example"
	@printf "  $(GREEN)%-20s$(NC) %s\n" "airborne-server" "Build the Airborne server"
	@printf "  $(GREEN)%-20s$(NC) %s\n" "analytics-server" "Build the analytics server"
	@echo ""
	@echo "$(YELLOW)Infrastructure Services:$(NC)"
	@printf "  $(GREEN)%-20s$(NC) %s\n" "db" "Start PostgreSQL database"
	@printf "  $(GREEN)%-20s$(NC) %s\n" "localstack" "Start LocalStack (AWS mock)"
	@printf "  $(GREEN)%-20s$(NC) %s\n" "superposition" "Start Superposition service"
	@printf "  $(GREEN)%-20s$(NC) %s\n" "keycloak" "Start Keycloak authentication"
	@printf "  $(GREEN)%-20s$(NC) %s\n" "keycloak-db" "Start Keycloak database"
	@echo ""
	@echo "$(YELLOW)Frontend Build Commands:$(NC)"
	@printf "  $(GREEN)%-20s$(NC) %s\n" "node-dependencies" "Install Node.js dependencies for React apps"
	@printf "  $(GREEN)%-20s$(NC) %s\n" "dashboard" "Build the dashboard React app"
	@printf "  $(GREEN)%-20s$(NC) %s\n" "docs" "Build the docs React app"
	@printf "  $(GREEN)%-20s$(NC) %s\n" "home" "Build the home React app"
	@echo ""
	@echo "$(YELLOW)Analytics Development:$(NC)"
	@printf "  $(GREEN)%-20s$(NC) %s\n" "run-kafka-clickhouse" "Run analytics with Kafka + ClickHouse stack"
	@printf "  $(GREEN)%-20s$(NC) %s\n" "run-victoria-metrics" "Run analytics with Grafana + Victoria Metrics stack"
	@echo ""
	@echo "$(YELLOW)Database Commands:$(NC)"
	@printf "  $(GREEN)%-20s$(NC) %s\n" "db-migration" "Run database migrations using Diesel"
	@echo ""
	@echo "$(YELLOW)Initialization Commands:$(NC)"
	@printf "  $(GREEN)%-20s$(NC) %s\n" "superposition-init" "Initialize Superposition organization"
	@printf "  $(GREEN)%-20s$(NC) %s\n" "keycloak-init" "Initialize Keycloak realm and client"
	@printf "  $(GREEN)%-20s$(NC) %s\n" "localstack-init" "Initialize LocalStack S3 buckets"
	@echo ""
	@echo "$(YELLOW)Utility Commands:$(NC)"
	@printf "  $(GREEN)%-20s$(NC) %s\n" "kill" "Kill running airborne-server processes"
	@echo ""
	@echo "$(YELLOW)Code Quality Commands:$(NC)"
	@printf "  $(GREEN)%-20s$(NC) %s\n" "check" "Run format check and linting (CI mode)"
	@printf "  $(GREEN)%-20s$(NC) %s\n" "fmt" "Format Rust code using rustfmt"
	@printf "  $(GREEN)%-20s$(NC) %s\n" "lint" "Run Clippy linter on Rust code"
	@printf "  $(GREEN)%-20s$(NC) %s\n" "lint-fix" "Run Clippy with automatic fixes"
	@echo ""
	@echo "$(YELLOW)Git Integration Commands:$(NC)"
	@printf "  $(GREEN)%-20s$(NC) %s\n" "commit" "Run quality checks and commit changes"
	@printf "  $(GREEN)%-20s$(NC) %s\n" "amend" "Amend the last commit with quality checks"
	@printf "  $(GREEN)%-20s$(NC) %s\n" "amend-no-edit" "Amend the last commit without editing message"
	@echo ""
	@echo "$(YELLOW)Usage Examples:$(NC)"
	@echo "  make run                    # Start Airborne server for development"
	@echo "  make run-analytics          # Start analytics server for development"
	@echo "  make setup                  # Set up dependencies only"
	@echo "  make status                 # Check what's running"
	@echo "  make cleanup                # Clean up and start fresh"
	@echo "  make db-migration           # Run database migrations"


env-file:
	@echo "$(YELLOW)🔧 Checking environment file...$(NC)"
	@if ! [ -e server/.env ]; then \
		echo "$(YELLOW).env missing, copying .env.example as .env$(NC)" && \
		cp server/.env.example server/.env; \
		cat server/.env.docker.extra >> server/.env; \
	fi
	@if ! [ -e analytics/.env ]; then \
		echo "$(YELLOW).env missing, copying .env.example as .env$(NC)" && \
		cp analytics/.env.example analytics/.env; \
	fi
	@echo "$(GREEN)✅ Environment file ready$(NC)"


db:
ifndef CI
ifeq ($(DB_UP),1)
	@echo "$(YELLOW)🐘 Starting PostgreSQL container...$(NC)"
	$(COMPOSE) -f server/docker-compose.yml up -d postgres
endif
else
	@echo "$(YELLOW)Skipping postgres container-setup in CI.$(NC)"
endif
	@echo "$(YELLOW)🐘 Checking PostgreSQL connection...$(NC)"
	@while ! pg_isready -h $(POSTGRES_HOST) -p $(POSTGRES_PORT) >/dev/null 2>&1; do \
		printf "."; sleep 1; \
	done
	@echo "$(GREEN) ✅ PostgreSQL ready$(NC)"


localstack:
ifndef CI
ifeq ($(LSTACK_UP),1)
	@echo "$(YELLOW)☁️  Starting LocalStack container...$(NC)"
	$(COMPOSE) -f server/docker-compose.yml up -d localstack
endif
else
	@echo "$(YELLOW)Skipping localstack container-setup in CI.$(NC)"
endif
	@echo "$(YELLOW)☁️  Checking LocalStack connection...$(NC)"
	@RETRY=0; \
	while [ $$RETRY -lt 30 ]; do \
		if curl -s -f $(LOCALSTACK_HOST_URL) >/dev/null 2>&1; then \
			break; \
		fi; \
		printf "."; sleep 1; RETRY=$$((RETRY + 1)); \
	done
	@echo "$(GREEN) ✅ LocalStack ready$(NC)"


superposition:
ifndef CI
ifeq ($(SUPERPOSITION_UP),1)
	@echo "$(YELLOW)📊 Starting Superposition container...$(NC)"
	$(COMPOSE) -f server/docker-compose.yml up -d superposition
endif
else
	@echo "$(YELLOW)Skipping superposition container-setup in CI.$(NC)"
endif
	@echo "$(YELLOW)📊 Checking Superposition health...$(NC)"
	@RETRY=0; \
	while [ $$RETRY -lt 60 ]; do \
		if curl -s -o /dev/null -w "%{http_code}" "$(SUPERPOSITION_URL)/health" | grep -E "200" >/dev/null; then \
			break; \
		fi; \
		printf "."; sleep 2; RETRY=$$((RETRY + 1)); \
	done
	@echo "$(GREEN) ✅ Superposition ready$(NC)"


keycloak-db:
ifndef CI
ifeq ($(KEYCLOAK_DB_UP),1)
	@echo "$(YELLOW)🔑 Starting Keycloak DB container...$(NC)"
	$(COMPOSE) -f server/docker-compose.yml up -d keycloak-db
endif
else
	@echo "$(YELLOW)Skipping keycloak-db container-setup in CI.$(NC)"
endif
	@echo "$(YELLOW)🔑 Checking Keycloak DB connection...$(NC)"
	@RETRY=0; \
	while [ $$RETRY -lt 30 ]; do \
		if $(DOCKER) exec $(KEYCLOAK_DB_CONTAINER_NAME) pg_isready -U keycloak >/dev/null 2>&1; then \
			break; \
		fi; \
		printf "."; sleep 1; RETRY=$$((RETRY + 1)); \
	done
	@echo "$(GREEN) ✅ Keycloak DB ready$(NC)"


keycloak:
ifndef CI
ifeq ($(KEYCLOAK_UP),1)
	@echo "$(YELLOW)🔑 Starting Keycloak container...$(NC)"
	$(COMPOSE) -f server/docker-compose.yml up -d keycloak
endif
else
	@echo "$(YELLOW)Skipping keycloak container-setup in CI.$(NC)"
endif
	@echo "$(YELLOW)🔑 Checking Keycloak health...$(NC)"
	@RETRY=0; \
	while [ $$RETRY -lt 60 ]; do \
		if curl -s -f $(KEYCLOAK_HOST_URL) >/dev/null 2>&1; then \
			break; \
		fi; \
		printf "."; sleep 2; RETRY=$$((RETRY + 1)); \
	done
	@echo "$(GREEN) ✅ Keycloak ready$(NC)"

node-dependencies:
	cd server/dashboard_react && npm ci
	cd server/docs_react && npm ci
	cd server/home_react && npm ci

dashboard:
	cd server/dashboard_react && npm run build:dev

docs:
	cd server/docs_react && npm run build:dev

home:
	cd server/home_react && npm run build:dev

SETUP_DEPS = env-file db superposition keycloak-db keycloak localstack node-dependencies
# ifdef CI
# 	SETUP_DEPS += test-tenant
# endif
setup: $(SETUP_DEPS)

airborne-server:
	@echo "$(YELLOW)Building airborne-server...$(NC)"
	@cd server && cargo build $(CARGO_FLAGS) --bin airborne-server

superposition-init:
	@echo "$(YELLOW)📊 Initializing Superposition...$(NC)"
	@cd server && ./scripts/init-superposition.sh

keycloak-init:
	@echo "$(YELLOW)🔑 Initializing Keycloak...$(NC)"
	@cd server && ./scripts/init-keycloak.sh

localstack-init:
	@echo "$(YELLOW)☁️  Initializing LocalStack...$(NC)"
	@cd server && ./scripts/init-localstack.sh

db-migration:
	@echo "$(YELLOW)🗄️  Running database migrations...$(NC)"
	@if [ -f server/.env ]; then \
		set -a; \
		. server/.env; \
		set +a; \
	fi; \
	if [ -z "$$DATABASE_URL" ] && [ -z "$$DB_URL" ]; then \
		echo "$(YELLOW)DATABASE_URL and DB_URL not set by env file. Constructing with default password 'postgres' for migrations.$(NC)"; \
		export DATABASE_URL="postgresql://$${DB_USER}:postgres@$${DB_HOST}:$${DB_PORT}/$${DB_NAME}"; \
	elif [ -n "$$DB_URL" ]; then \
		export DATABASE_URL="$$DB_URL"; \
	fi; \
	if (cd server && diesel migration run); then \
		echo "$(GREEN)✅ Database migrations completed$(NC)"; \
	else \
		echo "$(RED)❌ Database migrations failed$(NC)"; \
		exit 1; \
	fi

kill:
	@echo "$(YELLOW)🔪 Killing existing airborne-server processes...$(NC)"
	-@pkill -f server/target/debug/airborne-server 2>/dev/null || true
	@echo "$(GREEN)✅ Process cleanup completed$(NC)"

run: kill db superposition superposition-init keycloak-db keycloak keycloak-init localstack localstack-init
	@trap 'kill 0' INT TERM; \
	$(MAKE) dashboard & \
	$(MAKE) docs & \
	$(MAKE) home & \
	cd server && cargo watch -w src -w Cargo.toml -w ../Cargo.toml -w ../Cargo.lock -s 'make airborne-server && ../target/debug/airborne-server' & \
	wait

stop:
	@echo "$(YELLOW)🛑 Stopping all services...$(NC)"
	@$(COMPOSE) -f server/docker-compose.yml down 2>/dev/null || true
	@echo "$(GREEN)✅ All services stopped.$(NC)"

cleanup:
	@echo "$(YELLOW)🧹 Cleaning up containers and volumes...$(NC)"
	@$(COMPOSE) -f server/docker-compose.yml down -v --remove-orphans 2>/dev/null || true
	@echo "$(YELLOW)🗑️  Removing environment file...$(NC)"
	@rm -f server/.env
	@echo "$(GREEN)✅ Cleanup completed$(NC)"

test:
	@echo "$(GREEN)🧪 Running full test suite...$(NC)"
	@$(MAKE) clean
	@echo "$(GREEN)Running tests...$(NC)"
	@echo "$(YELLOW)TODO: Add actual test commands here$(NC)"
	@echo "$(GREEN)✅ Tests completed.$(NC)"

status:
	@echo "$(GREEN)📊 Airborne System Status$(NC)"
	@echo ""
	@echo "$(YELLOW)🏗️  Infrastructure Services:$(NC)"
	$(call service_status_simple,PostgreSQL,postgres)
	$(call service_status_simple,Superposition,superposition)
	$(call service_status_simple,Keycloak-DB,keycloak-db)
	$(call service_status_simple,Keycloak,keycloak)
	$(call service_status_simple,LocalStack,localstack)
	@echo ""
	@echo "$(YELLOW)🔧 Initialization Status:$(NC)"
	$(call init_status_simple,Environment,server/.env)
	@echo ""
	@echo "$(YELLOW)🐳 Container Status:$(NC)"
	@$(COMPOSE) -f server/docker-compose.yml ps --format "table {{.Service}}\t{{.State}}\t{{.Status}}" 2>/dev/null || echo "$(YELLOW)No containers running$(NC)"
	@echo ""

lint-fix: LINT_FLAGS += --fix --allow-dirty --allow-staged
lint-fix: lint

check: FMT_FLAGS += --check
check: LINT_FLAGS += -- -Dwarnings
check: fmt lint

fmt:
	cargo fmt $(FMT_FLAGS)

lint:
	cargo clippy $(LINT_FLAGS)

commit: check
	git commit $(COMMIT_FLAGS)

amend: COMMIT_FLAGS += --amend
amend: commit

amend-no-edit: COMMIT_FLAGS += --no-edit
amend-no-edit: amend

analytics-server:
	@echo "$(YELLOW)Building analytics-server...$(NC)"
	@cd server && cargo build $(CARGO_FLAGS) --bin analytics-server

ENV_FILE_KC    ?= analytics/.env.kafka-clickhouse
run-kafka-clickhouse:
	@echo "⏳ Starting dev environment: Kafka + ClickHouse"
	@$(COMPOSE) -f analytics/docker-compose.yml --env-file $(ENV_FILE_KC) up -d zookeeper kafka clickhouse-server kafka-ui
	@cd analytics && cargo watch -w src -w Cargo.toml -w ../Cargo.toml -w ../Cargo.lock -s 'make analytics-server && ../target/debug/analytics-server'
	@echo "✅ Development environment started with Kafka and ClickHouse!"
	@echo "   • Kafka UI:     http://localhost:8080"
	@echo "   • ClickHouse:   http://localhost:8123"
	@echo "   • Backend API:  http://localhost:6400"


ENV_FILE_VM    ?= analytics/.env.victoria-metrics
run-victoria-metrics:
	@echo "⏳ Starting dev environment: Grafana + Victoria Metrics"
	@$(COMPOSE) -f analytics/docker-compose.yml --env-file $(ENV_FILE_VM) up -d grafana victoria-metrics
	@cd analytics && cargo watch -w src -w Cargo.toml -w ../Cargo.toml -w ../Cargo.lock -s 'make analytics-server && ../target/debug/analytics-server'
	@echo "✅ Development environment started with Grafana & Victoria Metrics!"
	@echo "   • Grafana:          http://localhost:4000"
	@echo "   • Victoria Metrics: http://localhost:8428"
	@echo "   • Backend API:      http://localhost:6400"


run-analytics: run-victoria-metrics

# ==============================================================================
# INTERNAL HELPER FUNCTIONS (not exposed to users)
# ==============================================================================

# Check if container is running
define is_container_running
$(shell $(DOCKER) ps --filter "name=$(1)" --filter "status=running" --format "{{.Names}}" 2>/dev/null)
endef

# Simplified status display
define service_status_simple
	@printf "  %-12s " "$(1):"; \
	if [ -n "$(call is_container_running,$(2))" ]; then \
		printf "$(GREEN)●$(NC) Running"; \
	else \
		printf "$(RED)●$(NC) Stopped"; \
	fi; \
	echo ""
endef

# Simplified init status
define init_status_simple
	@printf "  %-12s " "$(1):"; \
	if [ -f $(2) ]; then \
		printf "$(GREEN)✅$(NC) Ready"; \
	else \
		printf "$(YELLOW)⏳$(NC) Pending"; \
	fi; \
	echo ""
endef



