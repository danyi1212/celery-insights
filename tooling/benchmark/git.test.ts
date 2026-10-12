// @vitest-environment node
import { expect, test } from "vitest"
import { isolatedGitEnvironment } from "./git"

test("commit-hook Git routing and identity do not escape the subprocess cwd", () => {
  expect(
    isolatedGitEnvironment({
      PATH: "tools",
      GIT_DIR: "real-checkout",
      GIT_WORK_TREE: "real-files",
      GIT_INDEX_FILE: "real-index",
      GIT_CONFIG_COUNT: "1",
      GIT_CONFIG_KEY_0: "core.bare",
      GIT_CONFIG_VALUE_0: "true",
      GIT_AUTHOR_NAME: "Parent commit",
      GIT_ASKPASS: "credential-helper",
      GIT_SSH_COMMAND: "ssh",
    }),
  ).toEqual({ PATH: "tools", GIT_ASKPASS: "credential-helper", GIT_SSH_COMMAND: "ssh" })
})
