FROM rust:1.89-bookworm as builder
WORKDIR /app
COPY . .
RUN echo "Building with cargo" && ls -la

RUN apt-get update && \
    apt-get install -y --no-install-recommends pkg-config libsasl2-dev cmake && \
    rm -rf /var/lib/apt/lists/*

WORKDIR /app/airborne_analytics_server

RUN cargo build --release
RUN ls -la /app/target/release/

FROM debian:bookworm-slim as prod

RUN apt-get update && apt-get install -y \
    ca-certificates \
    libssl3 \
    libsasl2-2 \
    curl \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app
COPY --from=builder /app/target/release/airborne_analytics_server /app/airborne_analytics_server
COPY --from=builder /app/airborne_analytics_server/init-clickhouse.sql /app/init-clickhouse.sql

EXPOSE 6400
CMD ["/app/airborne_analytics_server"]