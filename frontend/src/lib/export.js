import * as XLSX from '@e965/xlsx';

export async function exportXlsx(filename, sheetName, rows) {
  const sheet = XLSX.utils.json_to_sheet(rows);
  const book = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(book, sheet, sheetName);
  XLSX.writeFile(book, filename);
}

export async function exportPdf(title, headers, rows, filename) {
  const { jsPDF } = await import('jspdf');
  const pdf = new jsPDF({ orientation: 'landscape' });
  pdf.setFontSize(16);
  pdf.text(title, 14, 16);
  pdf.setFontSize(9);
  const widths = headers.map(() => 265 / headers.length);
  let y = 27;

  const drawRow = (values, bold = false) => {
    let x = 14;
    pdf.setFont('helvetica', bold ? 'bold' : 'normal');
    values.forEach((value, index) => {
      const text = pdf.splitTextToSize(String(value ?? ''), widths[index] - 4);
      pdf.text(text, x + 2, y + 5);
      x += widths[index];
    });
    y += Math.max(9, ...values.map((value, index) => (
      pdf.splitTextToSize(String(value ?? ''), widths[index] - 4).length * 4
    )));
    if (y > 185) {
      pdf.addPage();
      y = 15;
    }
  };

  drawRow(headers, true);
  rows.forEach((row) => drawRow(row));
  pdf.save(filename);
}
