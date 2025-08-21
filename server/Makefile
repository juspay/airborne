# Airborne Server Makefile

# Configuration variables
MODE ?= dev
BUILD ?= nobuild
DETACH ?= nodetach
SUPERPOSITION_HOST_URL := http://localhost:8080/health
MAX_WAIT_RETRIES := 90
WAIT_SLEEP := 10
LOCALSTACK_INIT_WAIT := 20
SHELL := /usr/bin/env bash

# Docker detection (similar to reference)
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

# Docker compose flags
DETACH_FLAG := $(if $(filter detach,$(DETACH)),-d,)
BUILD_FLAG := $(if $(filter build,$(BUILD)),--build,)

# ANSI color codes for better output
GREEN := $(shell printf '\033[0;32m')
YELLOW := $(shell printf '\033[1;33m')
RED := $(shell printf '\033[0;31m')
NC := $(shell printf '\033[0m') # No Color

.PHONY: help dev prod build clean cleanup cleanup-superposition superposition keycloak localstack init-services start-backend validate-mode show-env env-file setup run kill status logs logs-follow logs-superposition restart-keycloak restart-localstack restart-backend restart-superposition watch up down down-volumes test install-cleanup-trap

# Default target
default: help

help: ## Show this help message
	@echo "$(GREEN)Airborne Server Management$(NC)"
	@echo ""
	@echo "$(YELLOW)Usage:$(NC)"
	@echo "  make <target> [MODE=dev|prod] [BUILD=build|nobuild] [DETACH=detach|nodetach]"
	@echo ""
	@echo "$(YELLOW)Targets:$(NC)"
	@awk 'BEGIN {FS = ":.*?## "} /^[a-zA-Z_-]+:.*?## / {printf "  $(GREEN)%-20s$(NC) %s\n", $$1, $$2}' $(MAKEFILE_LIST)
	@echo ""
	@echo "$(YELLOW)Examples:$(NC)"
	@echo "  make dev                    # Start in dev mode (default)"
	@echo "  make prod BUILD=build       # Start in prod mode with build"
	@echo "  make dev DETACH=detach      # Start in dev mode detached"
	@echo "  make clean                  # Clean up all services"

env-file: ## Ensure .env file exists
	@if ! [ -e .env ]; then \
		echo ".env missing, copying .env.example as .env" && \
		cp .env.example .env; \
	fi

clean: cleanup ## Alias for cleanup

kill: cleanup-superposition ## Stop superposition only

# Validation targets
validate-mode: ## Validate that MODE is either dev or prod
	@if [ "$(MODE)" != "dev" ] && [ "$(MODE)" != "prod" ]; then \
		echo "$(RED)ERROR: MODE must be 'dev' or 'prod', got '$(MODE)'$(NC)"; \
		echo "Usage: make <target> MODE=dev|prod [BUILD=build|nobuild] [DETACH=detach|nodetach]"; \
		exit 1; \
	fi

superposition: ## Start superposition docker service
	@echo "$(GREEN)Starting superposition service...$(NC)"
	@$(COMPOSE) up -d $(BUILD_FLAG) superposition
	@echo "Verifying superposition readiness..."
	@CURRENT_RETRY=0; \
	until curl -s -o /dev/null -w "%{http_code}" "$(SUPERPOSITION_HOST_URL)" | grep -E "200|401|403|404" > /dev/null || [ $$CURRENT_RETRY -ge $(MAX_WAIT_RETRIES) ]; do \
		CURRENT_RETRY=$$((CURRENT_RETRY + 1)); \
		printf "Attempt $$CURRENT_RETRY/$(MAX_WAIT_RETRIES): Superposition not yet responsive at $(SUPERPOSITION_HOST_URL). Waiting $(WAIT_SLEEP)s...\n"; \
		sleep $(WAIT_SLEEP); \
	done; \
	if [ $$CURRENT_RETRY -ge $(MAX_WAIT_RETRIES) ]; then \
		echo "$(RED)ERROR: Superposition did not become responsive on $(SUPERPOSITION_HOST_URL) after $(MAX_WAIT_RETRIES) attempts.$(NC)"; \
		echo "Please check superposition service logs: $(COMPOSE) logs superposition"; \
		exit 1; \
	fi
	@echo "$(GREEN)Superposition is responsive on $(SUPERPOSITION_HOST_URL).$(NC)"

keycloak: ## Start keycloak services
	@echo "$(GREEN)Starting keycloak-db and keycloak...$(NC)"
	@$(COMPOSE) up -d $(BUILD_FLAG) keycloak-db keycloak

localstack: ## Start localstack service
	@echo "$(GREEN)Starting localstack...$(NC)"
	@$(COMPOSE) up -d $(BUILD_FLAG) localstack
	@echo "$(YELLOW)Waiting $(LOCALSTACK_INIT_WAIT) seconds for localstack to initialize...$(NC)"
	@sleep $(LOCALSTACK_INIT_WAIT)

init-services: ## Initialize keycloak and localstack
	@echo "$(GREEN)Running keycloak-init...$(NC)"
	@$(COMPOSE) run --rm keycloak-init
	@echo "$(GREEN)Running localstack-init...$(NC)"
	@$(COMPOSE) run --rm localstack-init

cleanup-superposition: ## Stop superposition service
	@echo "$(YELLOW)Stopping superposition service...$(NC)"
	@$(COMPOSE) stop superposition || echo "Superposition service already stopped or not found."

cleanup: ## Execute full cleanup (superposition + docker)
	@echo "$(YELLOW)Executing full cleanup...$(NC)"
	@$(MAKE) cleanup-superposition
	@echo "$(YELLOW)Bringing down Docker Compose services...$(NC)"
	@$(COMPOSE) down -v --remove-orphans
	@echo "$(GREEN)Full cleanup complete.$(NC)"

# Setup dependencies
SETUP_DEPS = env-file superposition keycloak localstack init-services
ifdef CI
	# In CI, we might want different behavior
endif

setup: $(SETUP_DEPS) ## Setup all required services

# Main execution targets
run: validate-mode setup start-backend ## Start all services and run backend

## Start services in development mode
dev: MODE = dev
dev: run

## Start services in production mode
prod: MODE = prod
prod: run

## Build and start services (sets BUILD=build)
build: BUILD = build
build: run

# Backend execution
start-backend: ## Start backend services based on mode
	@echo "$(YELLOW)Contents of .env.encrypted just before backend starts:$(NC)"
	@if [ -f "./scripts/.env.encrypted" ]; then \
		cat ./scripts/.env.encrypted; \
	else \
		echo "./scripts/.env.encrypted not found or path is incorrect."; \
	fi
	@echo "$(GREEN)Starting remaining services (including backend)...$(NC)"
	@if [ "$(MODE)" = "dev" ]; then \
		echo "$(YELLOW)Starting in development mode with docker compose watch...$(NC)"; \
		$(COMPOSE) watch; \
	else \
		echo "$(YELLOW)Starting in production mode...$(NC)"; \
		$(COMPOSE) up $(BUILD_FLAG) $(DETACH_FLAG); \
	fi

# Status and debugging targets
show-env: ## Show current environment configuration
	@echo "$(YELLOW)Current Configuration:$(NC)"
	@echo "  MODE: $(MODE)"
	@echo "  BUILD: $(BUILD)"
	@echo "  DETACH: $(DETACH)"
	@echo "  BUILD_FLAG: $(BUILD_FLAG)"
	@echo "  DETACH_FLAG: $(DETACH_FLAG)"
	@echo "  DOCKER: $(DOCKER)"

status: ## Show status of running services
	@echo "$(YELLOW)Docker Compose Services:$(NC)"
	@$(COMPOSE) ps
	@echo ""
	@echo "$(YELLOW)Superposition Status:$(NC)"
	@curl -s $(SUPERPOSITION_HOST_URL) || echo "Superposition not responding"

logs: ## Show logs for all services
	@$(COMPOSE) logs

logs-follow: ## Follow logs for all services
	@$(COMPOSE) logs -f

logs-superposition: ## Show superposition logs
	@$(COMPOSE) logs superposition

# Individual service management
restart-keycloak: ## Restart keycloak services
	@$(COMPOSE) restart keycloak-db keycloak

restart-localstack: ## Restart localstack
	@$(COMPOSE) restart localstack

restart-backend: ## Restart backend service
	@$(COMPOSE) restart backend

restart-superposition: ## Restart superposition service
	@$(COMPOSE) restart superposition

# Docker compose helpers
watch: ## Start docker compose in watch mode (dev only)
	@$(COMPOSE) watch

up: ## Start all services without cleanup
	@$(COMPOSE) up $(BUILD_FLAG) $(DETACH_FLAG)

down: ## Stop all services
	@$(COMPOSE) down

down-volumes: ## Stop all services and remove volumes
	@$(COMPOSE) down -v --remove-orphans

# Setup targets for new environments

# Testing target
test: setup ## Run tests with all services
	@echo "$(GREEN)Starting test environment...$(NC)"
	@$(MAKE) superposition keycloak localstack init-services
	@echo "$(GREEN)Running tests...$(NC)"
	# Add your test commands here
	@echo "$(GREEN)Tests completed.$(NC)"

# Install cleanup trap helper
install-cleanup-trap: ## Install signal handlers for cleanup (run this in your shell)
	@echo "To enable automatic cleanup on interrupt, run:"
	@echo "trap 'make cleanup' SIGINT SIGTERM EXIT"
