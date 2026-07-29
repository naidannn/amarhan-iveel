#!/bin/bash
# Серверт SSH-ээр холбогдоно.
# Түлхүүр репод БАЙХГҮЙ — ~/.ssh/-д хадгалагдана (Phase 0.1).
SSH_KEY="${SSH_KEY:-$HOME/.ssh/naidan-main.pem}"
SERVER_HOST="${SERVER_HOST:-ec2-13-215-144-207.ap-southeast-1.compute.amazonaws.com}"
ssh -i "$SSH_KEY" "ubuntu@${SERVER_HOST}"
