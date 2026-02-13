#!/bin/bash

if [ -z "$1" ]; then
    echo "Error: Please provide a benchmark file to compare against"
    echo "Usage: pnpm test:bench:compare <filename>"
    echo "Example: pnpm test:bench:compare 2024-03-21-results.json"
    exit 1
fi

if [ ! -f "benchmarks/$1" ]; then
    echo "Error: Benchmark file 'benchmarks/$1' not found"
    echo "Available benchmark files:"
    ls -1 benchmarks/*.json 2>/dev/null || echo "No benchmark files found"
    exit 1
fi

vitest bench --no-watch --compare "benchmarks/$1" 