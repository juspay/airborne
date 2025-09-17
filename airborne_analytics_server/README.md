# OTA Analytics Server

A high-performance, enterprise-ready Rust-based OTA analytics platform that leverages **Kafka** for event streaming and **ClickHouse** for analytical storage. Built specifically for Over-The-Air (OTA) update analytics across multi-tenant mobile applications.

## 🏗️ Architecture Overview

```
[ React Native OTA Client ]
        ↓ (HTTP POST)
[ Ingestion Service / API ]
        ↓ (Publish to Kafka topic "ota-events")
[ Kafka Cluster ]
        ↓ (Consumer group "clickhouse-writers")
[ Stream Consumer / ETL Service ]
        ↓ (Batch inserts)
[ ClickHouse Cluster ]
        ↓ (Materialized views & aggregations)
[ Analytics API & Dashboard Layer ]
```

### Key Components

1. **Event Ingestion API**: RESTful endpoints for receiving OTA events from mobile clients
2. **Kafka Producer**: Streams events to Kafka topics for decoupled processing
3. **Kafka Consumer**: Processes events in batches and stores in ClickHouse
4. **ClickHouse Storage**: Columnar OLAP database with materialized views for fast analytics
5. **Analytics API**: Query endpoints for adoption metrics, failure analysis, and performance insights
6. **Multi-Tenant Support**: Complete isolation with tenant/org/app hierarchy

## 🚀 Features

- **📊 Multi-tenant Analytics**: Complete data isolation per tenant/organization/application
- **⚡ Real-time Event Streaming**: Kafka-based event pipeline with automatic batching
- **🔍 High-performance Queries**: ClickHouse-powered sub-second analytics responses
- **📈 Comprehensive OTA Metrics**:
  - Adoption rates and installation trends
  - Version distribution across devices
  - Active device tracking
  - Failure analysis and error tracking
  - Performance metrics (download speeds, install times)
- **🛡️ Production Ready**: Structured logging, error handling, graceful shutdown
- **🔄 Auto-Schema Management**: Automatic ClickHouse table and view creation
- **📱 Mobile-Optimized**: Purpose-built for React Native OTA update analytics

## 📱 OTA Event Types

The system tracks the complete OTA update lifecycle:

| Event Type           | Description                         | Typical Payload                                |
| -------------------- | ----------------------------------- | ---------------------------------------------- |
| `update_started`     | Update process initiated            | `current_version`, `target_version`            |
| `update_downloading` | Downloading update package          | `progress`, `download_speed`                   |
| `update_downloaded`  | Download completed                  | `package_size`, `download_duration`            |
| `update_installing`  | Installation in progress            | `install_progress`                             |
| `update_installed`   | Installation completed successfully | `install_duration`, `success_metrics`          |
| `update_failed`      | Update process failed               | `error_code`, `error_message`, `failure_stage` |
| `update_cancelled`   | Update cancelled by user            | `cancellation_reason`                          |
| `rollback_started`   | Rollback initiated                  | `rollback_reason`                              |
| `rollback_completed` | Rollback completed                  | `rollback_duration`                            |

## 🛠️ Quick Start

### Prerequisites

**Option 1: Using Nix (Recommended)**

- **Nix with Flakes**: All dependencies automatically provided with `nix develop` from project root
  - This provides: Rust toolchain, cargo-watch, Docker Compose, and all required system libraries including Cyrus SASL for Kafka support

**Option 2: Manual Installation**

- **System Dependencies:**
  - Docker & Docker Compose (for local development infrastructure)
  - Rust 1.89.0 with cargo
  - cargo-watch (for development hot-reloading)
- **Analytics-Specific Dependencies:**
  - OpenSSL development libraries
  - Cyrus SASL libraries (for Kafka support)
  - pkg-config
  - cmake
- **Platform-Specific:**
  - **macOS**: libiconv, OpenSSL via Homebrew
  - **Linux**: libssl-dev, libsasl2-dev, pkg-config, cmake packages

### 🐳 Local Development Setup

1. **Start infrastructure services:**

   ```bash
   # From the project root directory
   make run-analytics
   ```

   This starts the analytics server with Grafana + Victoria Metrics stack, providing:

   - Grafana (http://localhost:4000)
   - Victoria Metrics (http://localhost:8428)
   - Backend API (http://localhost:6400)

   **Alternative Kafka + ClickHouse stack:**

   ```bash
   # From the project root directory
   make run-kafka-clickhouse
   ```

   This provides:

   - Kafka UI (http://localhost:8080)
   - ClickHouse (http://localhost:8123)
   - Backend API (http://localhost:6400)

2. **Configure environment:**

   **Note for Nix users:** All Rust dependencies (including cyrus-sasl for Kafka support) are available through the project's root-level Nix flake. Run `nix develop` from the project root to get all required dependencies.

3. **Build and run manually (if needed):**

   ```bash
   # From project root
   make analytics-server
   ```

4. **Verify health:**
   ```bash
   curl http://localhost:6400/health
   ```

### 🧪 Testing the API

You can test the analytics server in several ways:

**Option 1: Using curl commands**

```bash
# Send a sample OTA event
curl -X POST http://localhost:6400/events \
  -H "Content-Type: application/json" \
  -d '{
    "tenant_id": "test-tenant",
    "org_id": "test-org",
    "app_id": "test-app",
    "event_type": "update_started",
    "timestamp": "2024-01-01T00:00:00Z",
    "device_id": "device123",
    "current_version": "1.0.0",
    "target_version": "1.1.0"
  }'

# Query analytics data
curl "http://localhost:6400/analytics/adoption?tenant_id=test-tenant&days=30&app_id=test-app"
```

**Option 2: Using Postman**

Import the provided Postman collection for comprehensive API testing:

```bash
# The collection is located at: analytics/OTA Analytics.postman_collection.json
# Import this file into Postman to get pre-configured requests for all endpoints
```

## 🔌 API Endpoints

### Event Ingestion

#### `POST /events` - Ingest OTA Event

Submit OTA events from mobile clients:

```bash
curl -X POST http://localhost:8081/events \
  -H "Content-Type: application/json" \
  -d '{
    "tenant_id": "acme-corp",
    "org_id": "mobile-team",
    "app_id": "my-mobile-app",
    "device_id": "device-123",
    "session_id": "session-456",
    "event_type": "update_started",
    "timestamp": "2025-06-03T10:30:00Z",
    "device_info": {
      "os": "Android",
      "os_version": "13",
      "model": "Pixel 7",
      "manufacturer": "Google"
    },
    "release_info": {
      "current_version": "1.0.0",
      "target_version": "1.1.0",
      "release_notes": "Bug fixes and improvements"
    },
    "performance_metrics": {
      "download_speed_mbps": 25.5,
      "install_duration_seconds": 120,
      "battery_level": 75,
      "storage_available_mb": 2048
    }
  }'
```

### Analytics Endpoints

#### `GET /analytics/adoption` - Adoption Metrics

Track OTA adoption rates over time:

```bash
curl "http://localhost:8081/analytics/adoption?tenant_id=acme-corp&days=30&app_id=my-app"
```

**Response:**

```json
{
  "data": {
    "total_updates": 15420,
    "successful_updates": 14891,
    "failed_updates": 529,
    "success_rate": 96.57,
    "hourly_installs": [
      { "hour": "2025-06-03T10:00:00Z", "installs": 142, "failures": 8 },
      { "hour": "2025-06-03T11:00:00Z", "installs": 156, "failures": 12 }
    ]
  }
}
```

#### `GET /analytics/versions` - Version Distribution

Current version spread across active devices:

```bash
curl "http://localhost:8081/analytics/versions?tenant_id=acme-corp&app_id=my-app"
```

**Response:**

```json
{
  "data": {
    "versions": [
      { "version": "1.1.0", "device_count": 8524, "percentage": 67.2 },
      { "version": "1.0.0", "device_count": 3891, "percentage": 30.7 },
      { "version": "0.9.8", "device_count": 265, "percentage": 2.1 }
    ],
    "total_devices": 12680
  }
}
```

#### `GET /analytics/active-devices` - Active Devices

Device activity and engagement metrics:

```bash
curl "http://localhost:8081/analytics/active-devices?tenant_id=acme-corp&days=7"
```

#### `GET /analytics/failures` - Failure Analysis

Detailed failure tracking and error analysis:

```bash
curl "http://localhost:8081/analytics/failures?tenant_id=acme-corp&days=30"
```

#### `GET /analytics/performance` - Performance Metrics

Download speeds, install times, and performance trends:

```bash
curl "http://localhost:8081/analytics/performance?tenant_id=acme-corp&days=30"
```

### System Health

#### `GET /health` - Health Check

```bash
curl http://localhost:8081/health
```

**Response:**

```json
{
  "status": "healthy",
  "timestamp": "2025-06-03T10:00:00Z",
  "services": {
    "clickhouse": {
      "status": "healthy",
      "response_time_ms": 12
    },
    "kafka": {
      "status": "healthy",
      "producer_ready": true,
      "consumer_lag": 0
    }
  },
  "metrics": {
    "events_processed": 156789,
    "events_per_second": 45.2
  }
}
```

## ⚙️ Configuration

Configuration is handled through environment variables with sensible defaults:

### Server Configuration

| Variable      | Description      | Default |
| ------------- | ---------------- | ------- |
| `SERVER_PORT` | HTTP server port | `8080`  |

### Kafka Configuration

| Variable               | Description              | Default                  |
| ---------------------- | ------------------------ | ------------------------ |
| `KAFKA_BROKERS`        | Kafka broker addresses   | `localhost:9092`         |
| `KAFKA_TOPIC`          | Primary OTA events topic | `ota-events`             |
| `KAFKA_CONSUMER_GROUP` | Consumer group ID        | `ota-analytics-consumer` |

### ClickHouse Configuration

| Variable              | Description              | Default                 |
| --------------------- | ------------------------ | ----------------------- |
| `CLICKHOUSE_URL`      | ClickHouse HTTP endpoint | `http://localhost:8123` |
| `CLICKHOUSE_DATABASE` | Database name            | `analytics`             |
| `CLICKHOUSE_USERNAME` | Database username        | (none)                  |
| `CLICKHOUSE_PASSWORD` | Database password        | (none)                  |

### Security Configuration (Production)

For production deployments with authenticated Kafka:

```bash
export KAFKA_SECURITY_PROTOCOL="SASL_SSL"
export KAFKA_SASL_MECHANISMS="PLAIN"
export KAFKA_SASL_USERNAME="your_username"
export KAFKA_SASL_PASSWORD="your_password"
```

## 🗄️ Database Schema

The server automatically creates and manages the ClickHouse schema optimized for OTA analytics.

### Primary Events Table

```sql
CREATE TABLE ota_events_raw (
    event_id UUID DEFAULT generateUUIDv4(),
    tenant_id String,
    org_id String,
    app_id String,
    device_id String,
    session_id Nullable(String),
    event_type String,
    timestamp DateTime64(3),
    event_date Date MATERIALIZED toDate(timestamp),

    -- Device context
    device_os Nullable(String),
    device_os_version Nullable(String),
    device_model Nullable(String),
    device_manufacturer Nullable(String),

    -- Release information
    current_version Nullable(String),
    target_version Nullable(String),
    release_notes Nullable(String),

    -- Network context
    connection_type Nullable(String),
    bandwidth_mbps Nullable(Float64),

    -- Performance metrics
    download_speed_mbps Nullable(Float64),
    install_duration_seconds Nullable(UInt32),
    battery_level Nullable(UInt8),
    storage_available_mb Nullable(UInt32),

    -- Error tracking
    error_code Nullable(String),
    error_message Nullable(String),

    ingested_at DateTime64(3) DEFAULT now64(3)
)
ENGINE = MergeTree
PARTITION BY toYYYYMM(event_date)
ORDER BY (tenant_id, org_id, app_id, timestamp, event_type)
TTL event_date + INTERVAL 365 DAY
SETTINGS index_granularity = 8192;
```

### Materialized Views for Fast Analytics

The system automatically creates optimized materialized views:

#### 1. Hourly Installs

```sql
CREATE TABLE hourly_installs (
    tenant_id String,
    org_id String,
    app_id String,
    target_version String,
    hour_slot DateTime,
    installs AggregateFunction(uniqExact, String)
)
ENGINE = AggregatingMergeTree()
PARTITION BY toYYYYMM(hour_slot)
ORDER BY (tenant_id, org_id, app_id, target_version, hour_slot);
```

#### 2. Daily Active Devices

```sql
CREATE TABLE daily_active_devices (
    tenant_id String,
    org_id String,
    app_id String,
    stat_date Date,
    active_devices AggregateFunction(uniqExact, String)
)
ENGINE = AggregatingMergeTree()
PARTITION BY toYYYYMM(stat_date)
ORDER BY (tenant_id, org_id, app_id, stat_date);
```

#### 3. Version Distribution

Pre-aggregated version adoption metrics for instant dashboard queries.

#### 4. Failure Analysis

Categorized failure tracking with error codes and failure stages.

## 🚀 Performance & Scalability

### Performance Characteristics

- **Event Ingestion**: >10,000 events/second on modest hardware
- **Query Performance**: Sub-second response times for most analytics queries
- **Storage Efficiency**: 10:1+ compression ratios with ClickHouse columnar storage
- **Memory Usage**: Minimal RAM footprint with efficient Rust implementation

### Scaling Strategies

#### Horizontal Scaling

- **Kafka Partitioning**: Partition by `hash(tenant_id, org_id, app_id)` for load distribution
- **Multiple Consumers**: Run multiple consumer instances for parallel processing
- **ClickHouse Sharding**: Distribute across multiple ClickHouse nodes

#### Optimization Techniques

- **Batch Processing**: Configurable batch sizes (default: 1000 events)
- **Connection Pooling**: Efficient database connection management
- **Materialized Views**: Pre-computed aggregations for instant dashboard queries
- **TTL Policies**: Automatic data lifecycle management

## 🔧 Development

### Project Structure

```
src/
├── main.rs              # Application entry point & server setup
├── config.rs            # Environment-based configuration
├── models.rs            # OTA event models & types
├── error.rs             # Centralized error handling
├── kafka.rs             # Kafka producer/consumer implementation
├── clickhouse.rs        # ClickHouse client & queries
└── handlers/
    ├── events.rs        # Event ingestion endpoints
    ├── analytics.rs     # Analytics query endpoints
    └── health.rs        # Health check & monitoring
```

### Development Workflow

The analytics server is now integrated with the main project's consolidated Makefile system located at the project root. All commands should be run from the root directory:

```bash
# Navigate to project root (if not already there)
cd ..

# Show all available commands
make help

# Start analytics development environment
make run-analytics              # Grafana + Victoria Metrics
make run-kafka-clickhouse      # Kafka + ClickHouse alternative

# Build analytics server
make analytics-server

# Code quality
make fmt                       # Format code
make lint                      # Run linting
make check                     # Format check and linting (CI mode)
make lint-fix                  # Run linting with automatic fixes

# Infrastructure management
make status                    # Show system status
make stop                      # Stop all services
make cleanup                   # Clean up containers and volumes

# Run with specific log level
RUST_LOG=debug make run-analytics
```

**Key Make Targets for Analytics:**

- `run-analytics`: Starts Grafana + Victoria Metrics stack with analytics server
- `run-kafka-clickhouse`: Alternative stack with Kafka + ClickHouse
- `analytics-server`: Builds the analytics server binary only

**Individual Analytics Service Targets:**

- `grafana`: Start Grafana dashboard service
- `victoria-metrics`: Start Victoria Metrics time series database
- `zookeeper`: Start Zookeeper coordination service
- `kafka`: Start Kafka message broker
- `clickhouse`: Start ClickHouse analytics database
- `kafka-ui`: Start Kafka UI management interface
- `analytics-env-file`: Create analytics environment file from template

### Adding New Analytics

1. **Define Query Parameters**: Add to `AnalyticsQuery` in `models.rs`
2. **Implement ClickHouse Query**: Add method in `clickhouse.rs`
3. **Create HTTP Handler**: Add endpoint in `handlers/analytics.rs`
4. **Register Route**: Update route registration in `main.rs`
5. **Test**: Add integration test and update documentation

## 🐳 Docker Deployment

### Building Production Image

```bash
# Build optimized image
docker build -t ota-analytics:latest .

# Multi-stage build with minimal runtime
docker build --target production -t ota-analytics:prod .
```

### Docker Compose for Production

```yaml
version: "3.8"
services:
  analytics:
    image: ota-analytics:latest
    ports:
      - "8080:8080"
    environment:
      - KAFKA_BROKERS=kafka-cluster:9092
      - CLICKHOUSE_URL=http://clickhouse-cluster:8123
      - KAFKA_SECURITY_PROTOCOL=SASL_SSL
      - KAFKA_SASL_USERNAME=${KAFKA_USERNAME}
      - KAFKA_SASL_PASSWORD=${KAFKA_PASSWORD}
    restart: unless-stopped

  clickhouse:
    image: clickhouse/clickhouse-server:23-alpine
    volumes:
      - clickhouse_data:/var/lib/clickhouse
    environment:
      - CLICKHOUSE_DB=analytics

volumes:
  clickhouse_data:
```

### Kubernetes Deployment

```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: ota-analytics
spec:
  replicas: 3
  selector:
    matchLabels:
      app: ota-analytics
  template:
    metadata:
      labels:
        app: ota-analytics
    spec:
      containers:
        - name: analytics
          image: ota-analytics:latest
          ports:
            - containerPort: 8080
          env:
            - name: KAFKA_BROKERS
              value: "kafka-service:9092"
            - name: CLICKHOUSE_URL
              value: "http://clickhouse-service:8123"
          resources:
            requests:
              memory: "256Mi"
              cpu: "250m"
            limits:
              memory: "512Mi"
              cpu: "500m"
```

## 📊 Monitoring & Observability

### Built-in Monitoring

The system provides comprehensive observability:

- **Structured Logging**: JSON-formatted logs with trace IDs
- **Health Endpoints**: Deep health checks for all dependencies
- **Performance Metrics**: Built-in request timing and throughput tracking
- **Error Tracking**: Detailed error context with stack traces

### Key Metrics to Monitor

#### Application Metrics

- Event ingestion rate (events/second)
- Query response times (p50, p95, p99)
- Error rates by endpoint
- Active consumer lag

#### Infrastructure Metrics

- Kafka broker health and partition lag
- ClickHouse query performance and storage usage
- Memory and CPU utilization
- Network I/O and connection pools

### Accessing Kafka UI

For local development, Kafka UI is available at:
**http://localhost:8080**

Features:

- Topic and partition management
- Message browsing and publishing
- Consumer group monitoring
- Cluster health overview

### ClickHouse Monitoring

#### Direct Database Access

```bash
# Using clickhouse-client
clickhouse-client --host localhost --port 9000

# Query via HTTP API
curl "http://localhost:8123/" -d "
  SELECT
    count() as events,
    uniqExact(device_id) as devices,
    countIf(event_type = 'update_installed') as installs
  FROM ota_events_raw
  WHERE event_date = today()
"
```

#### Performance Queries

```sql
-- Check table sizes
SELECT
  database,
  table,
  formatReadableSize(sum(bytes)) as size,
  sum(rows) as rows
FROM system.parts
WHERE database = 'analytics'
GROUP BY database, table;

-- Monitor query performance
SELECT
  query_duration_ms,
  query,
  user,
  initial_query_start_time
FROM system.query_log
WHERE event_date = today()
  AND query_duration_ms > 1000
ORDER BY query_duration_ms DESC
LIMIT 10;
```

## 🔒 Security & Production Considerations

### Authentication & Authorization

- **Kafka SASL/SSL**: Secure broker communication
- **ClickHouse Users**: Role-based database access
- **API Security**: Rate limiting and request validation
- **Multi-tenant Isolation**: Complete data separation

### Data Privacy & Compliance

- **Tenant Data Isolation**: Strict query-level filtering
- **Data Retention**: Configurable TTL policies
- **Audit Logging**: Complete request tracing
- **GDPR Compliance**: Device ID anonymization options

### High Availability Setup

- **Kafka Replication**: Minimum 3 replicas per partition
- **ClickHouse Clustering**: Distributed tables with replicas
- **Load Balancing**: Multiple analytics service instances
- **Failover**: Automatic consumer group rebalancing

### Performance Tuning

```bash
# Kafka producer optimization
KAFKA_BATCH_SIZE=65536
KAFKA_LINGER_MS=10
KAFKA_COMPRESSION_TYPE=snappy

# ClickHouse optimization
CLICKHOUSE_MAX_MEMORY_USAGE=8000000000
CLICKHOUSE_MAX_THREADS=8
CLICKHOUSE_MAX_EXECUTION_TIME=300
```

## 📚 Use Cases & Examples

### 1. Release Adoption Tracking

Monitor how quickly users adopt new OTA releases:

```bash
# Track adoption for specific release
curl "http://localhost:8081/analytics/adoption?tenant_id=acme&target_version=2.1.0&days=7"
```

### 2. Failure Analysis

Identify and troubleshoot update failures:

```bash
# Get failure breakdown by error code
curl "http://localhost:8081/analytics/failures?tenant_id=acme&days=30&group_by=error_code"
```

### 3. Performance Monitoring

Track download and installation performance:

```bash
# Monitor performance trends
curl "http://localhost:8081/analytics/performance?tenant_id=acme&days=30"
```

### 4. Device Segmentation

Analyze update behavior by device characteristics:

```bash
# Version distribution by device OS
curl "http://localhost:8081/analytics/versions?tenant_id=acme&segment=device_os"
```

## 🤝 Contributing

We welcome contributions! Here's how to get started:

### Development Setup

1. Fork the repository
2. Clone your fork: `git clone https://github.com/yourusername/airborne.git`
3. Create a feature branch: `git checkout -b feature/my-feature`
4. Set up development environment: `make run-analytics` (from project root)
5. Run tests: `make test` (from project root)

### Contribution Guidelines

- **Code Style**: Run `make fmt` and `make lint` from project root
- **Testing**: Add tests for new functionality
- **Documentation**: Update README and code comments
- **Commits**: Use conventional commit format

### Areas for Contribution

- Additional analytics endpoints
- Performance optimizations
- Monitoring and alerting improvements
- Documentation and examples
- Multi-region deployment guides

## 📜 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

---

## 🚀 Ready to Get Started?

1. **Clone the repository**
2. **Run `make run-analytics`** from project root to start infrastructure and server
3. **Test the API** with sample curl commands or import the Postman collection (`airborne_analytics_server/OTA Analytics.postman_collection.json`)
4. **Explore the API** with your OTA events

For questions or support, please open an issue on GitHub or refer to the [documentation](docs/).

---

_Built with ❤️ for the mobile development community_
