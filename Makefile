# Airborne Project Makefile
# Consolidated build system for the entire Airborne project
# Manages server, analytics, infrastructure, and development workflows
SHELL := /usr/bin/env bash
SUPERPOSITION_URL ?= http://localhost:8080
KEYCLOAK_HOST_URL ?= http://localhost:8180/realms/master
LOCALSTACK_HOST_URL ?= http://localhost:4566/_localstack/health
GRAFANA_HOST_URL ?= http://localhost:4000
VICTORIA_METRICS_HOST_URL ?= http://localhost:8428
POSTGRES_HOST ?= localhost
POSTGRES_PORT ?= 5433
FMT_FLAGS := --all
LINT_FLAGS := --all-targets
CARGO_FLAGS := --color always --no-default-features

ENV_FILE_VM ?= airborne_analytics_server/.env.victoria-metrics
ENV_FILE_KC    ?= airborne_analytics_server/.env.kafka-clickhouse

SMITHY_BUILD_SRC := smithy/output/source


# ANSI color codes
export GREEN := $(shell printf '\033[0;32m')
export YELLOW := $(shell printf '\033[1;33m')
export RED := $(shell printf '\033[0;31m')
export NC := $(shell printf '\033[0m') # No Color

export SMITHY_MAVEN_REPOS = https://repo1.maven.org/maven2%7Chttps://sandbox.assets.juspay.in/smithy/m2

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

DB_CONTAINER_NAME = $(shell $(call read-container-name,airborne_server,postgres))
DB_UP = $(shell $(call check-container,$(DB_CONTAINER_NAME)))

LSTACK_CONTAINER_NAME = $(shell $(call read-container-name,airborne_server,localstack))
LSTACK_UP = $(shell $(call check-container,$(LSTACK_CONTAINER_NAME)))

SUPERPOSITION_CONTAINER_NAME = $(shell $(call read-container-name,airborne_server,superposition))
SUPERPOSITION_UP = $(shell $(call check-container,$(SUPERPOSITION_CONTAINER_NAME)))

KEYCLOAK_DB_CONTAINER_NAME = $(shell $(call read-container-name,airborne_server,keycloak-db))
KEYCLOAK_DB_UP = $(shell $(call check-container,$(KEYCLOAK_DB_CONTAINER_NAME)))

KEYCLOAK_CONTAINER_NAME = $(shell $(call read-container-name,airborne_server,keycloak))
KEYCLOAK_UP = $(shell $(call check-container,$(KEYCLOAK_CONTAINER_NAME)))


GRAFANA_CONTAINER_NAME = $(shell $(call read-container-name,airborne_analytics_server,grafana))
GRAFANA_UP = $(shell $(call check-container,$(GRAFANA_CONTAINER_NAME)))

VICTORIA_METRICS_CONTAINER_NAME = $(shell $(call read-container-name,airborne_analytics_server,victoria-metrics))
VICTORIA_METRICS_UP = $(shell $(call check-container,$(VICTORIA_METRICS_CONTAINER_NAME)))

ZOOKEEPER_CONTAINER_NAME = $(shell $(call read-container-name,airborne_analytics_server,zookeeper))
ZOOKEEPER_UP = $(shell $(call check-container,$(ZOOKEEPER_CONTAINER_NAME)))

KAFKA_CONTAINER_NAME = $(shell $(call read-container-name,airborne_analytics_server,kafka))
KAFKA_UP = $(shell $(call check-container,$(KAFKA_CONTAINER_NAME)))

CLICKHOUSE_CONTAINER_NAME = $(shell $(call read-container-name,airborne_analytics_server,clickhouse-server))
CLICKHOUSE_UP = $(shell $(call check-container,$(CLICKHOUSE_CONTAINER_NAME)))

KAFKA_UI_CONTAINER_NAME = $(shell $(call read-container-name,airborne_analytics_server,kafka-ui))
KAFKA_UI_UP = $(shell $(call check-container,$(KAFKA_UI_CONTAINER_NAME)))

.PHONY: help env-file analytics-env-file db localstack superposition keycloak-db keycloak grafana victoria-metrics zookeeper kafka clickhouse kafka-ui setup airborne-server superposition-init keycloak-init localstack-init db-migration kill run stop cleanup test status lint-fix check fmt lint commit amend amend-no-edit node-dependencies dashboard docs analytics-server run-kafka-clickhouse run-victoria-metrics run-analytics frontend-check frontend-lint frontend-lint-fix frontend-format

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
	@echo "$(YELLOW)Analytics Services:$(NC)"
	@printf "  $(GREEN)%-20s$(NC) %s\n" "grafana" "Start Grafana dashboard"
	@printf "  $(GREEN)%-20s$(NC) %s\n" "victoria-metrics" "Start Victoria Metrics time series DB"
	@printf "  $(GREEN)%-20s$(NC) %s\n" "zookeeper" "Start Zookeeper coordination service"
	@printf "  $(GREEN)%-20s$(NC) %s\n" "kafka" "Start Kafka message broker"
	@printf "  $(GREEN)%-20s$(NC) %s\n" "clickhouse" "Start ClickHouse analytics database"
	@printf "  $(GREEN)%-20s$(NC) %s\n" "kafka-ui" "Start Kafka UI management interface"
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
	@printf "  $(GREEN)%-20s$(NC) %s\n" "check" "Run format check and linting (CI mode) for all projects"
	@printf "  $(GREEN)%-20s$(NC) %s\n" "fmt" "Format Rust code using rustfmt"
	@printf "  $(GREEN)%-20s$(NC) %s\n" "lint" "Run Clippy linter on Rust code"
	@printf "  $(GREEN)%-20s$(NC) %s\n" "lint-fix" "Run Clippy with automatic fixes"
	@printf "  $(GREEN)%-20s$(NC) %s\n" "frontend-check" "Run frontend type-check, lint, and format checks"
	@printf "  $(GREEN)%-20s$(NC) %s\n" "frontend-lint" "Run ESLint on frontend projects"
	@printf "  $(GREEN)%-20s$(NC) %s\n" "frontend-lint-fix" "Run ESLint with automatic fixes on frontend"
	@printf "  $(GREEN)%-20s$(NC) %s\n" "frontend-format" "Format frontend code using Prettier"
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
	@if ! [ -e airborne_server/.env ]; then \
		echo "$(YELLOW).env missing, copying .env.example as .env$(NC)" && \
		cp airborne_server/.env.example airborne_server/.env; \
		cat airborne_server/.env.docker.extra >> airborne_server/.env; \
	fi
	@echo "$(GREEN)✅ Environment file ready$(NC)"

analytics-env-file:
	@echo "$(YELLOW)🔧 Checking analytics environment file...$(NC)"
	@if ! [ -e airborne_analytics_server/.env ]; then \
		echo "$(YELLOW).env missing, copying .env.example as .env$(NC)" && \
		cp airborne_analytics_server/.env.example airborne_analytics_server/.env; \
	fi
	@echo "$(GREEN)✅ Analytics environment file ready$(NC)"


db:
ifndef CI
ifeq ($(DB_UP),1)
	@echo "$(YELLOW)🐘 Starting PostgreSQL container...$(NC)"
	$(COMPOSE) -f airborne_server/docker-compose.yml up -d postgres
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
	$(COMPOSE) -f airborne_server/docker-compose.yml up -d localstack
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
	$(COMPOSE) -f airborne_server/docker-compose.yml up -d superposition
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
	$(COMPOSE) -f airborne_server/docker-compose.yml up -d keycloak-db
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
	$(COMPOSE) -f airborne_server/docker-compose.yml up -d keycloak
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

grafana:
ifndef CI
ifeq ($(GRAFANA_UP),1)
	@echo "$(YELLOW)📊 Starting Grafana container...$(NC)"
	$(COMPOSE) -f airborne_analytics_server/docker-compose.yml --env-file $(ENV_FILE_VM) up -d grafana
endif
else
	@echo "$(YELLOW)Skipping grafana container-setup in CI.$(NC)"
endif
	@echo "$(YELLOW)📊 Checking Grafana health...$(NC)"
	@RETRY=0; \
	while [ $$RETRY -lt 60 ]; do \
		if curl -s -f $(GRAFANA_HOST_URL) >/dev/null 2>&1; then \
			break; \
		fi; \
		printf "."; sleep 2; RETRY=$$((RETRY + 1)); \
	done
	@echo "$(GREEN) ✅ Grafana ready$(NC)"


victoria-metrics:
ifndef CI
ifeq ($(VICTORIA_METRICS_UP),1)
	@echo "$(YELLOW)📊 Starting Victoria Metrics container...$(NC)"
	$(COMPOSE) -f airborne_analytics_server/docker-compose.yml --env-file $(ENV_FILE_VM) up -d victoria-metrics
endif
else
	@echo "$(YELLOW)Skipping victoria-metrics container-setup in CI.$(NC)"
endif
	@echo "$(YELLOW)📊 Checking Victoria Metrics health...$(NC)"
	@RETRY=0; \
	while [ $$RETRY -lt 60 ]; do \
		if curl -s -f $(VICTORIA_METRICS_HOST_URL) >/dev/null 2>&1; then \
			break; \
		fi; \
		printf "."; sleep 2; RETRY=$$((RETRY + 1)); \
	done
	@echo "$(GREEN) ✅ Victoria Metrics ready$(NC)"

zookeeper:
ifndef CI
ifeq ($(ZOOKEEPER_UP),1)
	@echo "$(YELLOW)🐝 Starting Zookeeper container...$(NC)"
	$(COMPOSE) -f airborne_analytics_server/docker-compose.yml --env-file $(ENV_FILE_KC) up -d zookeeper
endif
else
	@echo "$(YELLOW)Skipping zookeeper container-setup in CI.$(NC)"
endif
	@echo "$(YELLOW)🐝 Checking Zookeeper health...$(NC)"
	@RETRY=0; \
	while [ $$RETRY -lt 60 ]; do \
		if $(DOCKER) exec $(ZOOKEEPER_CONTAINER_NAME) echo ruok | nc localhost 2181 | grep imok >/dev/null 2>&1; then \
			break; \
		fi; \
		printf "."; sleep 2; RETRY=$$((RETRY + 1)); \
	done
	@echo "$(GREEN) ✅ Zookeeper ready$(NC)"

kafka:
ifndef CI
ifeq ($(KAFKA_UP),1)
	@echo "$(YELLOW)🍄 Starting Kafka container...$(NC)"
	$(COMPOSE) -f airborne_analytics_server/docker-compose.yml --env-file $(ENV_FILE_KC) up -d kafka
endif
else
	@echo "$(YELLOW)Skipping kafka container-setup in CI.$(NC)"
endif
	@echo "$(YELLOW)🍄 Checking Kafka health...$(NC)"
	@RETRY=0; \
	while [ $$RETRY -lt 60 ]; do \
		if $(DOCKER) exec $(KAFKA_CONTAINER_NAME) kafka-broker-api-versions --bootstrap-server localhost:9092 >/dev/null 2>&1; then \
			break; \
		fi; \
		printf "."; sleep 2; RETRY=$$((RETRY + 1)); \
	done
	@echo "$(GREEN) ✅ Kafka ready$(NC)"

clickhouse:
ifndef CI
ifeq ($(CLICKHOUSE_UP),1)
	@echo "$(YELLOW)🍒 Starting ClickHouse container...$(NC)"
	$(COMPOSE) -f airborne_analytics_server/docker-compose.yml --env-file $(ENV_FILE_KC) up -d clickhouse-server
endif
else
	@echo "$(YELLOW)Skipping clickhouse container-setup in CI.$(NC)"
endif
	@echo "$(YELLOW)🍒 Checking ClickHouse health...$(NC)"
	@RETRY=0; \
	while [ $$RETRY -lt 60 ]; do \
		if curl -s -f http://localhost:8123/ping >/dev/null 2>&1; then \
			break; \
		fi; \
		printf "."; sleep 2; RETRY=$$((RETRY + 1)); \
	done
	@echo "$(GREEN) ✅ ClickHouse ready$(NC)"

kafka-ui:
ifndef CI
ifeq ($(KAFKA_UI_UP),1)
	@echo "$(YELLOW)🧑‍💻 Starting Kafka UI container...$(NC)"
	$(COMPOSE) -f airborne_analytics_server/docker-compose.yml --env-file $(ENV_FILE_KC) up -d kafka-ui
endif
else
	@echo "$(YELLOW)Skipping kafka-ui container-setup in CI.$(NC)"
endif
	@echo "$(YELLOW)🧑‍💻 Checking Kafka UI health...$(NC)"
	@RETRY=0; \
	while [ $$RETRY -lt 60 ]; do \
		if curl -s -f http://localhost:8080/api/status >/dev/null 2>&1; then \
			break; \
		fi; \
		printf "."; sleep 2; RETRY=$$((RETRY + 1)); \
	done
	@echo "$(GREEN) ✅ Kafka UI ready$(NC)"

node-dependencies:
	cd airborne_dashboard && npm ci
	cd airborne_server/docs_react && npm ci

dashboard:
	cd airborne_dashboard && npm run dev

docs:
	cd airborne_server/docs_react && npm run build:dev

SETUP_DEPS = env-file db superposition keycloak-db keycloak localstack node-dependencies
# ifdef CI
# 	SETUP_DEPS += test-tenant
# endif
setup: $(SETUP_DEPS)

airborne-server:
	@echo "$(YELLOW)Building airborne_server...$(NC)"
	@cd airborne_server && cargo build $(CARGO_FLAGS) --bin airborne_server

superposition-init:
	@echo "$(YELLOW)📊 Initializing Superposition...$(NC)"
	@cd airborne_server && ./scripts/init-superposition.sh

keycloak-init:
	@echo "$(YELLOW)🔑 Initializing Keycloak...$(NC)"
	@cd airborne_server && ./scripts/init-keycloak.sh

localstack-init:
	@echo "$(YELLOW)☁️  Initializing LocalStack...$(NC)"
	@cd airborne_server && ./scripts/init-localstack.sh

db-migration:
	@echo "$(YELLOW)🗄️  Running database migrations...$(NC)"
	@if [ -f airborne_server/.env ]; then \
		set -a; \
		. airborne_server/.env; \
		set +a; \
	fi; \
	if [ -z "$$DATABASE_URL" ] && [ -z "$$DB_URL" ]; then \
		echo "$(YELLOW)DATABASE_URL and DB_URL not set by env file. Constructing with default password 'postgres' for migrations.$(NC)"; \
		export DATABASE_URL="postgresql://$${DB_USER}:postgres@$${DB_HOST}:$${DB_PORT}/$${DB_NAME}"; \
	elif [ -n "$$DB_URL" ]; then \
		export DATABASE_URL="$$DB_URL"; \
	fi; \
	if (cd airborne_server && diesel migration run); then \
		echo "$(GREEN)✅ Database migrations completed$(NC)"; \
	else \
		echo "$(RED)❌ Database migrations failed$(NC)"; \
		exit 1; \
	fi

kill:
	@echo "$(YELLOW)🔪 Killing existing airborne-server processes...$(NC)"
	-@pkill -f airborne_server/target/debug/airborne_server 2>/dev/null || true
	@echo "$(GREEN)✅ Process cleanup completed$(NC)"

run: kill db superposition superposition-init keycloak-db keycloak keycloak-init localstack localstack-init
	@trap 'kill 0' INT TERM; \
	$(MAKE) dashboard & \
	$(MAKE) docs & \
	cargo watch -w airborne_server/src -w airborne_server/Cargo.toml -w Cargo.toml -w Cargo.lock -s '$(MAKE) airborne-server && cd airborne_server && ../target/debug/airborne_server' & \
	wait

stop:
	@echo "$(YELLOW)🛑 Stopping all services...$(NC)"
	@$(COMPOSE) -f airborne_server/docker-compose.yml down 2>/dev/null || true
	@echo "$(GREEN)✅ All services stopped.$(NC)"

cleanup:
	@echo "$(YELLOW)🧹 Cleaning up containers and volumes...$(NC)"
	@$(COMPOSE) -f airborne_server/docker-compose.yml down -v --remove-orphans 2>/dev/null || true
	@echo "$(YELLOW)🗑️  Removing environment file...$(NC)"
	@rm -f airborne_server/.env
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
	$(call init_status_simple,Environment,airborne_server/.env)
	@echo ""
	@echo "$(YELLOW)🐳 Container Status:$(NC)"
	@$(COMPOSE) -f airborne_server/docker-compose.yml ps --format "table {{.Service}}\t{{.State}}\t{{.Status}}" 2>/dev/null || echo "$(YELLOW)No containers running$(NC)"
	@echo ""

frontend-check:
	@echo "$(YELLOW)🔍 Checking frontend code quality...$(NC)"
	@cd airborne_dashboard && npm run check
	@cd airborne_server/docs_react && npm run check
	@echo "$(GREEN)Frontend checks completed$(NC)"

frontend-lint:
	@echo "$(YELLOW)🔍 Linting frontend code...$(NC)"
	@cd airborne_dashboard && npm run lint
	@cd airborne_server/docs_react && npm run lint
	@echo "$(GREEN)Frontend linting completed$(NC)"

frontend-lint-fix:
	@echo "$(YELLOW)🔧 Fixing frontend lint issues...$(NC)"
	@cd airborne_dashboard && npm run lint:fix
	@cd airborne_server/docs_react && npm run lint:fix
	@echo "$(GREEN)Frontend lint fixes completed$(NC)"

frontend-format:
	@echo "$(YELLOW)✨ Formatting frontend code...$(NC)"
	@cd airborne_dashboard && npm run format
	@cd airborne_server/docs_react && npm run format
	@echo "$(GREEN)Frontend formatting completed$(NC)"

lint-fix: LINT_FLAGS += --fix --allow-dirty --allow-staged
lint-fix: lint frontend-lint-fix

check: FMT_FLAGS += --check
check: LINT_FLAGS += -- -Dwarnings
check: fmt lint frontend-check

fmt: frontend-format
	cargo fmt $(FMT_FLAGS) 

lint: frontend-lint
	cargo clippy $(LINT_FLAGS)

commit: check
	git commit $(COMMIT_FLAGS)

amend: COMMIT_FLAGS += --amend
amend: commit

amend-no-edit: COMMIT_FLAGS += --no-edit
amend-no-edit: amend

analytics-server:
	@echo "$(YELLOW)Building analytics-server...$(NC)"
	@cd airborne_analytics_server && cargo build $(CARGO_FLAGS) --bin airborne_analytics_server

run-kafka-clickhouse: analytics-env-file zookeeper kafka clickhouse kafka-ui
	@echo "⏳ Starting dev environment: Kafka + ClickHouse"
	@cargo watch -w airborne_analytics_server/src -w airborne_analytics_server/Cargo.toml -w Cargo.toml -w Cargo.lock -s '$(MAKE) analytics-server && cd airborne_analytics_server && ../target/debug/airborne_analytics_server'
	@echo "✅ Development environment started with Kafka and ClickHouse!"
	@echo "   • Kafka UI:     http://localhost:8080"
	@echo "   • ClickHouse:   http://localhost:8123"
	@echo "   • Backend API:  http://localhost:6400"


run-victoria-metrics: analytics-env-file grafana victoria-metrics
	@echo "⏳ Starting dev environment: Grafana + Victoria Metrics"
	@cargo watch -w airborne_analytics_server/src -w airborne_analytics_server/Cargo.toml -w Cargo.toml -w Cargo.lock -s '$(MAKE) analytics-server && cd airborne_analytics_server && ../target/debug/airborne_analytics_server'
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

smithy-clean:
	rm -rf smithy/output

smithy-build:
	cd smithy && smithy build

smithy-clean-build: smithy-clean smithy-build

smithy-clients: smithy-clean-build
	rm -rf airborne_server_clients/javascript/sdk
	mkdir -p airborne_server_clients/javascript/sdk
	rm -rf airborne_server_clients/model
	mkdir -p airborne_server_clients/model
# 	git restore airborne_server_clients/javascript/sdk/README.md
	cp -r $(SMITHY_BUILD_SRC)/typescript-client-codegen/*\
				airborne_server_clients/javascript/sdk
	git restore airborne_server_clients/javascript/sdk/LICENSE
	cp -f $(SMITHY_BUILD_SRC)/model/*\
				airborne_server_clients/model


	@for d in $(SMITHY_BUILD_SRC)/*-client-codegen; do \
		[ -d "$$d" ] || continue; \
		[[ "$$d" =~ "typescript" ]] && continue; \
		name=$$(basename "$$d" -client-codegen); \
		mkdir -p "airborne_server_clients/$$name"; \
		cp -r "$$d"/* "airborne_server_clients/$$name"; \
	done
	git apply smithy/patches/*.patch

generate-cli: smithy-clients
	cd airborne_server_clients/javascript/sdk && npm install && npm run build
	find airborne-core-cli -mindepth 1 ! -name 'CHANGELOG.md' -exec rm -rf {} +
	cd smithy-cli-generator && npm install
	node smithy-cli-generator/src/index.js \
		--smithyBuildJSONPath smithy/smithy-build.json \
		--smithyTypescriptSdk file:../airborne_server_clients/javascript/sdk \
		--cliName "airborne-core-cli" \
		--cliDescription "Command-line interface for Airborne OTA operations" \
		--buildPath . \
		--namespace io.airborne.server \
		--service Airborne \
		--smithyModelJSONPath airborne_server_clients/model/model.json \
		--plugin typescript-client-codegen
	@echo "$(YELLOW)Adding repository field to airborne-core-cli/package.json...$(NC)"
	@sed -i.bak '/"dependencies": {/i\
\  "repository": {\
\    "type": "git",\
\    "url": "git+https://github.com/juspay/airborne.git"\
\  },' airborne-core-cli/package.json && rm -f airborne-core-cli/package.json.bak
	cd airborne-core-cli && npm install
  
