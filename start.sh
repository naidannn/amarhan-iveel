#!/bin/bash

# Start script for amarhan-crm project
# Usage: ./start.sh [api|front|all]

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
    npm run dev
}

start_front() {
    echo -e "${BLUE}Starting Nuxt frontend server...${NC}"
    cd amarhan-front
    npm run dev
}

start_all() {
    echo -e "${GREEN}Starting both API and Demo servers...${NC}"
    echo -e "${YELLOW}Press Ctrl+C to stop all servers${NC}"
    echo ""
    
    # Start API in background
    cd amarhan-api
    npm run dev &
    API_PID=$!
    cd ..
    
    # Wait a bit for API to start
    sleep 2
    
    # Start Demo in background
    cd amarhan-front
    npm run dev &
    FRONT_PID=$!
    cd ..
    
    # Function to cleanup on exit
    cleanup() {
        echo -e "\n${YELLOW}Stopping servers...${NC}"
        kill $API_PID 2>/dev/null || true
        kill $FRONT_PID 2>/dev/null || true
        exit 0
    }
    
    # Trap Ctrl+C
    trap cleanup INT TERM
    
    # Wait for both processes
    wait $API_PID $FRONT_PID
}

case "$MODE" in
    api)
        start_api
        ;;
    front)
        start_front
        ;;
    all)
        start_all
        ;;
    *)
        echo -e "${RED}Invalid option: $MODE${NC}"
        echo -e "${YELLOW}Usage: ./start.sh [api|front|all]${NC}"
        echo -e "${YELLOW}  api  - Start only the API server${NC}"
        echo -e "${YELLOW}  front - Start only the Nuxt frontend server${NC}"
        echo -e "${YELLOW}  all  - Start both servers (default)${NC}"
        exit 1
        ;;
esac

