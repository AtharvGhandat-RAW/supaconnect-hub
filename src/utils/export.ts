import { Capacitor } from '@capacitor/core';
import { Filesystem, Directory, Encoding } from '@capacitor/filesystem';
import { Share } from '@capacitor/share';

// Export utilities for CSV/XLSX and PDF generation

export async function downloadCSV<T extends object>(data: T[], filename: string, columns?: { key: string; header: string }[]) {
  if (data.length === 0) return;

  const headers = columns ? columns.map(c => c.header) : Object.keys(data[0]);
  const keys = columns ? columns.map(c => c.key) : Object.keys(data[0]);

  const csvContent = [
    headers.join(','),
    ...data.map(row =>
      keys.map(key => {
        // @ts-ignore
        const value = row[key];
        if (value === null || value === undefined) return '';
        const str = String(value);
        // Escape quotes and wrap in quotes if contains comma
        if (str.includes(',') || str.includes('"') || str.includes('\n')) {
          return `"${str.replace(/"/g, '""')}"`;
        }
        return str;
      }).join(',')
    )
  ].join('\n');

  if (Capacitor.isNativePlatform()) {
    try {
      const fileNameStr = `${filename}.csv`;
      const result = await Filesystem.writeFile({
        path: fileNameStr,
        data: csvContent,
        directory: Directory.Cache,
        encoding: Encoding.UTF8,
      });

      await Share.share({
        title: filename,
        text: `Exported CSV: ${filename}`,
        url: result.uri,
        dialogTitle: 'Share CSV',
      });
    } catch (e) {
      console.error('Mobile export failed', e);
      // Fallback
    }
  } else {
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `${filename}.csv`;
    link.click();
    URL.revokeObjectURL(link.href);
  }
}

export function generatePDFContent(options: {
  title: string;
  subtitle?: string;
  date?: string;
  logoSrc?: string;
  headers: string[];
  rows: string[][];
  footer?: string;
}): string {
  const { title, subtitle, date, logoSrc, headers, rows, footer } = options;

  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <title>${title}</title>
      <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body {
          font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
          padding: 20px;
          color: #1a1a2e;
        }
        .header {
          display: flex;
          align-items: center;
          gap: 16px;
          border-bottom: 2px solid #4F46E5;
          padding-bottom: 12px;
          margin-bottom: 20px;
        }
        .header img {
          width: 48px;
          height: 48px;
          border-radius: 50%;
          object-fit: cover;
        }
        .header-text h1 {
          font-size: 18px;
          color: #1E1B4B;
          margin-bottom: 4px;
        }
        .header-text p {
          font-size: 12px;
          color: #6b7280;
        }
        .meta {
          display: flex;
          justify-content: space-between;
          margin-bottom: 16px;
          font-size: 12px;
          color: #374151;
        }
        table {
          width: 100%;
          border-collapse: collapse;
          margin-bottom: 20px;
        }
        th, td {
          border: 1px solid #e5e7eb;
          padding: 8px 12px;
          text-align: left;
          font-size: 11px;
        }
        th {
          background: #4F46E5;
          color: white;
          font-weight: 600;
        }
        tr:nth-child(even) {
          background: #f9fafb;
        }
        .footer {
          margin-top: 30px;
          padding-top: 15px;
          border-top: 1px solid #e5e7eb;
          font-size: 10px;
          color: #6b7280;
          text-align: center;
        }
        @media print {
          body { padding: 10px; }
          .no-print { display: none; }
        }
      </style>
    </head>
    <body>
      <div class="header">
        ${logoSrc ? `<img src="${logoSrc}" alt="Logo">` : ''}
        <div class="header-text">
          <h1>${title}</h1>
          ${subtitle ? `<p>${subtitle}</p>` : ''}
        </div>
      </div>
      <div class="meta">
        <div>${date || new Date().toLocaleDateString()}</div>
      </div>
      <table>
        <thead>
          <tr>
            ${headers.map(h => `<th>${h}</th>`).join('')}
          </tr>
        </thead>
        <tbody>
          ${rows.map(row => `<tr>${row.map(cell => `<td>${cell}</td>`).join('')}</tr>`).join('')}
        </tbody>
      </table>
      ${footer ? `<div class="footer">${footer}</div>` : ''}
      <div class="footer">
        Generated on ${new Date().toLocaleString()} • RIT Polytechnic AIML Department
      </div>
    </body>
    </html>
  `;
}

export async function printPDF(htmlContent: string, title: string = 'Report') {
  if (Capacitor.isNativePlatform()) {
    try {
      const fileNameStr = `${title.replace(/[^a-z0-9]/gi, '_').toLowerCase()}.html`;
      const result = await Filesystem.writeFile({
        path: fileNameStr,
        data: htmlContent,
        directory: Directory.Cache,
        encoding: Encoding.UTF8,
      });

      await Share.share({
        title: title,
        text: `Usage Report: ${title}`,
        url: result.uri,
        dialogTitle: 'Share Report',
      });
    } catch (e) {
      console.error('Mobile report share failed', e);
    }
  } else {
    const printWindow = window.open('', '_blank');
    if (printWindow) {
      printWindow.document.write(htmlContent);
      printWindow.document.close();
      printWindow.onload = () => {
        printWindow.print();
      };
    }
  }
}

export function downloadPDF(htmlContent: string, filename: string) {
  // Reuse printPDF logic for mobile consistency if needed
  if (Capacitor.isNativePlatform()) {
      printPDF(htmlContent, filename);
  } else {
    const printWindow = window.open('', '_blank');
    if (printWindow) {
      printWindow.document.write(htmlContent);
      printWindow.document.close();
      printWindow.onload = () => {
        printWindow.print();
      };
    }
  }
}

// Template download for imports
export async function downloadTemplate(templateName: string) {
  const templates: Record<string, { headers: string[]; sample: string[][] }> = {
    students: {
      headers: ['name', 'enrollment_no', 'roll_no', 'year', 'semester', 'division', 'mobile', 'email'],
      sample: [
        ['John Doe', 'ENR2025001', '1', '3', '5', 'A', '9876543210', 'john@rit.edu'],
        ['Jane Smith', 'ENR2025002', '2', '3', '5', 'A', '9876543211', 'jane@rit.edu'],
        ['Alex Kumar', 'ENR2025003', '3', '3', '5', 'A', '9876543212', 'alex@rit.edu'],
      ],
    },
    faculty: {
      headers: ['name', 'email', 'mobile', 'department', 'designation', 'employee_code', 'is_hod'],
      sample: [
        ['Prof. John', 'prof.john@rit.edu', '9876543210', 'AIML', 'Assistant Professor', 'EMP001', 'false'],
      ],
    },
    subjects: {
      headers: ['subject_code', 'name', 'semester', 'year', 'department', 'type', 'weekly_lectures'],
      sample: [
        ['CS101', 'Introduction to Programming', '1', '1', 'AIML', 'TH', '4'],
      ],
    },
    timetable: {
      headers: ['faculty_email', 'day_of_week', 'start_time', 'end_time', 'class_name', 'division', 'subject_code', 'room_no', 'valid_from', 'valid_to', 'batch_name', 'year', 'semester'],
      sample: [
        ['faculty@rit.edu', 'Monday', '09:00', '10:00', 'TY AIML', 'A', 'CS101', '101', '2025-01-01', '2025-06-30', 'Batch A', '3', '5'],
      ],
    },
  };

  const template = templates[templateName];
  if (!template) return;

  const csvContent = [
    template.headers.join(','),
    ...template.sample.map(row => row.join(','))
  ].join('\n');

  if (Capacitor.isNativePlatform()) {
      try {
        const fileNameStr = `${templateName}_template.csv`;
        const result = await Filesystem.writeFile({
            path: fileNameStr,
            data: csvContent,
            directory: Directory.Cache,
            encoding: Encoding.UTF8,
        });
        await Share.share({
            title: templateName,
            text: `Template: ${templateName}`,
            url: result.uri,
            dialogTitle: 'Share Template'
        });
      } catch(e) { console.error(e); }
  } else {
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `${templateName}_template.csv`;
    link.click();
    URL.revokeObjectURL(link.href);
  }
}
