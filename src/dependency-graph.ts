import { DependencyGraph as IDependencyGraph, FormulaDefinition } from './types';
import { DependencyExtractor } from './dependency-extractor';
import { CircularDependencyError } from './errors';

export class DependencyGraph implements IDependencyGraph {
  nodes: Set<string>;
  edges: Map<string, Set<string>>;

  constructor() {
    this.nodes = new Set();
    this.edges = new Map();
  }

  /**
   * Add a node to the graph
   */
  addNode(id: string): void {
    this.nodes.add(id);
    if (!this.edges.has(id)) {
      this.edges.set(id, new Set());
    }
  }

  /**
   * Add an edge from source to target (source depends on target)
   */
  addEdge(source: string, target: string): void {
    this.addNode(source);
    this.addNode(target);
    this.edges.get(source)!.add(target);
  }

  /**
   * Check if the graph has any cycles
   */
  hasCycles(): boolean {
    try {
      this.topologicalSort();
      return false;
    } catch (error) {
      return error instanceof CircularDependencyError;
    }
  }

  /**
   * Get all root nodes (nodes with no dependencies)
   */
  getRoots(): Set<string> {
    const roots = new Set<string>();
    for (const node of this.nodes) {
      const deps = this.edges.get(node) || new Set();
      if (deps.size === 0) {
        roots.add(node);
      }
    }
    return roots;
  }

  /**
   * Get all nodes that depend on the given node
   */
  getDependents(nodeId: string): Set<string> {
    const dependents = new Set<string>();
    for (const [node, deps] of this.edges) {
      if (deps.has(nodeId)) {
        dependents.add(node);
      }
    }
    return dependents;
  }

  /**
   * Get direct dependencies of a node
   */
  getDependencies(nodeId: string): Set<string> {
    return this.edges.get(nodeId) || new Set();
  }

  /**
   * Get all transitive dependencies of a node
   */
  getTransitiveDependencies(nodeId: string): Set<string> {
    const visited = new Set<string>();
    const result = new Set<string>();
    this.collectTransitiveDependencies(nodeId, visited, result);
    result.delete(nodeId); // Don't include the node itself
    return result;
  }

  private collectTransitiveDependencies(
    nodeId: string,
    visited: Set<string>,
    result: Set<string>
  ): void {
    if (visited.has(nodeId)) {
      return;
    }
    visited.add(nodeId);

    const deps = this.edges.get(nodeId);
    if (deps) {
      for (const dep of deps) {
        result.add(dep);
        this.collectTransitiveDependencies(dep, visited, result);
      }
    }
  }

  /**
   * Perform topological sort using Kahn's algorithm
   * Returns nodes in evaluation order (dependencies first)
   * Throws CircularDependencyError if a cycle is detected
   */
  topologicalSort(): string[] {
    // Calculate in-degree for each node
    const inDegree = new Map<string, number>();
    for (const node of this.nodes) {
      inDegree.set(node, 0);
    }

    // Count incoming edges for each node
    for (const [, deps] of this.edges) {
      for (const dep of deps) {
        if (this.nodes.has(dep)) {
          // We need to count how many nodes depend on this one
          // This is actually reverse - we need dependents, not dependencies
        }
      }
    }

    // Actually, we need to build a reverse graph for proper topological sort
    // edges: node -> dependencies means we need to evaluate dependencies first
    // So the "in-degree" should count how many times a node is depended upon

    const dependents = new Map<string, Set<string>>();
    for (const node of this.nodes) {
      dependents.set(node, new Set());
    }

    for (const [node, deps] of this.edges) {
      for (const dep of deps) {
        if (dependents.has(dep)) {
          dependents.get(dep)!.add(node);
        }
      }
    }

    // Calculate in-degree (number of dependencies)
    for (const [node, deps] of this.edges) {
      // Only count dependencies that are actual nodes in our graph
      const validDeps = [...deps].filter(d => this.nodes.has(d));
      inDegree.set(node, validDeps.length);
    }

    // Start with nodes that have no dependencies
    const queue: string[] = [];
    for (const [node, degree] of inDegree) {
      if (degree === 0) {
        queue.push(node);
      }
    }

    const result: string[] = [];
    const visited = new Set<string>();

    while (queue.length > 0) {
      const node = queue.shift()!;
      if (visited.has(node)) continue;

      visited.add(node);
      result.push(node);

      // For each node that depends on this one, decrease its in-degree
      const deps = dependents.get(node) || new Set();
      for (const dependent of deps) {
        const newDegree = (inDegree.get(dependent) || 0) - 1;
        inDegree.set(dependent, newDegree);
        if (newDegree === 0 && !visited.has(dependent)) {
          queue.push(dependent);
        }
      }
    }

    // Check if all nodes were visited
    if (result.length !== this.nodes.size) {
      // There's a cycle - find it
      const cycle = this.findCycle();
      throw new CircularDependencyError(cycle, [...this.nodes].filter(n => !visited.has(n)));
    }

    return result;
  }

  /**
   * Find a cycle in the graph using DFS
   */
  private findCycle(): string[] {
    const visited = new Set<string>();
    const recursionStack = new Set<string>();
    const path: string[] = [];

    const dfs = (node: string): string[] | null => {
      visited.add(node);
      recursionStack.add(node);
      path.push(node);

      const deps = this.edges.get(node) || new Set();
      for (const dep of deps) {
        if (!this.nodes.has(dep)) continue;

        if (!visited.has(dep)) {
          const cycle = dfs(dep);
          if (cycle) return cycle;
        } else if (recursionStack.has(dep)) {
          // Found a cycle - extract it from the path
          const cycleStart = path.indexOf(dep);
          const cycle = path.slice(cycleStart);
          cycle.push(dep); // Close the cycle
          return cycle;
        }
      }

      path.pop();
      recursionStack.delete(node);
      return null;
    };

    for (const node of this.nodes) {
      if (!visited.has(node)) {
        const cycle = dfs(node);
        if (cycle) return cycle;
      }
    }

    return [];
  }
}

/**
 * Build a dependency graph from formula definitions
 */
export class DependencyGraphBuilder {
  private extractor: DependencyExtractor;

  constructor() {
    this.extractor = new DependencyExtractor();
  }

  /**
   * Build a dependency graph from formula definitions
   */
  build(formulas: FormulaDefinition[]): DependencyGraph {
    const graph = new DependencyGraph();

    // Create a map of formula IDs for quick lookup
    const formulaIds = new Set(formulas.map(f => f.id));

    // Add all formula IDs as nodes
    for (const formula of formulas) {
      graph.addNode(formula.id);
    }

    // Extract dependencies and add edges
    for (const formula of formulas) {
      const deps = formula.dependencies
        ? new Set(formula.dependencies)
        : this.extractor.extract(formula.expression);

      for (const dep of deps) {
        // Only add edges for dependencies that are other formulas
        // (not external variables)
        if (formulaIds.has(dep)) {
          graph.addEdge(formula.id, dep);
        }
      }
    }

    return graph;
  }

  /**
   * Get the evaluation order for a set of formulas
   */
  getEvaluationOrder(formulas: FormulaDefinition[]): string[] {
    const graph = this.build(formulas);
    return graph.topologicalSort();
  }
}
