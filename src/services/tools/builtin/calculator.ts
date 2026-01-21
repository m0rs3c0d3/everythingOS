// ═══════════════════════════════════════════════════════════════════════════════
// EVERYTHINGOS - Calculator Tool
// Safe math expression evaluation
// ═══════════════════════════════════════════════════════════════════════════════

import { Tool, ToolResult } from '../ToolTypes';

/**
 * Safe math evaluator - no eval(), no code injection
 */
function safeEvaluate(expression: string): number {
  // Remove whitespace
  const expr = expression.replace(/\s+/g, '');
  
  // Validate characters (only allow digits, operators, parentheses, decimal point)
  if (!/^[\d+\-*/().%^]+$/.test(expr)) {
    throw new Error('Invalid characters in expression');
  }
  
  // Simple recursive descent parser
  let pos = 0;
  
  function parseExpression(): number {
    let result = parseTerm();
    
    while (pos < expr.length) {
      if (expr[pos] === '+') {
        pos++;
        result += parseTerm();
      } else if (expr[pos] === '-') {
        pos++;
        result -= parseTerm();
      } else {
        break;
      }
    }
    
    return result;
  }
  
  function parseTerm(): number {
    let result = parseFactor();
    
    while (pos < expr.length) {
      if (expr[pos] === '*') {
        pos++;
        result *= parseFactor();
      } else if (expr[pos] === '/') {
        pos++;
        const divisor = parseFactor();
        if (divisor === 0) throw new Error('Division by zero');
        result /= divisor;
      } else if (expr[pos] === '%') {
        pos++;
        result %= parseFactor();
      } else if (expr[pos] === '^') {
        pos++;
        result = Math.pow(result, parseFactor());
      } else {
        break;
      }
    }
    
    return result;
  }
  
  function parseFactor(): number {
    // Handle negative numbers
    if (expr[pos] === '-') {
      pos++;
      return -parseFactor();
    }
    
    // Handle parentheses
    if (expr[pos] === '(') {
      pos++;
      const result = parseExpression();
      if (expr[pos] !== ')') throw new Error('Missing closing parenthesis');
      pos++;
      return result;
    }
    
    // Parse number
    const start = pos;
    while (pos < expr.length && /[\d.]/.test(expr[pos])) {
      pos++;
    }
    
    if (start === pos) throw new Error('Expected number');
    
    const num = parseFloat(expr.slice(start, pos));
    if (isNaN(num)) throw new Error('Invalid number');
    
    return num;
  }
  
  const result = parseExpression();
  
  if (pos < expr.length) {
    throw new Error(`Unexpected character at position ${pos}`);
  }
  
  return result;
}

export const calculatorTool: Tool = {
  name: 'calculator',
  version: '1.0.0',
  description: 'Evaluate mathematical expressions. Supports +, -, *, /, %, ^ (power), and parentheses.',
  category: 'math',
  trustLevel: 'safe',
  
  inputSchema: {
    type: 'object',
    properties: {
      expression: {
        type: 'string',
        description: 'Mathematical expression to evaluate (e.g., "2 + 2", "15% of 84.50" as "84.50 * 0.15")',
      },
    },
    required: ['expression'],
  },
  
  outputSchema: {
    type: 'object',
    properties: {
      result: { type: 'number', description: 'The calculated result' },
      expression: { type: 'string', description: 'The original expression' },
    },
  },
  
  examples: [
    { description: 'Simple addition', input: { expression: '2 + 2' }, output: { result: 4 } },
    { description: 'Percentage', input: { expression: '84.50 * 0.15' }, output: { result: 12.675 } },
    { description: 'Complex expression', input: { expression: '(10 + 5) * 2 / 3' }, output: { result: 10 } },
  ],
  
  handler: async (input, context): Promise<ToolResult> => {
    const { expression } = input as { expression: string };
    
    try {
      const result = safeEvaluate(expression);
      
      // Round to reasonable precision
      const rounded = Math.round(result * 1e10) / 1e10;
      
      context.log('info', `Calculated: ${expression} = ${rounded}`);
      
      return {
        success: true,
        data: {
          result: rounded,
          expression,
        },
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Calculation failed',
      };
    }
  },
};
