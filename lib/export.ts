import Papa from 'papaparse';
import type { Entry, PersonEntry } from '@/lib/types';

import { formatDate } from '@/lib/utils';
import { computeRunningBalance } from '@/lib/entries';

export function exportWindowToCSV(
  windowTitle: string,
  entries: Entry[]
): void {
  const entriesWithBalance = computeRunningBalance(entries);
  const rows: { Date: string; Note: string; Amount: number; Balance: number | string; Type: string; 'Raw Text': string }[] =
    entriesWithBalance.map((e) => ({
      Date: formatDate(e.entryDate),
      Note: e.note || e.rawText,
      Amount: e.amount,
      Balance: e.runningBalance,
      Type: e.type,
      'Raw Text': e.rawText,
    }));

  const total = entries.reduce((sum, e) => sum + e.amount, 0);
  rows.push({
    Date: '',
    Note: 'TOTAL',
    Amount: total,
    Balance: total,
    Type: '',
    'Raw Text': '',
  });

  const csv = Papa.unparse(rows);
  downloadCSV(csv, `${windowTitle}.csv`);
}

export function exportPersonToCSV(personName: string, entries: PersonEntry[]): void {
  const entriesWithBalance = computeRunningBalance(entries);
  const rows: { Date: string; Note: string; Amount: number; Balance: number | string }[] = entriesWithBalance.map((e) => ({
    Date: formatDate(e.entryDate),
    Note: e.note || e.rawText,
    Amount: e.amount,
    Balance: e.runningBalance,
  }));

  const total = entries.reduce((sum, e) => sum + e.amount, 0);
  rows.push({ Date: '', Note: 'NET BALANCE', Amount: total, Balance: total });

  const csv = Papa.unparse(rows);
  downloadCSV(csv, `${personName}-ledger.csv`);
}

function downloadCSV(content: string, filename: string): void {
  const blob = new Blob([content], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}
