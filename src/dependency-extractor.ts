import { ASTNode } from './types';
import { Parser } from './parser';

export class DependencyExtractor {
  private parser: Parser;

  constructor() {
    this.parser = new Parser();
  }

  /**
   * Extract all variable dependencies from an expression string
   * Returns a set of variable names (without the $ or @ prefix)
   */
  extract(expression: string): Set<string> {
    const ast = this.parser.parse(expression);
    return this.extractFromNode(ast);
  }

  /**
   * Extract dependencies from an AST node
   */
  extractFromNode(node: ASTNode): Set<string> {
    const dependencies = new Set<string>();
    this.visit(node, dependencies);
    return dependencies;
  }

  private visit(node: ASTNode, dependencies: Set<string>): void {
    switch (node.type) {
      case 'VariableReference':
        // Only extract $ prefixed variables (not @ context variables)
        // Context variables are considered external and don't form part of the dependency graph
        if (node.prefix === '$') {
          dependencies.add(node.name);
        }
        break;

      case 'BinaryOperation':
        this.visit(node.left, dependencies);
        this.visit(node.right, dependencies);
        break;

      case 'UnaryOperation':
        this.visit(node.operand, dependencies);
        break;

      case 'ConditionalExpression':
        this.visit(node.condition, dependencies);
        this.visit(node.consequent, dependencies);
        this.visit(node.alternate, dependencies);
        break;

      case 'FunctionCall':
        // Visit all function arguments
        for (const arg of node.arguments) {
          this.visit(arg, dependencies);
        }
        break;

      case 'MemberAccess':
        // For member access like $product.price, we want to extract 'product'
        // The root variable is what matters for dependency tracking
        this.visitMemberRoot(node.object, dependencies);
        break;

      case 'IndexAccess':
        // Similar to MemberAccess - extract the root variable
        this.visitMemberRoot(node.object, dependencies);
        // Also visit the index expression as it might contain variables
        this.visit(node.index, dependencies);
        break;

      case 'ArrayLiteral':
        for (const element of node.elements) {
          this.visit(element, dependencies);
        }
        break;

      case 'ObjectLiteral':
        for (const prop of node.properties) {
          this.visit(prop.value, dependencies);
        }
        break;

      // Literals don't have dependencies
      case 'DecimalLiteral':
      case 'NumberLiteral':
      case 'StringLiteral':
      case 'BooleanLiteral':
      case 'NullLiteral':
        break;
    }
  }

  /**
   * Visit the root of a member/index access chain
   * For $product.price.value, we want to extract 'product'
   */
  private visitMemberRoot(node: ASTNode, dependencies: Set<string>): void {
    switch (node.type) {
      case 'VariableReference':
        if (node.prefix === '$') {
          dependencies.add(node.name);
        }
        break;

      case 'MemberAccess':
        this.visitMemberRoot(node.object, dependencies);
        break;

      case 'IndexAccess':
        this.visitMemberRoot(node.object, dependencies);
        this.visit(node.index, dependencies);
        break;

      default:
        // For other node types (like function calls), visit normally
        this.visit(node, dependencies);
        break;
    }
  }
}
