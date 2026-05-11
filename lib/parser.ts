import type { ParsedEntry, EntryType } from '@/lib/types';

// Safe math evaluator — no eval(), only digits and operators
function safeEval(expr: string): number {
  // Allow digits, spaces, and basic operators
  if (!/^[\d\s+\-*/.()]+$/.test(expr)) throw new Error('Invalid expression');
  // Use Function constructor for safe evaluation scope
  // eslint-disable-next-line no-new-func
  const result = Function('"use strict"; return (' + expr + ')')();
  if (typeof result !== 'number' || !isFinite(result)) throw new Error('Invalid result');
  return result;
}

/**
 * Detects if the string is a math expression like:
 *   5000-1200-300
 *   1000+200-50
 *   5000*2
 * Must start with a digit and contain at least one operator after the first char.
 */
function isMathExpression(input: string): boolean {
  // Starts with digit, contains operators, no text
  return /^\d[\d\s+\-*/.()]+$/.test(input) && /[+\-*/(]/.test(input.slice(1));
}

/**
 * Parse a natural entry string into a structured entry.
 *
 * Supported formats:
 *   "+5000 salary"         → +5000, note: "salary"
 *   "-1200 ration"         → -1200, note: "ration"
 *   "5000-1200-300"        → evaluates to 3500
 *   "5000 salary"          → treated as income: +5000
 *   "-200"                 → -200, no note
 *   "+300"                 → +300, no note
 */
export function parseEntry(raw: string): ParsedEntry {
  const input = raw.trim();

  if (!input) {
    return { amount: 0, note: '', type: 'add', rawText: raw, isValid: false, error: 'Empty input' };
  }

  // --- Pattern 1: Math expression (no text, just numbers/operators) ---
  if (isMathExpression(input)) {
    try {
      const result = safeEval(input);
      return {
        amount: result,
        note: '',
        type: 'expression',
        rawText: raw,
        isValid: true,
      };
    } catch {
      // Fall through to other patterns
    }
  }

  // --- Pattern 2: Starts with + or - followed by number then optional note ---
  // e.g., "+5000 salary" or "-1200 ration food"
  const signedPattern = /^([+\-])(\d+(?:\.\d+)?)\s*(.*)?$/;
  const signedMatch = input.match(signedPattern);
  if (signedMatch) {
    const sign = signedMatch[1] === '+' ? 1 : -1;
    const amount = parseFloat(signedMatch[2]) * sign;
    const note = (signedMatch[3] || '').trim();
    const type: EntryType = sign === 1 ? 'add' : 'subtract';
    return { amount, note, type, rawText: raw, isValid: true };
  }

  // --- Pattern 3: Plain number followed by optional note ---
  // e.g., "5000 salary" → treated as income (+5000)
  const plainPattern = /^(\d+(?:\.\d+)?)\s+(.*)?$/;
  const plainMatch = input.match(plainPattern);
  if (plainMatch) {
    const amount = parseFloat(plainMatch[1]);
    const note = (plainMatch[2] || '').trim();
    return { amount, note, type: 'add', rawText: raw, isValid: true };
  }

  // --- Pattern 4: Just a number with no spaces ---
  const numOnlyPattern = /^(\d+(?:\.\d+)?)$/;
  const numOnly = input.match(numOnlyPattern);
  if (numOnly) {
    return {
      amount: parseFloat(numOnly[1]),
      note: '',
      type: 'add',
      rawText: raw,
      isValid: true,
    };
  }

  return {
    amount: 0,
    note: '',
    type: 'add',
    rawText: raw,
    isValid: false,
    error: 'Could not parse entry',
  };
}

/** Format amount for display, e.g. 5000 → "+₹5,000" or -1200 → "-₹1,200" */
export function formatAmount(amount: number, currency = '₹'): string {
  const abs = Math.abs(amount);
  const formatted = abs.toLocaleString('en-IN', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  });
  return `${amount >= 0 ? '+' : '-'}${currency}${formatted}`;
}

/** Format absolute amount, e.g. 5000 → "₹5,000" */
export function formatAmountAbs(amount: number, currency = '₹'): string {
  const abs = Math.abs(amount);
  return `${currency}${abs.toLocaleString('en-IN', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  })}`;
}

/** Calculate total from array of entry amounts */
export function calcTotal(amounts: number[]): number {
  return amounts.reduce((sum, a) => sum + a, 0);
}
