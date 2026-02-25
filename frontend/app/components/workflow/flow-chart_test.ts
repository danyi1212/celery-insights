import { createStateTask } from "@test-fixtures"
import { getFlowGraph } from "./flow-chart"

describe("getFlowGraph", () => {
    it("creates a single node for a root task with no children", () => {
        const root = createStateTask({ id: "root" })
        const { nodes, edges } = getFlowGraph([root], "root")

        expect(nodes).toHaveLength(1)
        expect(edges).toHaveLength(0)
        expect(nodes[0].id).toBe("root")
    })

    it("creates edges from parent to children", () => {
        const root = createStateTask({ id: "root" })
        const child1 = createStateTask({ id: "child-1", parentId: "root" })
        const child2 = createStateTask({ id: "child-2", parentId: "root" })

        const { nodes, edges } = getFlowGraph([root, child1, child2], "root")

        expect(nodes).toHaveLength(3)
        expect(edges).toHaveLength(2)
        expect(edges.map((e) => e.target).sort()).toEqual(["child-1", "child-2"])
        expect(edges.every((e) => e.source === "root")).toBe(true)
    })

    it("vertically centers children around parent y position", () => {
        const root = createStateTask({ id: "root" })
        const child1 = createStateTask({ id: "a-child", parentId: "root" })
        const child2 = createStateTask({ id: "b-child", parentId: "root" })
        const child3 = createStateTask({ id: "c-child", parentId: "root" })

        const { nodes } = getFlowGraph([root, child1, child2, child3], "root")

        const rootNode = nodes.find((n) => n.id === "root")!
        const childNodes = nodes.filter((n) => n.id !== "root")

        // Root at y=0, 3 children: startY = 0 - (3-1)/2 = -1, so y: -1, 0, 1 (* 100px)
        expect(rootNode.position.y).toBe(0)
        const childYs = childNodes.map((n) => n.position.y).sort((a, b) => a - b)
        expect(childYs).toEqual([-100, 0, 100])
    })

    it("sorts children alphabetically by id", () => {
        const root = createStateTask({ id: "root" })
        const childC = createStateTask({ id: "c", parentId: "root" })
        const childA = createStateTask({ id: "a", parentId: "root" })
        const childB = createStateTask({ id: "b", parentId: "root" })

        const { edges } = getFlowGraph([root, childC, childA, childB], "root")

        expect(edges.map((e) => e.target)).toEqual(["a", "b", "c"])
    })

    it("handles cycle detection by creating replaced nodes", () => {
        // Two parents share a child: root -> [c1, c2], c1 -> [shared], c2 -> [shared]
        // getChildMap builds from parentId in the tasks array, so include shared twice
        const tasks = [
            createStateTask({ id: "root" }),
            createStateTask({ id: "c1", parentId: "root" }),
            createStateTask({ id: "c2", parentId: "root" }),
            createStateTask({ id: "shared", parentId: "c1" }),
            createStateTask({ id: "shared", parentId: "c2" }),
        ]

        const result = getFlowGraph(tasks, "root")

        // DFS: root -> c1 (sorted first) -> shared (mark visited) -> c2 -> shared (already visited -> "shared-replaced")
        expect(result.nodes.map((n) => n.id).sort()).toEqual(["c1", "c2", "root", "shared", "shared-replaced"])
        expect(result.edges.find((e) => e.target === "shared-replaced")).toBeDefined()
    })

    it("returns empty graph when root task is missing", () => {
        const task = createStateTask({ id: "other" })
        const { nodes, edges } = getFlowGraph([task], "missing-root")

        expect(nodes).toHaveLength(0)
        expect(edges).toHaveLength(0)
    })

    it("handles deep trees correctly", () => {
        const tasks = [
            createStateTask({ id: "level-0" }),
            createStateTask({ id: "level-1", parentId: "level-0" }),
            createStateTask({ id: "level-2", parentId: "level-1" }),
            createStateTask({ id: "level-3", parentId: "level-2" }),
        ]

        const { nodes, edges } = getFlowGraph(tasks, "level-0")

        expect(nodes).toHaveLength(4)
        expect(edges).toHaveLength(3)
        // Each level at increasing x positions (x * 180)
        const xPositions = nodes.map((n) => n.position.x)
        expect(xPositions).toEqual([0, 180, 360, 540])
    })

    it("uses initial position when provided", () => {
        const root = createStateTask({ id: "root" })
        const { nodes } = getFlowGraph([root], "root", { x: 5, y: 3 })

        expect(nodes[0].position.x).toBe(5 * 180)
        expect(nodes[0].position.y).toBe(3 * 100)
    })
})
