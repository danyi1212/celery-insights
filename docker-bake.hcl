group "e2e" {
  targets = ["e2e-test-project", "e2e-app"]
}

target "e2e-test-project" {
  context    = "./test_project"
  dockerfile = "Dockerfile"
  tags       = ["celery-insights-test-project:local"]
  cache-from = ["type=gha,version=2,scope=e2e-test-project"]
  cache-to   = ["type=gha,version=2,mode=max,scope=e2e-test-project"]
}

target "e2e-app" {
  context    = "."
  dockerfile = "Dockerfile"
  tags       = ["celery-insights-app:local"]
  cache-from = ["type=gha,version=2,scope=e2e-app"]
  cache-to   = ["type=gha,version=2,mode=max,scope=e2e-app"]
}
