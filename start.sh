#!/bin/bash

# Start script for amarhan-crm project
# Usage: ./start.sh [api|demo|all]

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Default to 'all' if no argument provided
MODE=${1:-all}

start_api() {
    echo -e "${BLUE}Starting API server...${NC}"
    cd amarhan-api
    if command -v yarn &> /dev/null; then
        yarn dev
    else
        npm run dev
    fi
}

start_demo() {
    echo -e "${BLUE}Starting Nuxt demo server...${NC}"
    cd amarhan-demo
    if command -v yarn &> /dev/null; then
        yarn dev
    else
        npm run dev
    fi
}

start_all() {
    echo -e "${GREEN}Starting both API and Demo servers...${NC}"
    echo -e "${YELLOW}Press Ctrl+C to stop all servers${NC}"
    echo ""
    
    # Start API in background
    cd amarhan-api
    if command -v yarn &> /dev/null; then
        yarn dev &
    else
        npm run dev &
    fi
    API_PID=$!
    cd ..
    
    # Wait a bit for API to start
    sleep 2
    
    # Start Demo in background
    cd amarhan-demo
    if command -v yarn &> /dev/null; then
        yarn dev &
    else
        npm run dev &
    fi
    DEMO_PID=$!
    cd ..
    
    # Function to cleanup on exit
    cleanup() {
        echo -e "\n${YELLOW}Stopping servers...${NC}"
        kill $API_PID 2>/dev/null || true
        kill $DEMO_PID 2>/dev/null || true
        exit 0
    }
    
    # Trap Ctrl+C
    trap cleanup INT TERM
    
    # Wait for both processes
    wait $API_PID $DEMO_PID
}

case "$MODE" in
    api)
        start_api
        ;;
    demo)
        start_demo
        ;;
    all)
        start_all
        ;;
    *)
        echo -e "${RED}Invalid option: $MODE${NC}"
        echo -e "${YELLOW}Usage: ./start.sh [api|demo|all]${NC}"
        echo -e "${YELLOW}  api  - Start only the API server${NC}"
        echo -e "${YELLOW}  demo - Start only the Nuxt demo server${NC}"
        echo -e "${YELLOW}  all  - Start both servers (default)${NC}"
        exit 1
        ;;
esac

