import { describe, test } from "node:test"
import assert from "node:assert/strict"

const filters = Bun.YAML.parse(await Bun.file(new URL("../.github/ci-filters.yml", import.meta.url)).text()) as Record<
  string,
  string[]
>

function affected(path: string): string[] {
  return Object.entries(filters)
    .filter(([, patterns]) => patterns.some((pattern) => new Bun.Glob(pattern).match(path)))
    .map(([name]) => name)
    .sort()
}

describe("CI path ownership", () => {
  test("Helm release tools run Python lint and chart validation without application or Kubernetes suites", () => {
    for (const path of ["tooling/helm/release.py", "tooling/helm/release_test.py", "tooling/helm/chart_test.py"]) {
      assert.deepEqual(affected(path), ["helm", "python-tools"])
    }
    assert.deepEqual(affected(".github/workflows/publish-chart.yml"), ["helm"])
  })

  test("CI test code runs without application suites", () => {
    assert.deepEqual(affected("tooling/ci-filters.test.ts"), ["typescript-tools"])
  })

  test("operator README edits do not run application builds", () => {
    assert.deepEqual(affected("README.md"), [])
    assert.deepEqual(affected("charts/celery-insights/README.md"), [])
    assert.deepEqual(affected("CONTRIBUTING.md"), [])
  })

  test("chart and Kubernetes test changes retain cluster coverage", () => {
    for (const path of ["charts/celery-insights/templates/deployment.yaml", "tooling/helm/e2e.py"]) {
      assert.ok(affected(path).includes("helm-e2e"))
      assert.ok(affected(path).includes("helm"))
    }
    assert.deepEqual(affected("tooling/helm/browser.ts"), ["helm", "helm-e2e", "typescript-tools"])
    assert.deepEqual(affected("tooling/playwright.ts"), ["helm", "helm-e2e", "integration", "typescript-tools"])
    assert.deepEqual(affected("charts/celery-insights/examples/oidc.yaml"), ["helm"])
  })

  test("application and build changes retain the required regression suites", () => {
    assert.deepEqual(affected("server/lifespan.py"), ["all-image", "backend", "helm", "helm-e2e", "image"])
    assert.deepEqual(affected("runtime/security/http.ts"), ["database", "frontend", "helm", "helm-e2e", "image"])
    assert.deepEqual(affected("test_project/tasks/basic.py"), ["helm", "helm-e2e", "integration", "python-tools"])
    assert.deepEqual(affected("src/content/docs/kubernetes.mdx"), ["frontend", "image"])
    assert.deepEqual(affected("tooling/tsconfig-aliases.ts"), ["frontend", "helm", "image", "typescript-tools"])
    assert.ok(affected("Dockerfile").includes("helm-e2e"))
  })

  test("CI workflow changes validate every affected CI job", () => {
    const changes = affected(".github/workflows/ci.yml")
    for (const name of ["backend", "frontend", "integration", "database", "helm", "helm-e2e"]) {
      assert.ok(changes.includes(name))
    }
  })
})
