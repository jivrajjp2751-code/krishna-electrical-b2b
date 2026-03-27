/**
 * CSV Export Utility
 * Converts arrays of objects to CSV and triggers download
 */

export function downloadCSV(data, filename) {
  if (!data || !data.length) return;
  
  const headers = Object.keys(data[0]);
  const csvRows = [
    headers.join(','),
    ...data.map(row =>
      headers.map(h => {
        let val = row[h] ?? '';
        val = String(val).replace(/"/g, '""');
        // Wrap in quotes if contains comma, newline, or quotes
        if (String(val).includes(',') || String(val).includes('\n') || String(val).includes('"')) {
          return `"${val}"`;
        }
        return val;
      }).join(',')
    )
  ];
  
  const csvString = csvRows.join('\n');
  const BOM = '\uFEFF'; // BOM for Excel to recognize UTF-8
  const blob = new Blob([BOM + csvString], { type: 'text/csv;charset=utf-8;' });
  
  const link = document.createElement('a');
  link.href = URL.createObjectURL(blob);
  link.download = `${filename}_${new Date().toISOString().split('T')[0]}.csv`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(link.href);
}

