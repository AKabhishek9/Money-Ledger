import Papa from 'papaparse';
import type { Entry, PersonEntry } from '@/lib/types';
import { formatAmount } from '@/lib/parser';
import { formatDate } from '@/lib/utils';

export function exportWindowToCSV(
  windowTitle: string,
  entries: Entry[]
): void {
  const rows: { Date: string; Note: string; Amount: number; Type: string; 'Raw Text': string }[] =
    entries.map((e) => ({
      Date: formatDate(e.entryDate),
      Note: e.note || e.rawText,
      Amount: e.amount,
      Type: e.type,
      'Raw Text': e.rawText,
    }));

  const total = entries.reduce((sum, e) => sum + e.amount, 0);
  rows.push({
    Date: '',
    Note: 'TOTAL',
    Amount: total,
    Type: '',
    'Raw Text': '',
  });

  const csv = Papa.unparse(rows);
  downloadCSV(csv, `${windowTitle}.csv`);
}

export function exportPersonToCSV(personName: string, entries: PersonEntry[]): void {
  const rows = entries.map((e) => ({
    Date: formatDate(e.entryDate),
    Note: e.note || e.rawText,
    Amount: e.amount,
    Balance: '',
  }));

  const total = entries.reduce((sum, e) => sum + e.amount, 0);
  rows.push({ Date: '', Note: 'NET BALANCE', Amount: total, Balance: '' });

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
