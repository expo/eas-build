// https://github.com/Sensative/jsep-eval/blob/master/src/jsep-eval.js

import assert from 'assert';

import get from 'lodash.get';
import jsep from 'jsep';

const binaryOperatorFunctions = {
  '===': (a: any, b: any) => a === b,
  '!==': (a: any, b: any) => a !== b,
  '==': (a: any, b: any) => a == b, // eslint-disable-line
  '!=': (a: any, b: any) => a != b, // eslint-disable-line
  '>': (a: any, b: any) => a > b,
  '<': (a: any, b: any) => a < b,
  '>=': (a: any, b: any) => a >= b,
  '<=': (a: any, b: any) => a <= b,
  '+': (a: any, b: any) => a + b,
  '-': (a: any, b: any) => a - b,
  '*': (a: any, b: any) => a * b,
  '/': (a: any, b: any) => a / b,
  '%': (a: any, b: any) => a % b, // remainder
  '**': (a: any, b: any) => a ** b, // exponentiation
  '&': (a: any, b: any) => a & b, // bitwise AND
  '|': (a: any, b: any) => a | b, // bitwise OR
  '^': (a: any, b: any) => a ^ b, // bitwise XOR
  '<<': (a: any, b: any) => a << b, // left shift
  '>>': (a: any, b: any) => a >> b, // sign-propagating right shift
  '>>>': (a: any, b: any) => a >>> b, // zero-fill right shift
  // Let's make a home for the logical operators here as well
  '||': (a: any, b: any) => a || b,
  '&&': (a: any, b: any) => a && b,
};
type BinaryOperator = keyof typeof binaryOperatorFunctions;

const unaryOperatorFunctions = {
  '!': (a: any) => !a,
  '~': (a: any) => ~a, // bitwise NOT
  '+': (a: any) => +a, // unary plus
  '-': (a: any) => -a, // unary negation
  '++': (a: any) => ++a, // increment
  '--': (a: any) => --a, // decrement
};
type UnaryOperator = keyof typeof unaryOperatorFunctions;

function isValid<T extends jsep.ExpressionType>(
  expression: jsep.Expression,
  types: T[]
): expression is jsep.CoreExpression & { type: T } {
  return types.includes(expression.type as T);
}

const getParameterPath = (
  node: jsep.Identifier | jsep.MemberExpression,
  context: Record<string, unknown>
): string => {
  // the easy case: 'IDENTIFIER's
  if (node.type === 'Identifier') {
    return node.name;
  }
  // Otherwise it's a MEMBER expression
  // EXAMPLES:  a[b] (computed)
  //            a.b (not computed)
  const computed = node.computed;
  const object = node.object;
  const property = node.property;

  // object is either 'IDENTIFIER', 'MEMBER', or 'THIS'
  assert(
    isValid(object, ['MemberExpression', 'Identifier', 'ThisExpression']),
    'Invalid object type'
  );
  assert(property, 'Member expression property is missing');

  let objectPath = '';
  if (object.type === 'ThisExpression') {
    objectPath = '';
  } else if (typeof node.name === 'string') {
    objectPath = node.name;
  } else {
    objectPath = getParameterPath(object, context);
  }

  if (computed) {
    // if computed -> evaluate anew
    const propertyPath = evaluateExpressionNode(property, context);
    return objectPath + '[' + propertyPath + ']';
  } else {
    assert(isValid(property, ['MemberExpression', 'Identifier']), 'Invalid object type');
    const propertyPath = property.name ?? getParameterPath(property, context);
    return (objectPath ? objectPath + '.' : '') + propertyPath;
  }
};

const evaluateExpressionNode = (node: jsep.Expression, context: Record<string, unknown>): any => {
  switch (node.type as jsep.ExpressionType) {
    case 'Literal': {
      return (node as jsep.Literal).value;
    }
    case 'ThisExpression': {
      return context;
    }
    case 'Compound': {
      const compoundNode = node as jsep.Compound;
      const expressions = compoundNode.body.map((el) => evaluateExpressionNode(el, context));
      return expressions.pop();
    }
    case 'UnaryExpression': {
      const unaryNode = node as jsep.UnaryExpression;
      if (!(unaryNode.operator in unaryOperatorFunctions)) {
        throw new Error(`Unsupported unary operator: ${unaryNode.operator}`);
      }
      const operatorFn = unaryOperatorFunctions[unaryNode.operator as UnaryOperator];
      const argument = evaluateExpressionNode(unaryNode.argument, context);
      return operatorFn(argument);
    }
    case 'BinaryExpression': {
      const binaryNode = node as jsep.BinaryExpression;
      if (!(binaryNode.operator in binaryOperatorFunctions)) {
        throw new Error(`Unsupported binary operator: ${binaryNode.operator}`);
      }
      const operator = binaryOperatorFunctions[binaryNode.operator as BinaryOperator];
      const left = evaluateExpressionNode(binaryNode.left, context);
      const right = evaluateExpressionNode(binaryNode.right, context);
      return operator(left, right);
    }
    case 'ConditionalExpression': {
      const conditionalNode = node as jsep.ConditionalExpression;
      const test = evaluateExpressionNode(conditionalNode.test, context);
      const consequent = evaluateExpressionNode(conditionalNode.consequent, context);
      const alternate = evaluateExpressionNode(conditionalNode.alternate, context);
      return test ? consequent : alternate;
    }
    case 'CallExpression': {
      const allowedCalleeTypes: jsep.ExpressionType[] = [
        'MemberExpression',
        'Identifier',
        'ThisExpression',
      ];
      const callNode = node as jsep.CallExpression;
      if (!allowedCalleeTypes.includes(callNode.callee.type as jsep.ExpressionType)) {
        throw new Error(
          `Invalid function callee type: ${
            callNode.callee.type
          }. Expected one of ${allowedCalleeTypes.join(', ')}.`
        );
      }
      const callee = evaluateExpressionNode(callNode.callee, context);
      const args = callNode.arguments.map((arg) => evaluateExpressionNode(arg, context));
      // eslint-disable-next-line prefer-spread
      return callee.apply(null, args);
    }
    case 'Identifier': // !!! fall-through to MEMBER !!! //
    case 'MemberExpression': {
      const path = getParameterPath(node as jsep.Identifier | jsep.MemberExpression, context);
      return get(context, path);
    }
    case 'ArrayExpression': {
      const elements = (node as jsep.ArrayExpression).elements.map((el) =>
        evaluateExpressionNode(el, context)
      );
      return elements;
    }
    default:
      throw new Error(`Unsupported expression type: ${node.type}`);
  }
};

export const jsepEval = (expression: string, context?: Record<string, unknown>): any => {
  const tree = jsep(expression);
  return evaluateExpressionNode(tree, context ?? {});
};
