#!/bin/bash
# setup.sh

# Update and install Python
apt-get update
apt-get install -y python3 python3-venv python3-pip

# Create virtual environment
python3 -m venv venv

# Activate venv and install dependencies
source venv/bin/activate
pip install --upgrade pip
pip install -r requirements.txt
