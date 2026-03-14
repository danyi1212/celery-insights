---
name: Bug report
about: Create a report to help us improve
title: "[BUG]"
labels: bug
assignees: ''

---

**Describe the bug**
A clear and concise description of what the bug is.

**To Reproduce**
Steps to reproduce the behavior:

1. Go to '...'
2. Click on '....'
3. Scroll down to '....'
4. See error

**Expected behavior**
A clear and concise description of what you expected to happen.

**Screenshots**
If applicable, add screenshots to help explain your problem.

**Debug Bundle**
If the issue depends on real runtime state, attach a redacted debug bundle captured from **Settings** -> **Download diagnostics** while the problem is visible.

Please also note:

- whether the attached bundle is redacted or includes secrets
- whether replay mode reproduces the same issue
- the exact `docker run ... DEBUG_BUNDLE_PATH=...` or `just start-debug /absolute/path/to/debug-bundle-v2.zip` command if you already replayed it locally

**Additional context**
Add any other context about the problem here.
