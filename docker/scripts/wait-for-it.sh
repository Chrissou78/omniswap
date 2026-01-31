#!/bin/bash
# docker/scripts/wait-for-it.sh
# Location: omniswap/docker/scripts/wait-for-it.sh

# Wait for a service to be ready

HOST="$1"
PORT="$2"
TIMEOUT="${3:-30}"

echo "⏳ Waiting for $HOST:$PORT..."

for i in $(seq 1 $TIMEOUT); do
    if nc -z "$HOST" "$PORT" > /dev/null 2>&1; then
        echo "✅ $HOST:$PORT is available!"
        exit 0
    fi
    sleep 1
done

echo "❌ Timeout waiting for $HOST:$PORT"
exit 1
