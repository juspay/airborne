# Build stage
FROM rust:1.82 as builder

WORKDIR /app

# install C libs and pkg-config for build scripts
RUN apt-get update && \
    apt-get install -y --no-install-recommends \
      pkg-config \
      libsasl2-dev && \
    rm -rf /var/lib/apt/lists/*

# Copy manifests
COPY Cargo.toml init-clickhouse.sql ./

# Create a dummy main.rs to cache dependencies
RUN mkdir src && echo "fn main() {}" > src/main.rs

# Build dependencies
RUN cargo build --release && rm -rf src

# Copy source code
COPY src ./src

# Build the actual application
RUN touch src/main.rs && cargo build --release

# Runtime stage
FROM debian:bookworm-slim

# Install required system dependencies
RUN apt-get update && apt-get install -y \
    ca-certificates \
    libssl3 \
    libsasl2-2 \
    curl \
    && rm -rf /var/lib/apt/lists/*

# Create app user
RUN useradd -r -s /bin/false analytics

WORKDIR /app

# Copy the binary from builder stage
COPY --from=builder /app/target/release/analytics-server .
COPY --from=builder /app/init-clickhouse.sql .

# Change ownership to app user
RUN chown analytics:analytics analytics-server

# Switch to app user
USER analytics

# Expose port
EXPOSE 6400

# Health check
# HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
#     CMD curl -f http://localhost:6400/health || exit 1

# Run the application
CMD ["./analytics-server"]
