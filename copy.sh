#!/bin/bash

# Change to the script's directory
cd "$(dirname "${BASH_SOURCE[0]}")" || exit

# Check if .env.local file exists
if [[ -f ".env.local" ]]; then
    source ".env.local"
elif [[ -f ".env" ]]; then
    source ".env"
else
    echo "Error: Neither .env.local nor .env file found."
    exit 1
fi

# Ensure that paths are set in the sourced file
if [[ -z "$COMMON_ADMIN_PROJECT" || -z "$ADMIN_PROJECT" ]]; then
    echo "Error: Paths not defined in the sourced file."
    exit 1
fi

# Check if directories exist
if [[ ! -d "${COMMON_ADMIN_PROJECT}" || ! -d "${ADMIN_PROJECT}" ]]; then
    echo "Error: One or both of the specified directories do not exist."
    exit 1
fi

# Create directories before copying files
mkdir -p "${ADMIN_PROJECT}/node_modules/@anzusystems/common-admin/"
mkdir -p "${ADMIN_PROJECT}/node_modules/@anzusystems/common-admin/dist"

# Copy package.json from COMMON_ADMIN_PROJECT to ADMIN_PROJECT
if [[ -f "${COMMON_ADMIN_PROJECT}/package.json" ]]; then
    cp "${COMMON_ADMIN_PROJECT}/package.json" "${ADMIN_PROJECT}/node_modules/@anzusystems/common-admin/"
else
    echo "Error: package.json not found in ${COMMON_ADMIN_PROJECT}."
    exit 1
fi

# Create dist directory before copying files
mkdir -p "${ADMIN_PROJECT}/node_modules/@anzusystems/common-admin/dist"

# Use paths from sourced file
cp -r "${COMMON_ADMIN_PROJECT}/dist/"* "${ADMIN_PROJECT}/node_modules/@anzusystems/common-admin/dist/"
