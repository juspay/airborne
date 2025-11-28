# Copyright 2025 Juspay Technologies
#
# Licensed under the Apache License, Version 2.0 (the "License");
# you may not use this file except in compliance with the License.
# You may obtain a copy of the License at
#
#    http://www.apache.org/licenses/LICENSE-2.0
#
# Unless required by applicable law or agreed to in writing, software
# distributed under the License is distributed on an "AS IS" BASIS,
# WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
# See the License for the specific language governing permissions and
# limitations under the License.

# Build frontend
FROM node:22 as frontend-builder
WORKDIR /app
COPY airborne_server/docs_react/package*.json ./docs_react/
WORKDIR /app/docs_react
RUN npm ci
COPY airborne_server/docs_react/ ./

# Run the build
RUN npm run build
# Make sure the build succeeded
RUN ls -la dist || echo "dist folder was not created!"

# Production build stage
FROM rust:1.89-bookworm as builder
WORKDIR /app
COPY . .
RUN echo "Building with cargo" && ls -la

WORKDIR /app/airborne_server
RUN cargo install diesel_cli --no-default-features --features postgres

RUN cargo build --release
RUN ls -la /app/target/release/

# Final production image
FROM ubuntu:25.10 AS prod
RUN apt-get update && \
    apt-get install -y --no-install-recommends ca-certificates curl libpq5 && \
    rm -rf /var/lib/apt/lists/*

WORKDIR /app
COPY --from=builder /app/target/release/airborne_server /app/airborne_server
COPY --from=builder /usr/local/cargo/bin/diesel /usr/local/bin/diesel
COPY --from=frontend-builder /app/docs_react/dist /app/docs_react/dist
CMD ["/app/airborne_server"]
