.PHONY: help build run test clean docker-build docker-run dev-up dev-down

help: ## Show this help message
	@echo 'Usage: make [target]'
	@echo ''
	@echo 'Targets:'
	@awk 'BEGIN {FS = ":.*?## "} /^[a-zA-Z_-]+:.*?## / {printf "  %-15s %s\n", $$1, $$2}' $(MAKEFILE_LIST)

build: ## Build the application
	cargo build

build-release: ## Build the application in release mode
	cargo build --release

run: ## Run the application
	cargo run

fmt: ## Format code
	cargo fmt

clean: ## Clean build artifacts
	cargo clean

dev-up: ## Start development environment (Kafka, ClickHouse)
	docker-compose up -d
	@echo "Development environment started!"
	@echo "Kafka UI: http://localhost:8080"
	@echo "ClickHouse: http://localhost:8123"

# ──────────────────────────────────────────────
# Default env‐files (you can override these in your shell or on the make command line)
ENV_FILE_KC    ?= .env.kafka-clickhouse
ENV_FILE_VM    ?= .env.victoria-metrics
# ──────────────────────────────────────────────

run-dev-kafka-clickhouse:
	@echo "⏳ Starting dev environment: Kafka + ClickHouse"
	docker compose --env-file $(ENV_FILE_KC) up -d zookeeper kafka clickhouse-server kafka-ui && cargo watch -x run
	@echo "✅ Development environment started with Kafka and ClickHouse!"
	@echo "   • Kafka UI:     http://localhost:8080"
	@echo "   • ClickHouse:   http://localhost:8123"
	@echo "   • Backend API:  http://localhost:6400"

run-dev-victoria-metrics:
	@echo "⏳ Starting dev environment: Grafana + Victoria Metrics"
	docker compose --env-file $(ENV_FILE_VM) up -d grafana victoria-metrics && cargo watch -x run
	@echo "✅ Development environment started with Grafana & Victoria Metrics!"
	@echo "   • Grafana:          http://localhost:4000"
	@echo "   • Victoria Metrics: http://localhost:8428"
	@echo "   • Backend API:      http://localhost:6400"
