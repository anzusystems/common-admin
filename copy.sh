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

# Target projects can be defined as:
#   ADMIN_PROJECT=/path/to/admin-cms
#   ADMIN_PROJECT=/path/to/admin-cms:/path/to/admin-ugc   (colon separated)
#   ADMIN_PROJECTS=("/path/to/admin-cms" "/path/to/admin-ugc")   (bash array)
TARGETS=()

if [[ -n "${ADMIN_PROJECTS+x}" ]]; then
    TARGETS+=("${ADMIN_PROJECTS[@]}")
fi

if [[ -n "${ADMIN_PROJECT+x}" ]]; then
    if [[ "$(declare -p ADMIN_PROJECT 2>/dev/null)" == "declare -a"* ]]; then
        TARGETS+=("${ADMIN_PROJECT[@]}")
    else
        IFS=':' read -r -a SPLIT_TARGETS <<< "${ADMIN_PROJECT}"
        TARGETS+=("${SPLIT_TARGETS[@]}")
    fi
fi

# Drop empty entries (e.g. trailing colon)
FILTERED_TARGETS=()
for target in "${TARGETS[@]}"; do
    [[ -n "${target}" ]] && FILTERED_TARGETS+=("${target}")
done
TARGETS=("${FILTERED_TARGETS[@]}")

# Ensure that paths are set in the sourced file
if [[ -z "${COMMON_ADMIN_PROJECT}" || ${#TARGETS[@]} -eq 0 ]]; then
    echo "Error: Paths not defined in the sourced file."
    exit 1
fi

# Check if source directory exists
if [[ ! -d "${COMMON_ADMIN_PROJECT}" ]]; then
    echo "Error: Source directory ${COMMON_ADMIN_PROJECT} does not exist."
    exit 1
fi

if [[ ! -d "${COMMON_ADMIN_PROJECT}/dist" ]]; then
    echo "Error: dist not found in ${COMMON_ADMIN_PROJECT}. Build it first."
    exit 1
fi

if [[ ! -f "${COMMON_ADMIN_PROJECT}/package.json" ]]; then
    echo "Error: package.json not found in ${COMMON_ADMIN_PROJECT}."
    exit 1
fi

# Check if all target directories exist before copying anything
MISSING=0
for target in "${TARGETS[@]}"; do
    if [[ ! -d "${target}" ]]; then
        echo "Error: Target directory ${target} does not exist."
        MISSING=1
    fi
done
[[ ${MISSING} -eq 1 ]] && exit 1

for target in "${TARGETS[@]}"; do
    PACKAGE_DIR="${target}/node_modules/@anzusystems/common-admin"

    # Wipe the previous dist first. `cp -r` only overwrites; it never removes, so chunks whose
    # content hash changed piled up as orphans and the package ended up holding several builds at
    # once. Scoped to this package's own dist directory, nothing else in node_modules is touched.
    rm -rf "${PACKAGE_DIR}/dist"

    # Create directories before copying files
    mkdir -p "${PACKAGE_DIR}/dist"

    # Copy package.json from COMMON_ADMIN_PROJECT to the target project
    cp "${COMMON_ADMIN_PROJECT}/package.json" "${PACKAGE_DIR}/"

    cp -r "${COMMON_ADMIN_PROJECT}/dist/"* "${PACKAGE_DIR}/dist/"

    # Clear Vite's dependency pre-bundle cache so it picks up the new files
    rm -rf "${target}/node_modules/.vite/deps/"

    # Touch trigger file so Vite plugin detects the update and does a full-reload
    touch "${target}/.common-admin-updated"

    echo "Successfully copied release from ${COMMON_ADMIN_PROJECT}/dist to ${PACKAGE_DIR}/dist"
done
