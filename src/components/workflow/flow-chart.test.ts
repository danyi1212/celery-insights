import { createTask } from "@test-fixtures"
import { getFlowGraph } from "./flow-chart"

describe("getFlowGraph", () => {
  it("keeps nested channel and resource branches in separate rows", () => {
    const tasks = [
      createTask({ id: "root" }),
      createTask({ id: "channel-meta", parent_id: "root" }),
      createTask({ id: "channel-linkedin", parent_id: "root" }),
      createTask({ id: "meta-resource-1", parent_id: "channel-meta" }),
      createTask({ id: "meta-resource-2", parent_id: "channel-meta" }),
      createTask({ id: "linkedin-resource-1", parent_id: "channel-linkedin" }),
      createTask({ id: "linkedin-resource-2", parent_id: "channel-linkedin" }),
      createTask({ id: "linkedin-resource-3", parent_id: "channel-linkedin" }),
      createTask({ id: "linkedin-resource-4", parent_id: "channel-linkedin" }),
      createTask({ id: "meta-hierarchy-1", parent_id: "meta-resource-1" }),
      createTask({ id: "meta-hierarchy-2", parent_id: "meta-resource-2" }),
      createTask({ id: "linkedin-hierarchy-1", parent_id: "linkedin-resource-1" }),
      createTask({ id: "linkedin-hierarchy-2", parent_id: "linkedin-resource-2" }),
      createTask({ id: "linkedin-hierarchy-3", parent_id: "linkedin-resource-3" }),
      createTask({ id: "linkedin-hierarchy-4", parent_id: "linkedin-resource-4" }),
      createTask({ id: "meta-finalize", parent_id: "meta-hierarchy-1" }),
      createTask({ id: "linkedin-metrics-1", parent_id: "linkedin-hierarchy-1" }),
      createTask({ id: "linkedin-conversions-1", parent_id: "linkedin-hierarchy-1" }),
      createTask({ id: "linkedin-metrics-2", parent_id: "linkedin-hierarchy-2" }),
      createTask({ id: "linkedin-conversions-2", parent_id: "linkedin-hierarchy-2" }),
    ]

    const { nodes, edges } = getFlowGraph(tasks, "root")
    const columns = new Map<number, number[]>()
    for (const node of nodes) {
      const rows = columns.get(node.position.x) ?? []
      rows.push(node.position.y)
      columns.set(node.position.x, rows)
    }

    expect(nodes).toHaveLength(tasks.length)
    for (const rows of columns.values()) {
      rows.sort((first, second) => first - second)
      for (let index = 1; index < rows.length; index++) {
        expect(rows[index] - rows[index - 1]).toBeGreaterThanOrEqual(100)
      }
    }
    expect(edges.filter((edge) => edge.target === "meta-finalize")).toMatchObject([
      { source: "meta-hierarchy-1", target: "meta-finalize" },
    ])
  })

  it("centers a parent between child subtrees of different sizes", () => {
    const tasks = [
      createTask({ id: "root" }),
      createTask({ id: "branch-a", parent_id: "root" }),
      createTask({ id: "branch-b", parent_id: "root" }),
      createTask({ id: "leaf-a1", parent_id: "branch-a" }),
      createTask({ id: "leaf-a2", parent_id: "branch-a" }),
      createTask({ id: "leaf-a3", parent_id: "branch-a" }),
      createTask({ id: "leaf-b", parent_id: "branch-b" }),
    ]

    const { nodes } = getFlowGraph(tasks, "root", { x: 2, y: 3 })
    const root = nodes.find((node) => node.id === "root")!
    const branchA = nodes.find((node) => node.id === "branch-a")!
    const branchB = nodes.find((node) => node.id === "branch-b")!
    const branchALeaves = nodes.filter((node) => node.id.startsWith("leaf-a"))
    const branchBLeaf = nodes.find((node) => node.id === "leaf-b")!

    expect(root.position).toEqual({ x: 360, y: 300 })
    expect(root.position.y).toBe((branchA.position.y + branchB.position.y) / 2)
    expect(Math.max(...branchALeaves.map((node) => node.position.y))).toBeLessThan(branchBLeaf.position.y)
  })

  it("connects stored children when the child's parent metadata is missing", () => {
    const tasks = [
      createTask({ id: "root", children: ["channel"] }),
      createTask({ id: "channel", parent_id: "root", children: ["resource", "resource", "expired"] }),
      createTask({ id: "resource", children: ["hierarchy"] }),
      createTask({ id: "hierarchy" }),
    ]

    const { nodes, edges } = getFlowGraph(tasks, "root")

    expect(nodes.map((node) => node.id)).toEqual(["root", "channel", "resource", "hierarchy"])
    expect(edges.map((edge) => [edge.source, edge.target])).toEqual([
      ["root", "channel"],
      ["channel", "resource"],
      ["resource", "hierarchy"],
    ])
  })

  it("prefers an explicit parent over an older parent's children list", () => {
    const tasks = [
      createTask({ id: "root", children: ["child"] }),
      createTask({ id: "actual-parent", parent_id: "root", children: ["child"] }),
      createTask({ id: "child", parent_id: "actual-parent" }),
    ]
    const { edges } = getFlowGraph(tasks, "root")

    expect(edges.map((edge) => [edge.source, edge.target])).toEqual([
      ["root", "actual-parent"],
      ["actual-parent", "child"],
    ])
  })
  it("gives a parentless child one parent when several stored children lists claim it", () => {
    const tasks = [
      createTask({ id: "root", children: ["a", "b"] }),
      createTask({ id: "a", parent_id: "root", children: ["shared"] }),
      createTask({ id: "b", parent_id: "root", children: ["shared"] }),
      createTask({ id: "shared" }),
    ]

    const { nodes, edges } = getFlowGraph(tasks, "root")

    expect(nodes.map((node) => node.id)).toEqual(["root", "a", "shared", "b"])
    expect(edges.map((edge) => [edge.source, edge.target])).toEqual([
      ["root", "a"],
      ["a", "shared"],
      ["root", "b"],
    ])
  })

  it("lets only a reachable parent claim a parentless child, whatever the row order", () => {
    const tasks = [
      createTask({ id: "orphan", children: ["child"] }),
      createTask({ id: "root", children: ["child"] }),
      createTask({ id: "child" }),
    ]

    const { nodes, edges } = getFlowGraph(tasks, "root")

    expect(nodes.map((node) => node.id)).toEqual(["root", "child"])
    expect(edges.map((edge) => [edge.source, edge.target])).toEqual([["root", "child"]])
  })

  it("ignores a parentless child that lists itself", () => {
    const tasks = [createTask({ id: "child", children: ["child"] }), createTask({ id: "root", children: ["child"] })]

    const { nodes, edges } = getFlowGraph(tasks, "root")

    expect(nodes.map((node) => node.id)).toEqual(["root", "child"])
    expect(edges.map((edge) => [edge.source, edge.target])).toEqual([["root", "child"]])
  })

  it("never re-adds the root as a child from a stale children list", () => {
    const tasks = [
      createTask({ id: "root", children: ["child"] }),
      createTask({ id: "child", parent_id: "root", children: ["root"] }),
    ]

    const { nodes, edges } = getFlowGraph(tasks, "root")

    expect(nodes.map((node) => node.id)).toEqual(["root", "child"])
    expect(edges.map((edge) => [edge.source, edge.target])).toEqual([["root", "child"]])
  })

  it("creates a single node for a root task with no children", () => {
    const root = createTask({ id: "root" })
    const { nodes, edges } = getFlowGraph([root], "root")

    expect(nodes).toHaveLength(1)
    expect(edges).toHaveLength(0)
    expect(nodes[0].id).toBe("root")
  })

  it("creates edges from parent to children", () => {
    const root = createTask({ id: "root" })
    const child1 = createTask({ id: "child-1", parent_id: "root" })
    const child2 = createTask({ id: "child-2", parent_id: "root" })

    const { nodes, edges } = getFlowGraph([root, child1, child2], "root")

    expect(nodes).toHaveLength(3)
    expect(edges).toHaveLength(2)
    expect(edges.map((e) => e.target).sort()).toEqual(["child-1", "child-2"])
    expect(edges.every((e) => e.source === "root")).toBe(true)
  })

  it("vertically centers children around parent y position", () => {
    const root = createTask({ id: "root" })
    const child1 = createTask({ id: "a-child", parent_id: "root" })
    const child2 = createTask({ id: "b-child", parent_id: "root" })
    const child3 = createTask({ id: "c-child", parent_id: "root" })

    const { nodes } = getFlowGraph([root, child1, child2, child3], "root")

    const rootNode = nodes.find((n) => n.id === "root")!
    const childNodes = nodes.filter((n) => n.id !== "root")

    // Root at y=0, 3 children: startY = 0 - (3-1)/2 = -1, so y: -1, 0, 1 (* 100px)
    expect(rootNode.position.y).toBe(0)
    const childYs = childNodes.map((n) => n.position.y).sort((a, b) => a - b)
    expect(childYs).toEqual([-100, 0, 100])
  })

  it("sorts children alphabetically by id", () => {
    const root = createTask({ id: "root" })
    const childC = createTask({ id: "c", parent_id: "root" })
    const childA = createTask({ id: "a", parent_id: "root" })
    const childB = createTask({ id: "b", parent_id: "root" })

    const { edges } = getFlowGraph([root, childC, childA, childB], "root")

    expect(edges.map((e) => e.target)).toEqual(["a", "b", "c"])
  })

  it("handles already-visited nodes by creating replaced nodes", () => {
    // Diamond DAG: root -> [c1, c2], c1 -> [shared], c2 -> [shared]
    // When DFS visits "shared" via c1 first, visiting it again via c2 creates a replaced node
    const tasks = [
      createTask({ id: "root" }),
      createTask({ id: "c1", parent_id: "root" }),
      createTask({ id: "c2", parent_id: "root" }),
      createTask({ id: "shared", parent_id: "c1" }),
      createTask({ id: "shared", parent_id: "c2" }),
    ]

    const result = getFlowGraph(tasks, "root")

    // DFS: root -> c1 (sorted first) -> shared (mark visited) -> c2 -> shared (already visited -> "shared-replaced")
    expect(result.nodes.map((n) => n.id).sort()).toEqual(["c1", "c2", "root", "shared", "shared-replaced"])
    expect(result.edges.find((e) => e.target === "shared-replaced")).toBeDefined()
  })

  it("returns empty graph when root task is missing", () => {
    const task = createTask({ id: "other" })
    const { nodes, edges } = getFlowGraph([task], "missing-root")

    expect(nodes).toHaveLength(0)
    expect(edges).toHaveLength(0)
  })

  it("handles deep trees correctly", () => {
    const tasks = [
      createTask({ id: "level-0" }),
      createTask({ id: "level-1", parent_id: "level-0" }),
      createTask({ id: "level-2", parent_id: "level-1" }),
      createTask({ id: "level-3", parent_id: "level-2" }),
    ]

    const { nodes, edges } = getFlowGraph(tasks, "level-0")

    expect(nodes).toHaveLength(4)
    expect(edges).toHaveLength(3)
    // Each level at increasing x positions (x * 180)
    const xPositions = nodes.map((n) => n.position.x)
    expect(xPositions).toEqual([0, 180, 360, 540])
  })

  it("uses initial position when provided", () => {
    const root = createTask({ id: "root" })
    const { nodes } = getFlowGraph([root], "root", { x: 5, y: 3 })

    expect(nodes[0].position.x).toBe(5 * 180)
    expect(nodes[0].position.y).toBe(3 * 100)
  })
})
