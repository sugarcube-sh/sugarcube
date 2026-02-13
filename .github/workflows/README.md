# CI/CD Workflows

This directory contains GitHub Actions workflows for continuous integration and deployment of packages in the Sugarcube monorepo.

## Requirements

The workflows are configured to use:
- Node.js: v20
- pnpm: v10.8.0
- Ubuntu: 22.04 LTS

## Workflows

### `ci.yml`

Runs continuous integration checks for all packages.

- **Triggers**: 
  - On push to `main`
  - On pull requests to `main`
- **Actions**:
  - Installs dependencies
  - Builds packages
  - Runs type checking
  - Runs tests

### `preview.yml`

Publishes preview versions of packages in the sugarcube-sh/sugarcube repository.

- **Triggers**: 
  - On push
  - On pull requests
- **Conditions**:
  - Only runs for sugarcube-sh/sugarcube repository
- **Actions**:
  - Builds packages
  - Publishes preview versions of:
    - `@sugarcube-sh/core`
    - `@sugarcube-sh/cli`
    - `@sugarcube-sh/postcss`
    - `@sugarcube-sh/vite`

## Publishing a New Version

### `release.yml`

Handles automated versioning and releases using changesets.

- **Triggers**: On push to `main`
- **Actions**:
  - Creates/updates "Version Packages" PR
  - Publishes to npm when PR is merged

## Changesets Workflow

The project uses changesets for automated versioning and releases. Here's how it works:

### Creating Changesets

When making changes that should be released:
1. Run `pnpm changeset` in your branch
2. Select the type of change (patch/minor/major)
3. Describe your changes
4. Commit the generated changeset file

### How Changesets Accumulate

Changesets are automatically accumulated in a single "Version Packages" PR:
- Each PR with changesets updates the same release PR
- All changesets are combined into one release
- Version bumps are calculated based on all changes
- Changelog entries are merged automatically

Example flow:
```
Merge PR #1 (with changeset) → Creates "Version Packages" PR #100
Merge PR #2 (with changeset) → Updates existing "Version Packages" PR #100
Merge PR #3 (with changeset) → Updates existing "Version Packages" PR #100
```

### Release Control

You control when releases happen by choosing when to merge the "Version Packages" PR.

### Important Notes

1. Never run `pnpm changeset version` manually
2. Let the GitHub Action handle versioning
3. Only create changesets with `pnpm changeset`
4. The release PR will accumulate all changes automatically