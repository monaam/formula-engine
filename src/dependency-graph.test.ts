import { DependencyGraph, DependencyGraphBuilder } from './dependency-graph';
import { DependencyExtractor } from './dependency-extractor';
import { CircularDependencyError } from './errors';

describe('DependencyExtractor', () => {
  let extractor: DependencyExtractor;

  beforeEach(() => {
    extractor = new DependencyExtractor();
  });

  it('should extract simple variable references', () => {
    const deps = extractor.extract('$a + $b');

    expect(deps).toEqual(new Set(['a', 'b']));
  });

  it('should not extract context variables', () => {
    const deps = extractor.extract('$a + @userId');

    expect(deps).toEqual(new Set(['a']));
  });

  it('should extract variables from function arguments', () => {
    const deps = extractor.extract('MAX($a, $b)');

    expect(deps).toEqual(new Set(['a', 'b']));
  });

  it('should extract root of member access', () => {
    const deps = extractor.extract('$product.price');

    expect(deps).toEqual(new Set(['product']));
  });

  it('should extract root of index access', () => {
    const deps = extractor.extract('$items[0].price');

    expect(deps).toEqual(new Set(['items']));
  });

  it('should extract variables from conditionals', () => {
    const deps = extractor.extract('$a > 0 ? $b : $c');

    expect(deps).toEqual(new Set(['a', 'b', 'c']));
  });

  it('should extract variables from nested expressions', () => {
    const deps = extractor.extract('($a + $b) * ($c - $d)');

    expect(deps).toEqual(new Set(['a', 'b', 'c', 'd']));
  });

  it('should not duplicate variables', () => {
    const deps = extractor.extract('$a + $a + $a');

    expect(deps).toEqual(new Set(['a']));
    expect(deps.size).toBe(1);
  });

  it('should extract dependencies from object literal values', () => {
    const deps = extractor.extract('LOOKUP($table, { region: $region, zone: $zone }, "rate")');

    expect(deps).toEqual(new Set(['table', 'region', 'zone']));
  });

  it('should not extract dependencies from object with only literals', () => {
    const deps = extractor.extract('{ a: 1, b: "x" }');

    expect(deps).toEqual(new Set());
  });

  it('should extract dependencies from nested object literals', () => {
    const deps = extractor.extract('{ inner: { val: $x } }');

    expect(deps).toEqual(new Set(['x']));
  });

  it('should extract dependencies from object literal with expressions', () => {
    const deps = extractor.extract('{ total: $a + $b, name: "test" }');

    expect(deps).toEqual(new Set(['a', 'b']));
  });
});

describe('DependencyGraph', () => {
  let graph: DependencyGraph;

  beforeEach(() => {
    graph = new DependencyGraph();
  });

  it('should add nodes', () => {
    graph.addNode('a');
    graph.addNode('b');

    expect(graph.nodes.has('a')).toBe(true);
    expect(graph.nodes.has('b')).toBe(true);
  });

  it('should add edges', () => {
    graph.addEdge('a', 'b'); // a depends on b

    expect(graph.getDependencies('a').has('b')).toBe(true);
  });

  it('should find root nodes', () => {
    graph.addEdge('a', 'b');
    graph.addEdge('b', 'c');
    graph.addNode('c');

    const roots = graph.getRoots();

    expect(roots).toEqual(new Set(['c']));
  });

  it('should find dependents', () => {
    graph.addEdge('a', 'b');
    graph.addEdge('c', 'b');

    const dependents = graph.getDependents('b');

    expect(dependents).toEqual(new Set(['a', 'c']));
  });

  it('should find transitive dependencies', () => {
    graph.addEdge('a', 'b');
    graph.addEdge('b', 'c');
    graph.addEdge('c', 'd');

    const deps = graph.getTransitiveDependencies('a');

    expect(deps).toEqual(new Set(['b', 'c', 'd']));
  });

  it('should detect cycles', () => {
    graph.addEdge('a', 'b');
    graph.addEdge('b', 'c');
    graph.addEdge('c', 'a');

    expect(graph.hasCycles()).toBe(true);
  });

  it('should not detect cycles when none exist', () => {
    graph.addEdge('a', 'b');
    graph.addEdge('b', 'c');
    graph.addNode('c');

    expect(graph.hasCycles()).toBe(false);
  });

  describe('Topological Sort', () => {
    it('should return nodes in dependency order', () => {
      graph.addEdge('total', 'net');
      graph.addEdge('total', 'tax');
      graph.addEdge('net', 'gross');
      graph.addEdge('net', 'discount');
      graph.addEdge('tax', 'net');
      graph.addEdge('discount', 'gross');
      graph.addNode('gross');

      const order = graph.topologicalSort();

      // gross should come before discount and net
      // net should come before tax and total
      // discount should come before net
      expect(order.indexOf('gross')).toBeLessThan(order.indexOf('discount'));
      expect(order.indexOf('gross')).toBeLessThan(order.indexOf('net'));
      expect(order.indexOf('discount')).toBeLessThan(order.indexOf('net'));
      expect(order.indexOf('net')).toBeLessThan(order.indexOf('tax'));
      expect(order.indexOf('net')).toBeLessThan(order.indexOf('total'));
      expect(order.indexOf('tax')).toBeLessThan(order.indexOf('total'));
    });

    it('should throw on circular dependency', () => {
      graph.addEdge('a', 'b');
      graph.addEdge('b', 'c');
      graph.addEdge('c', 'a');

      expect(() => graph.topologicalSort()).toThrow(CircularDependencyError);
    });

    it('should include cycle information in error', () => {
      graph.addEdge('a', 'b');
      graph.addEdge('b', 'c');
      graph.addEdge('c', 'a');

      try {
        graph.topologicalSort();
        fail('Expected error');
      } catch (error) {
        expect(error).toBeInstanceOf(CircularDependencyError);
        const circError = error as CircularDependencyError;
        expect(circError.cycle.length).toBeGreaterThan(0);
      }
    });
  });
});

describe('DependencyGraphBuilder', () => {
  let builder: DependencyGraphBuilder;

  beforeEach(() => {
    builder = new DependencyGraphBuilder();
  });

  it('should build graph from formulas', () => {
    const formulas = [
      { id: 'a', expression: '$b + $c' },
      { id: 'b', expression: '$c + 1' },
      { id: 'c', expression: '10' },
    ];

    const graph = builder.build(formulas);

    expect(graph.getDependencies('a')).toEqual(new Set(['b', 'c']));
    expect(graph.getDependencies('b')).toEqual(new Set(['c']));
    expect(graph.getDependencies('c')).toEqual(new Set());
  });

  it('should get evaluation order', () => {
    const formulas = [
      { id: 'total', expression: '$net + $tax' },
      { id: 'tax', expression: '$net * 0.2' },
      { id: 'net', expression: '$gross - $discount' },
      { id: 'discount', expression: '$gross * 0.1' },
      { id: 'gross', expression: '$price * $qty' },
    ];

    const order = builder.getEvaluationOrder(formulas);

    expect(order.indexOf('gross')).toBeLessThan(order.indexOf('discount'));
    expect(order.indexOf('gross')).toBeLessThan(order.indexOf('net'));
    expect(order.indexOf('discount')).toBeLessThan(order.indexOf('net'));
    expect(order.indexOf('net')).toBeLessThan(order.indexOf('tax'));
    expect(order.indexOf('net')).toBeLessThan(order.indexOf('total'));
  });

  it('should only include formula dependencies', () => {
    const formulas = [
      { id: 'total', expression: '$base + $external' }, // $external is not a formula
      { id: 'base', expression: '$price * $qty' }, // $price and $qty are external
    ];

    const graph = builder.build(formulas);

    // Only 'base' should be in dependencies of 'total', not 'external'
    expect(graph.getDependencies('total')).toEqual(new Set(['base']));
  });

  it('should use explicit dependencies if provided', () => {
    const formulas = [
      { id: 'a', expression: '$x + 1', dependencies: ['b', 'c'] },
      { id: 'b', expression: '2' },
      { id: 'c', expression: '3' },
    ];

    const graph = builder.build(formulas);

    expect(graph.getDependencies('a')).toEqual(new Set(['b', 'c']));
  });
});
