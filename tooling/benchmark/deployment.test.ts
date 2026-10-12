// @vitest-environment node
import { describe, expect, it } from "vitest"
import { applicationPod, podMilestones } from "./deployment"

describe("native pod measurement", () => {
  it("keeps unavailable milestones distinct from zero and uses pod creation time", () => {
    const report = podMilestones({
      metadata: { creationTimestamp: "2026-10-11T10:00:00Z", uid: "fixture" },
      status: {
        conditions: [
          { type: "PodScheduled", status: "True", lastTransitionTime: "2026-10-11T10:00:01Z" },
          { type: "Ready", status: "False", lastTransitionTime: "2026-10-11T10:00:02Z" },
        ],
        containerStatuses: [{ state: { running: { startedAt: "2026-10-11T10:00:03Z" } }, restartCount: 0 }],
      },
    })
    expect(report.scheduledMs).toBe(1000)
    expect(report.containerStartedMs).toBe(3000)
    expect(report.dataProbeReadyMs).toBeNull()
    expect(report.restartCount).toBe(0)
    expect(podMilestones({}).scheduledMs).toBeNull()
  })

  it("uses a real database readiness probe and prepares the private non-root store", () => {
    const pod = applicationPod("app-cold", "fixture:immutable", "arm64")
    expect(pod.spec.containers[0].imagePullPolicy).toBe("Never")
    expect(pod.spec.containers[0].readinessProbe!.exec.command.join(" ")).toContain("{'operation':'counts'}")
    expect(pod.spec.containers[0].readinessProbe!.exec.command.join(" ")).not.toContain("signin")
    expect(pod.spec.containers.find((container) => container.name === "oracle")!.resources.limits.cpu).toBe("1")
    expect(pod.spec.initContainers[0].securityContext.runAsUser).toBe(0)
    expect(pod.spec.initContainers[0].command).toEqual(["sh", "-c", "chown myuser:myuser /data"])
    expect(pod.spec.volumes.find((volume) => volume.name === "data")!.hostPath!.path).toBe(
      "/var/local/celery-insights-benchmark",
    )
  })

  it("a registry-cold app can pull both the store initializer and the app from its pinned registry reference", () => {
    const reference = "localhost:5001/benchmark/app@sha256:" + "a".repeat(64)
    const pod = applicationPod("app-cold", reference, "arm64", "IfNotPresent")
    for (const container of [...pod.spec.initContainers, ...pod.spec.containers]) {
      expect(container.image).toBe(reference)
      expect(container.imagePullPolicy).toBe("IfNotPresent")
    }
    expect(podMilestones({}).storeInitFinishedMs).toBeNull()
  })
})
