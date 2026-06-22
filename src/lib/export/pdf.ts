// Client-side only — dynamically imported to avoid SSR

export type ExportConfig = {
  title: string;
  subtitle?: string;
  columns: string[];
  rows: string[][];
  filename: string;
};

export async function exportToPDF(config: ExportConfig): Promise<void> {
  const [{ default: jsPDF }, { default: autoTable }] = await Promise.all([
    import("jspdf"),
    import("jspdf-autotable"),
  ]);

  const isWide = config.columns.length > 6;
  const doc = new jsPDF({
    orientation: isWide ? "landscape" : "portrait",
    unit: "mm",
    format: "a4",
  });

  const pageWidth = doc.internal.pageSize.getWidth();

  // ── Header ──
  doc.setFontSize(7);
  doc.setTextColor(100, 116, 139);
  doc.text("MEDORA CLINIC OS", 14, 11);

  doc.setDrawColor(30, 64, 175);
  doc.setLineWidth(0.5);
  doc.line(14, 13, pageWidth - 14, 13);

  doc.setFontSize(16);
  doc.setTextColor(15, 23, 42);
  doc.setFont("helvetica", "bold");
  doc.text(config.title, 14, 22);

  let y = 27;
  if (config.subtitle) {
    doc.setFontSize(8);
    doc.setTextColor(100, 116, 139);
    doc.setFont("helvetica", "normal");
    doc.text(config.subtitle, 14, y);
    y += 5;
  }

  doc.setFontSize(7);
  doc.setTextColor(148, 163, 184);
  doc.setFont("helvetica", "normal");
  doc.text(
    `Generated: ${new Date().toLocaleString("en-US")}   |   Total records: ${config.rows.length}`,
    14,
    y + 2
  );

  // ── Table ──
  autoTable(doc, {
    head: [config.columns],
    body: config.rows,
    startY: y + 8,
    headStyles: {
      fillColor: [30, 64, 175],
      textColor: 255,
      fontSize: 8,
      fontStyle: "bold",
      cellPadding: 4,
    },
    bodyStyles: {
      fontSize: 8,
      cellPadding: 3,
      textColor: [30, 41, 59],
    },
    alternateRowStyles: {
      fillColor: [248, 250, 252],
    },
    tableLineColor: [226, 232, 240],
    tableLineWidth: 0.1,
    margin: { left: 14, right: 14 },
  });

  // ── Footer ──
  const pageCount = doc.getNumberOfPages();
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    doc.setFontSize(7);
    doc.setTextColor(148, 163, 184);
    doc.text(
      `Medora Clinic OS — Confidential — Page ${i} of ${pageCount}`,
      pageWidth / 2,
      doc.internal.pageSize.getHeight() - 8,
      { align: "center" }
    );
  }

  doc.save(`medora-${config.filename}-${today()}.pdf`);
}

export async function exportToExcel(config: ExportConfig): Promise<void> {
  const XLSX = await import("xlsx");

  const wsData = [config.columns, ...config.rows];
  const ws = XLSX.utils.aoa_to_sheet(wsData);

  // Auto-fit column widths
  const colWidths = config.columns.map((col, ci) => {
    const maxLen = Math.max(
      col.length,
      ...config.rows.map((row) => String(row[ci] ?? "").length)
    );
    return { wch: Math.min(maxLen + 2, 40) };
  });
  ws["!cols"] = colWidths;

  const wb = XLSX.utils.book_new();
  const sheetName = config.title.slice(0, 31);
  XLSX.utils.book_append_sheet(wb, ws, sheetName);
  XLSX.writeFile(wb, `medora-${config.filename}-${today()}.xlsx`);
}

export function exportToCSV(config: ExportConfig): void {
  const escape = (val: string): string => {
    const s = String(val ?? "");
    return s.includes(",") || s.includes('"') || s.includes("\n")
      ? `"${s.replace(/"/g, '""')}"`
      : s;
  };

  const lines = [
    config.columns.map(escape).join(","),
    ...config.rows.map((row) => row.map(escape).join(",")),
  ].join("\r\n");

  const blob = new Blob(["﻿" + lines], { type: "text/csv;charset=utf-8;" });
  const url  = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href     = url;
  link.download = `medora-${config.filename}-${today()}.csv`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

export function printReport(config: ExportConfig): void {
  const win = window.open("", "_blank", "width=1100,height=750");
  if (!win) {
    alert("Please allow pop-ups to use the print feature.");
    return;
  }

  const tableRows = config.rows
    .map((row) => `<tr>${row.map((cell) => `<td>${cell}</td>`).join("")}</tr>`)
    .join("");

  win.document.write(`<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <title>${config.title} — Medora</title>
  <style>
    *{box-sizing:border-box;margin:0;padding:0}
    body{font-family:Arial,sans-serif;font-size:11px;color:#1e293b;padding:28px;background:#fff}
    .hdr{border-bottom:2px solid #1e40af;padding-bottom:10px;margin-bottom:14px}
    .brand{font-size:9px;font-weight:700;color:#1e40af;letter-spacing:.12em;text-transform:uppercase;margin-bottom:4px}
    h1{font-size:19px;font-weight:700;color:#0f172a}
    .sub{font-size:9px;color:#64748b;margin-top:3px}
    .meta{font-size:9px;color:#94a3b8;margin-top:4px}
    table{width:100%;border-collapse:collapse;margin-top:10px;font-size:10px}
    th{background:#1e40af;color:#fff;font-weight:700;padding:6px 8px;text-align:left;white-space:nowrap}
    td{border-bottom:1px solid #e2e8f0;padding:5px 8px;vertical-align:top}
    tr:nth-child(even) td{background:#f8fafc}
    .footer{margin-top:14px;font-size:8px;color:#94a3b8;text-align:center;border-top:1px solid #e2e8f0;padding-top:8px}
    @media print{@page{size:landscape;margin:1.5cm}body{padding:0}}
  </style>
</head>
<body>
  <div class="hdr">
    <div class="brand">Medora Clinic OS</div>
    <h1>${config.title}</h1>
    ${config.subtitle ? `<div class="sub">${config.subtitle}</div>` : ""}
    <div class="meta">Generated: ${new Date().toLocaleString("en-US")} &nbsp;|&nbsp; Total records: ${config.rows.length}</div>
  </div>
  <table>
    <thead><tr>${config.columns.map((c) => `<th>${c}</th>`).join("")}</tr></thead>
    <tbody>${tableRows}</tbody>
  </table>
  <div class="footer">Medora Clinic OS &mdash; Confidential &mdash; For authorized staff use only</div>
  <script>window.onload=function(){window.print();}</script>
</body>
</html>`);
  win.document.close();
}

function today(): string {
  return new Date().toISOString().split("T")[0];
}
