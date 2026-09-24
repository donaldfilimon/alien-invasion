# Self-hosted macOS runner

The GitHub Actions jobs in this repository run on a macOS arm64 runner registered to this repository. GitHub-hosted jobs can't start while the account's Actions billing is locked (they fail in about two seconds with no runner assigned), but self-hosted jobs still run.

| Workflow | Job | Runs on |
|----------|-----|---------|
| `.github/workflows/ci.yml` | `build` | self-hosted (push to `main`, same-repo PRs) |
| `.github/workflows/ci.yml` | `build (GitHub-hosted, fork PRs)` | `ubuntu-latest`, fork PRs only |
| `.github/workflows/deploy-pages.yml` | `build`, `deploy` | self-hosted (push to `main`, `workflow_dispatch`) |

## Registration

| Field | Value |
|-------|-------|
| Labels | `self-hosted`, `macOS`, `ARM64`, `alien-invasion` |
| Register at | [Settings → Actions → Runners → New self-hosted runner](https://github.com/donaldfilimon/alien-invasion/settings/actions/runners/new?arch=arm64) (choose macOS, ARM64) |

Follow the download and `./config.sh` steps GitHub shows, and add the custom label `alien-invasion` when asked (or pass `--labels alien-invasion`). Then run `./svc.sh install && ./svc.sh start` so the runner starts at login.

A runner is registered to one repository. If the same Mac already runs a runner for another repository (for example `abi` or `gama`), install a second runner in its own directory, such as `~/actions-runner-alien-invasion`, with its own `config.sh` and service. Runners don't share a directory.

Until a runner with these labels is online, the self-hosted jobs wait in the queue.

## Host requirements

- Homebrew. The Pages build needs GNU tar (`gtar`), because `actions/upload-pages-artifact` archives with `gtar` on macOS. Install it once with `brew install gnu-tar`; if it's missing, the workflow installs it with Homebrew, and fails with a clear error when Homebrew isn't there.
- Network access to download Node 22 (`actions/setup-node`) and Bun 1.4.2 (`oven-sh/setup-bun`) into the runner's tool cache. Nothing needs `sudo`.
- No Xcode is needed. The native packages (`oxlint`, `rolldown`, `lightningcss`) ship `darwin-arm64` builds, and `bun.lock` pins them.

## Security

This repository is public, so the self-hosted jobs run only for trusted events: `push` to `main`, `workflow_dispatch`, and pull requests from branches in this repository. Each self-hosted job also checks `github.repository == 'donaldfilimon/alien-invasion'`, so forks of the repository never target the machine. Fork pull requests run the `build (GitHub-hosted, fork PRs)` job on a GitHub-hosted runner instead. No workflow uses `pull_request_target`, `issue_comment` or `workflow_run`.

Checkouts use `persist-credentials: false`. CI's token is `contents: read`. The Pages workflow keeps its existing `pages: write` and `id-token: write`, which the deployment needs.

Where you can, run the runner as a dedicated macOS user rather than your daily account, and keep no production secrets on the host.

## GitHub Pages

The README says the site is served from the `gh-pages` branch. For `deploy-pages.yml` to publish, Settings → Pages → Source must be "GitHub Actions". While the source is a branch, the deploy step fails and the `gh-pages` branch keeps serving the site. This was true before the runner move too.

## Stays GitHub-hosted

Only `build (GitHub-hosted, fork PRs)` stays on a GitHub-hosted runner, so untrusted fork code never runs on this machine. It stays blocked until the billing lock clears.
