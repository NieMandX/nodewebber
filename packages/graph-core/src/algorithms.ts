import type { GraphDocument } from '@procedural-web-composer/shared-types'

export function detectCycles(graph: GraphDocument): string[][] {
  const adjacency = buildAdjacency(graph)
  const visiting = new Set<string>()
  const visited = new Set<string>()
  const stack: string[] = []
  const cycles = new Map<string, string[]>()

  function visit(nodeId: string): void {
    if (visited.has(nodeId)) {
      return
    }

    visiting.add(nodeId)
    stack.push(nodeId)

    for (const next of adjacency.get(nodeId) ?? []) {
      if (visiting.has(next)) {
        const cycleStartIndex = stack.indexOf(next)
        const cyclePath = [...stack.slice(cycleStartIndex), next]
        cycles.set(cyclePath.join('>'), cyclePath)
        continue
      }

      visit(next)
    }

    stack.pop()
    visiting.delete(nodeId)
    visited.add(nodeId)
  }

  for (const node of graph.nodes) {
    visit(node.id)
  }

  return Array.from(cycles.values())
}

export function topoSort(graph: GraphDocument): string[] {
  const adjacency = buildAdjacency(graph)
  const inDegree = new Map<string, number>()

  for (const node of graph.nodes) {
    inDegree.set(node.id, 0)
  }

  for (const edge of graph.edges) {
    inDegree.set(edge.to.nodeId, (inDegree.get(edge.to.nodeId) ?? 0) + 1)
  }

  const queue = graph.nodes
    .filter((node) => (inDegree.get(node.id) ?? 0) === 0)
    .map((node) => node.id)
  const order: string[] = []

  while (queue.length > 0) {
    const nodeId = queue.shift()

    if (!nodeId) {
      continue
    }

    order.push(nodeId)

    for (const next of adjacency.get(nodeId) ?? []) {
      const nextInDegree = (inDegree.get(next) ?? 0) - 1
      inDegree.set(next, nextInDegree)

      if (nextInDegree === 0) {
        queue.push(next)
      }
    }
  }

  if (order.length === graph.nodes.length) {
    return order
  }

  const remaining = graph.nodes
    .map((node) => node.id)
    .filter((nodeId) => !order.includes(nodeId))

  return [...order, ...remaining]
}

function buildAdjacency(graph: GraphDocument): Map<string, string[]> {
  const adjacency = new Map<string, string[]>()

  for (const node of graph.nodes) {
    adjacency.set(node.id, [])
  }

  for (const edge of graph.edges) {
    adjacency.set(edge.from.nodeId, [...(adjacency.get(edge.from.nodeId) ?? []), edge.to.nodeId])
  }

  return adjacency
}

