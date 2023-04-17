export class LRUMap<K, V> {
    private readonly values: Map<K, { value: V; node: DoublyLinkedListNode<K> }> = new Map()
    private readonly lruList: DoublyLinkedList<K> = new DoublyLinkedList()
    private readonly capacity: number

    public constructor(capacity: number)
    public constructor(copy: LRUMap<K, V>)
    constructor(capacityOrCopy?: number | LRUMap<K, V>) {
        if (capacityOrCopy instanceof LRUMap) {
            // Create a new LRUCache object with the same contents as the provided object
            this.values = new Map(capacityOrCopy.values)
            this.lruList = new DoublyLinkedList(capacityOrCopy.lruList)
            this.capacity = capacityOrCopy.capacity
        } else {
            // Create a new empty LRUCache object with the provided maximum size
            this.values = new Map()
            this.lruList = new DoublyLinkedList()
            this.capacity = capacityOrCopy ?? 0
        }
    }

    public get(key: K): V | undefined {
        const item = this.values.get(key)
        if (item) {
            this.lruList.moveNodeToEnd(item.node)
            return item.value
        }
        return undefined
    }

    public set(key: K, value: V): void {
        const item = this.values.get(key)
        if (item) {
            item.value = value
            this.lruList.moveNodeToEnd(item.node)
        } else {
            const node = this.lruList.addNode(key)
            this.values.set(key, { value, node })
            if (this.values.size > this.capacity) {
                const removedKey = this.lruList.removeHead()
                this.values.delete(removedKey)
            }
        }
    }

    public iset(key: K, value: V): LRUMap<K, V> {
        const newCache = new LRUMap<K, V>(this)
        newCache.set(key, value)
        return newCache
    }

    public map<T>(callback: (value: V) => T): T[] {
        const result: T[] = []
        for (const value of this.values.values()) {
            result.push(callback(value.value))
        }
        return result
    }

    *[Symbol.iterator](): IterableIterator<V> {
        for (const { value } of this.values.values()) {
            yield value
        }
    }
}

class DoublyLinkedListNode<K> {
    constructor(
        public readonly key: K,
        public prev: DoublyLinkedListNode<K> | null = null,
        public next: DoublyLinkedListNode<K> | null = null
    ) {}
}

class DoublyLinkedList<K> {
    private head: DoublyLinkedListNode<K> | null = null
    private tail: DoublyLinkedListNode<K> | null = null

    constructor(list?: DoublyLinkedList<K>) {
        if (list) {
            for (const node of list.getNodes()) {
                this.addNode(node.key)
            }
        }
    }

    addNode(key: K): DoublyLinkedListNode<K> {
        const node = new DoublyLinkedListNode(key, this.tail, null)
        if (this.tail) {
            this.tail.next = node
        } else {
            this.head = node
        }
        this.tail = node
        return node
    }

    removeNode(node: DoublyLinkedListNode<K>): void {
        if (node.prev) {
            node.prev.next = node.next
        } else {
            this.head = node.next
        }
        if (node.next) {
            node.next.prev = node.prev
        } else {
            this.tail = node.prev
        }
    }

    moveNodeToEnd(node: DoublyLinkedListNode<K>): void {
        if (node === this.tail) {
            return
        }
        this.removeNode(node)
        this.addNode(node.key)
    }

    removeHead(): K {
        if (!this.head) {
            throw new Error("The list is empty")
        }
        const key = this.head.key
        this.removeNode(this.head)
        return key
    }

    private *getNodes(): Iterable<DoublyLinkedListNode<K>> {
        let node = this.head
        while (node) {
            yield node
            node = node.next
        }
    }
}
