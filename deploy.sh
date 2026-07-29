#!/bin/bash

# Deploy script for amarhan-demo
# This script builds the project locally, compresses it, and deploys to the server

set -e  # Exit on error

# Configuration
SSH_KEY="${SSH_KEY:-$HOME/.ssh/naidan-main.pem}"
SERVER_USER="ubuntu"
SERVER_HOST="${SERVER_HOST:-ec2-13-215-144-207.ap-southeast-1.compute.amazonaws.com}"
PROJECT_DIR="amarhan-front"
BUILD_DIR=".output"
DEPLOY_DIR="${DEPLOY_DIR:-~/iveel-amarhan/amarhan-front}"
ARCHIVE_NAME="amarhan-front-build.tar.gz"
TEMP_ARCHIVE="/tmp/${ARCHIVE_NAME}"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo -e "${GREEN}Starting deployment process...${NC}"

# Check if SSH key exists
if [ ! -f "$SSH_KEY" ]; then
    echo -e "${RED}Error: SSH key file '$SSH_KEY' not found!${NC}"
    exit 1
fi

# Түлхүүр репод байхаа больсон (~/.ssh/-д зөөгдсөн). Эрхийг зөвхөн шалгана.
chmod 600 "$SSH_KEY" 2>/dev/null || true

# Navigate to project directory
if [ ! -d "$PROJECT_DIR" ]; then
    echo -e "${RED}Error: Project directory '$PROJECT_DIR' not found!${NC}"
    exit 1
fi

cd "$PROJECT_DIR"

echo -e "${YELLOW}Step 1: Installing dependencies...${NC}"
npm ci

echo -e "${YELLOW}Step 2: Building project...${NC}"
npm run build

# Check if build was successful
if [ ! -d "$BUILD_DIR" ]; then
    echo -e "${RED}Error: Build directory '$BUILD_DIR' not found after build!${NC}"
    exit 1
fi

echo -e "${YELLOW}Step 3: Compressing build files...${NC}"
cd ..
# Use COPYFILE_DISABLE to prevent macOS extended attributes warnings
export COPYFILE_DISABLE=1
tar -czf "$TEMP_ARCHIVE" -C "$PROJECT_DIR" "$BUILD_DIR" 2>/dev/null

# Check if compression was successful
if [ ! -f "$TEMP_ARCHIVE" ]; then
    echo -e "${RED}Error: Failed to create archive!${NC}"
    exit 1
fi

ARCHIVE_SIZE=$(du -h "$TEMP_ARCHIVE" | cut -f1)
echo -e "${GREEN}Archive created: ${ARCHIVE_SIZE}${NC}"

echo -e "${YELLOW}Step 4: Uploading to server...${NC}"
scp -i "$SSH_KEY" "$TEMP_ARCHIVE" "${SERVER_USER}@${SERVER_HOST}:${ARCHIVE_NAME}"

if [ $? -ne 0 ]; then
    echo -e "${RED}Error: Failed to upload archive to server!${NC}"
    rm -f "$TEMP_ARCHIVE"
    exit 1
fi

echo -e "${YELLOW}Step 5: Extracting on server...${NC}"
ssh -i "$SSH_KEY" "${SERVER_USER}@${SERVER_HOST}" << 'ENDSSH'
    # Use $HOME instead of ~ for proper expansion
    DEPLOY_DIR="$HOME/amarhan-crm/amarhan-demo"
    ARCHIVE_NAME="amarhan-front-build.tar.gz"
    BUILD_DIR=".output"
    
    # Create deployment directory if it doesn't exist
    mkdir -p "$DEPLOY_DIR"
    
    # Check archive exists
    if [ ! -f "$HOME/$ARCHIVE_NAME" ]; then
        echo "ERROR: Archive file not found on server!"
        exit 1
    fi
    
    # Extract archive (suppress macOS extended attributes warnings)
    cd "$DEPLOY_DIR"
    echo "Extracting archive from $HOME/$ARCHIVE_NAME to $DEPLOY_DIR..."
    tar -xzf "$HOME/$ARCHIVE_NAME" 2>&1 | grep -v "Ignoring unknown extended header keyword" || true
    
    # List current directory contents (including hidden files)
    echo ""
    echo "Contents of $DEPLOY_DIR after extraction:"
    ls -la
    
    # Verify extraction
    if [ -d "$BUILD_DIR" ]; then
        FILE_COUNT=$(find "$BUILD_DIR" -type f | wc -l)
        DIR_COUNT=$(find "$BUILD_DIR" -type d | wc -l)
        echo ""
        echo "✓ Deployment completed successfully on server!"
        echo "Build files extracted to: $DEPLOY_DIR/$BUILD_DIR"
        echo "Total files extracted: $FILE_COUNT"
        echo "Total directories: $DIR_COUNT"
        echo ""
        echo "Top level contents of .output:"
        ls -lh "$BUILD_DIR" | head -10
        echo ""
        echo "=== Final Verification ==="
        echo "Directory listing (use 'ls -la' to see hidden files):"
        ls -la "$DEPLOY_DIR"
        
        # Create start script with PORT=3500
        echo "Creating start script with PORT=3500..."
        cat > "$DEPLOY_DIR/start.sh" << 'STARTSCRIPT'
#!/bin/bash
cd "$(dirname "$0")/.output"
PORT=3500 node server/index.mjs
STARTSCRIPT
        chmod +x "$DEPLOY_DIR/start.sh"
        echo "✓ Start script created at $DEPLOY_DIR/start.sh"
    else
        echo ""
        echo "ERROR: Build directory '$BUILD_DIR' not found after extraction!"
        echo "Current directory: $(pwd)"
        echo "Directory contents:"
        ls -la
        exit 1
    fi
    
    # Remove archive from server
    rm -f "$HOME/$ARCHIVE_NAME"
ENDSSH

if [ $? -ne 0 ]; then
    echo -e "${RED}Error: Failed to extract files on server!${NC}"
    rm -f "$TEMP_ARCHIVE"
    exit 1
fi

# Clean up local temporary archive
rm -f "$TEMP_ARCHIVE"

echo -e "${GREEN}✓ Deployment completed successfully!${NC}"
echo -e "${GREEN}Build files are now available at: /home/ubuntu/amarhan-crm/amarhan-demo/.output${NC}"
echo ""
echo -e "${YELLOW}To verify on the server, run:${NC}"
echo -e "  ${GREEN}ssh -i naidan-main.pem ubuntu@ec2-13-215-144-207.ap-southeast-1.compute.amazonaws.com${NC}"
echo -e "  ${GREEN}cd ~/amarhan-crm/amarhan-demo && ls -la${NC}"
echo ""
echo -e "${YELLOW}To run the production server on port 3500:${NC}"
echo -e "  ${GREEN}cd ~/amarhan-crm/amarhan-demo${NC}"
echo -e "  ${GREEN}./start.sh${NC}"
echo -e "${YELLOW}Or manually:${NC}"
echo -e "  ${GREEN}cd ~/amarhan-crm/amarhan-demo/.output${NC}"
echo -e "  ${GREEN}PORT=3500 node server/index.mjs${NC}"
echo -e "${YELLOW}Note: Use 'ls -la' (not 'ls -l') to see the .output directory${NC}"

