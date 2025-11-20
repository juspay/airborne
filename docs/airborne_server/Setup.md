# Airborne Server Setup Guide

This guide covers setting up the Airborne Server locally for development using the Makefile and Docker/Podman.

## Table of Contents

- [Prerequisites](#prerequisites)
- [Quick Start](#quick-start)
- [Setup Options](#setup-options)
- [Services Overview](#services-overview)
- [Development Workflow](#development-workflow)
- [Troubleshooting](#troubleshooting)

## Prerequisites

### Option 1: Using Nix (Recommended)

**Nix with Flakes** provides all dependencies automatically:

```bash
# From the project root
nix develop
```

This provides:
- Rust toolchain (cargo, rustc)
- cargo-watch (hot-reloading)
- diesel-cli (database migrations)
- Node.js 22+
- Make (GNU Make)
- Docker/Podman Compose
- PostgreSQL client tools (psql, pg_isready)
- jq (JSON processor)
- yq (YAML processor)
- curl
- AWS CLI
- All required system libraries

### Option 2: Manual Installation

**System Dependencies:**
- Docker or Podman (with Docker Compose support)
- Git
- Make (GNU Make)
- Node.js 22+
- PostgreSQL Client Tools (psql, pg_isready)
- curl
- jq (JSON processor)
- yq (YAML processor)

**Rust Development Dependencies:**
- Rust toolchain: Install from [rustup.rs](https://rustup.rs/)
- cargo-watch: `cargo install cargo-watch`
- diesel-cli: `cargo install diesel_cli --no-default-features --features postgres`
- pkg-config

**Platform-Specific Dependencies:**

**macOS:**
- Xcode Command Line Tools (provides libiconv)
- OpenSSL: `brew install openssl`

**Linux (Ubuntu/Debian):**
```bash
sudo apt-get update
sudo apt-get install -y libssl-dev libpq-dev pkg-config build-essential
```

**Linux (Fedora/RHEL):**
```bash
sudo dnf install -y openssl-devel postgresql-devel pkg-config gcc
```

## Quick Start

### 1. Clone the Repository

```bash
git clone <repository-url>
cd airborne
```

### 2. Start the Server

**Development Mode (with hot-reloading):**

```bash
make run
```

This single command:
- Creates the `.env` file from `.env.example` if it doesn't exist
- Starts all required services (PostgreSQL, Keycloak, LocalStack, Superposition)
- Initializes all services with required configurations
- Runs database migrations
- Starts the Airborne server with hot-reloading
- Starts the dashboard and docs development servers

### 3. Access the Services

Once running, you can access:

- **Airborne Backend API**: http://localhost:8081
- **Keycloak (Authentication)**: http://localhost:8180
  - Admin Console: http://localhost:8180/admin
  - Default credentials: `admin/admin`
- **Superposition**: http://localhost:8080
- **PostgreSQL Database**: `localhost:5433`
- **LocalStack (AWS Mock)**: http://localhost:4566
- **Dashboard**: Development server (URL shown in terminal)

## Setup Options

### Full Setup with All Dependencies

```bash
make setup
```

This prepares all dependencies without starting the server:
- Creates environment file
- Starts database services
- Starts Keycloak with its database
- Starts LocalStack
- Starts Superposition
- Installs Node.js dependencies

### Individual Service Setup

Start services individually as needed:

```bash
# Database
make db                    # Start PostgreSQL
make db-migration          # Run database migrations

# Authentication
make keycloak-db          # Start Keycloak's database
make keycloak             # Start Keycloak
make keycloak-init        # Initialize Keycloak realm and client

# Infrastructure
make localstack           # Start LocalStack (AWS S3 mock)
make localstack-init      # Create S3 buckets
make superposition        # Start Superposition
make superposition-init   # Initialize Superposition organization

# Frontend
make node-dependencies    # Install Node.js dependencies
make dashboard            # Start dashboard development server
make docs                 # Build docs application
```

### Build the Server

Build the Airborne server without running it:

```bash
make airborne-server
```

The compiled binary will be at: `target/debug/airborne_server`

## Services Overview

### PostgreSQL Database

- **Port**: 5433
- **Database**: `airborneserver`
- **Default User**: `postgres`
- **Purpose**: Stores application data including packages, configs, releases

**Manual Access:**
```bash
psql -h localhost -p 5433 -U postgres -d airborneserver
```

### Keycloak (Authentication & Authorization)

- **Port**: 8180
- **Realm**: Configured in `.env`
- **Admin Credentials**: `admin/admin`
- **Purpose**: User authentication, JWT token generation, role-based access control

**Features:**
- User management
- Organization/application group hierarchy
- Role-based permissions (owner, admin, write, read)
- JWT token issuance and validation

### LocalStack (AWS Services Mock)

- **Port**: 4566
- **Services**: S3 (for package storage)
- **Purpose**: Local development without AWS costs

**Configured Services:**
- S3 bucket for storing OTA package assets
- Compatible with AWS SDK

### Superposition (Configuration Management)

- **Port**: 8080
- **Purpose**: Dynamic configuration management
- **Features**: Workspace-based configuration, dimension-based overrides

## Development Workflow

### Daily Development

```bash
# Start everything
make run

# Make code changes...
# The server automatically reloads on changes

# Format and lint before committing
make check

# Commit changes
make commit
```

### Database Migrations

**Create a new migration:**
```bash
cd airborne_server
diesel migration generate <migration_name>
```

**Apply migrations:**
```bash
make db-migration
```

Migrations are also automatically applied when the server starts.

### Code Quality

```bash
make fmt              # Format Rust code
make lint             # Run Clippy linter
make lint-fix         # Auto-fix linting issues
make check            # Format check + lint (CI mode)
```

### Frontend Development

```bash
make node-dependencies    # Install dependencies
make dashboard            # Start dashboard dev server
make docs                 # Build docs application
```

### Service Management

**Check Status:**
```bash
make status
```

**Stop Services:**
```bash
make stop
```

**Clean Up (Remove containers and volumes):**
```bash
make cleanup
```

**Kill Server Process:**
```bash
make kill
```

### Environment Configuration

The server uses environment variables defined in `airborne_server/.env`:

**Key Variables:**
- `KEYCLOAK_URL`: Keycloak instance URL
- `KEYCLOAK_CLIENT_ID`: Client ID for server authentication
- `KEYCLOAK_SECRET`: Client secret
- `SUPERPOSITION_URL`: Superposition service URL
- `AWS_BUCKET`: S3 bucket name for package storage
- `DB_URL`: PostgreSQL connection string

The `.env` file is automatically created from `.env.example` when you run `make run` or `make setup`.

## Troubleshooting

### Common Issues

**1. Port Already in Use**

```bash
# Check what's using the port
lsof -i :8081  # or other port numbers

# Kill the process
kill -9 <PID>

# Or use the make command
make kill
```

**2. Database Connection Failed**

```bash
# Check if database is running
make status

# Restart database
make stop
make db
```

**3. Services Not Starting**

```bash
# Clean up and start fresh
make cleanup
make run
```

**4. Docker/Podman Issues**

```bash
# Check Docker daemon is running
docker ps

# Or for Podman
podman ps

# Restart Docker/Podman service
```

**5. Database Migration Errors**

```bash
# Reset database
make cleanup
make db
make db-migration
```

**6. Build Errors**

```bash
# Clean build artifacts
cargo clean

# Update dependencies
cargo update

# Try building again
make airborne-server
```

### Viewing Logs

**Server Logs:**
The server outputs logs directly to the terminal where `make run` is executed.

**Container Logs:**
```bash
# View logs for specific service
docker logs airborne_db
docker logs airborne_keycloak
docker logs airborne_localstack
docker logs airborne_superposition

# Follow logs in real-time
docker logs -f airborne_db
```

### Getting Help

```bash
# See all available commands
make help

# Check system status
make status
```

### Performance Tips

**1. Use Nix Development Shell**
The Nix flake provides all dependencies pre-configured, avoiding version conflicts.

**2. Hot Reloading**
`cargo-watch` automatically rebuilds on file changes. Keep the `make run` terminal open during development.

**3. Parallel Development**
Use multiple terminals:
- Terminal 1: `make run` (server with hot-reload)
- Terminal 2: Manual testing/curl commands
- Terminal 3: Database queries/logs

**4. Clean Builds**
If experiencing strange build issues:
```bash
cargo clean
make airborne-server
```

## Next Steps

- [API Documentation](../API_DOCUMENTATION.md) - Learn about available endpoints
- [Database Schema](./Database.md) - Understand the database structure
- [Authentication Guide](./Authentication.md) - Configure Keycloak and user management
- [SDK Integration Guides](../airborne_sdk/) - Integrate SDKs with your applications
