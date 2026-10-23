/** Keep Git subprocesses scoped to their explicit cwd, including inside commit hooks. */
export function isolatedGitEnvironment(environment: NodeJS.ProcessEnv = process.env): NodeJS.ProcessEnv {
  const transport = new Set([
    "GIT_ASKPASS",
    "GIT_SSH",
    "GIT_SSH_COMMAND",
    "GIT_TERMINAL_PROMPT",
    "GIT_SSL_CAINFO",
    "GIT_SSL_CAPATH",
  ])
  return Object.fromEntries(
    Object.entries(environment).filter(([key]) => !key.startsWith("GIT_") || transport.has(key)),
  )
}
