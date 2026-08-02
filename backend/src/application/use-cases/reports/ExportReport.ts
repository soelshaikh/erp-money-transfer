import PDFDocument from 'pdfkit';
import GetDailyReport from './GetDailyReport';
import GetPendingApprovalQueue from './GetPendingApprovalQueue';
import GetOutstandingPayments from './GetOutstandingPayments';
import GetRejectedTransactions from './GetRejectedTransactions';
import GetBranchCollectionReport from './GetBranchCollectionReport';
import GetBranchFlowMatrix from './GetBranchFlowMatrix';
import GetCashPosition from './GetCashPosition';
import GetStaffReport from './GetStaffReport';
import GetCommissionOverrideReport from './GetCommissionOverrideReport';
import GetPeriodComparison from './GetPeriodComparison';
import GetPaymentMethodReport from './GetPaymentMethodReport';

interface ExportResult {
  buffer: Buffer;
  contentType: string;
  filename: string;
}

export default class ExportReport {
  private transactionRepository: any;
  private branchRepository: any;
  private getDailyReport: GetDailyReport;
  private getPendingQueue: GetPendingApprovalQueue;
  private getOutstandingPayments: GetOutstandingPayments;
  private getRejectedTransactions: GetRejectedTransactions;
  private getBranchCollectionReport: GetBranchCollectionReport;
  private getBranchFlowMatrix: GetBranchFlowMatrix;
  private getCashPosition: GetCashPosition;
  private getStaffReport: GetStaffReport;
  private getCommissionOverrideReport: GetCommissionOverrideReport;
  private getPeriodComparison: GetPeriodComparison;
  private getPaymentMethodReport: GetPaymentMethodReport;

  constructor({
    transactionRepository,
    branchRepository,
    getDailyReportUC,
    getPendingQueueUC,
    getOutstandingPaymentsUC,
    getRejectedTransactionsUC,
    getBranchCollectionReportUC,
    getBranchFlowMatrixUC,
    getCashPositionUC,
    getStaffReportUC,
    getCommissionOverrideReportUC,
    getPeriodComparisonUC,
    getPaymentMethodReportUC,
  }: any) {
    this.transactionRepository = transactionRepository;
    this.branchRepository = branchRepository;
    this.getDailyReport = getDailyReportUC || new GetDailyReport({ transactionRepository });
    this.getPendingQueue = getPendingQueueUC || new GetPendingApprovalQueue({ transactionRepository });
    this.getOutstandingPayments = getOutstandingPaymentsUC || new GetOutstandingPayments({ transactionRepository });
    this.getRejectedTransactions = getRejectedTransactionsUC || new GetRejectedTransactions({ transactionRepository });
    this.getBranchCollectionReport = getBranchCollectionReportUC || new GetBranchCollectionReport({ transactionRepository });
    this.getBranchFlowMatrix = getBranchFlowMatrixUC || new GetBranchFlowMatrix({ transactionRepository });
    this.getCashPosition = getCashPositionUC || new GetCashPosition({ branchRepository });
    this.getStaffReport = getStaffReportUC || new GetStaffReport({ transactionRepository });
    this.getCommissionOverrideReport = getCommissionOverrideReportUC || new GetCommissionOverrideReport({});
    this.getPeriodComparison = getPeriodComparisonUC || new GetPeriodComparison({ transactionRepository });
    this.getPaymentMethodReport = getPaymentMethodReportUC || new GetPaymentMethodReport({ transactionRepository });
  }

  async execute({
    tenantId,
    branchId,
    role,
    startDate,
    endDate,
    format = 'excel',
    reportType,
    date,
    period,
  }: any): Promise<ExportResult> {
    // If reportType is specified, delegate to type-specific export
    if (reportType) {
      const filters = { tenantId, branchId, role, fromDate: startDate, toDate: endDate, date, period };
      const data = await this._fetchReportData(reportType, filters);
      return this._buildExportForType(reportType, data, format, filters);
    }

    // Default: export raw transactions
    const filters: any = { limit: 10000 };
    if (branchId) filters.branchId = branchId;
    if (startDate) filters.fromDate = startDate;
    if (endDate) filters.toDate = endDate;

    const result = await this.transactionRepository.findAll(tenantId, filters);
    const transactions: any[] = result.data || result || [];

    if (format === 'csv') return this._buildCsv(transactions);
    if (format === 'pdf') return this._buildPdf(transactions);
    return this._buildExcel(transactions);
  }

  // -------------------------------------------------------------------------
  // Fetch data for a given reportType
  // -------------------------------------------------------------------------
  private async _fetchReportData(reportType: string, filters: any): Promise<any> {
    const { tenantId, branchId, role, fromDate, toDate, date, period } = filters;
    switch (reportType) {
      case 'daily':
        return this.getDailyReport.execute({ tenantId, role, branchId, fromDate, toDate });
      case 'pending-queue':
        return this.getPendingQueue.execute({ tenantId, role, branchId, limit: 5000 });
      case 'outstanding':
        return this.getOutstandingPayments.execute({ tenantId, role, branchId, limit: 5000 });
      case 'rejected':
        return this.getRejectedTransactions.execute({ tenantId, role, branchId, fromDate, toDate, limit: 5000 });
      case 'branch-collection':
        return this.getBranchCollectionReport.execute({ tenantId, fromDate, toDate });
      case 'branch-flow':
        return this.getBranchFlowMatrix.execute({ tenantId, fromDate, toDate });
      case 'cash-position':
        return this.getCashPosition.execute({ tenantId });
      case 'staff':
        return this.getStaffReport.execute({ tenantId, role, branchId, fromDate, toDate });
      case 'commission-overrides':
        return this.getCommissionOverrideReport.execute({ tenantId, fromDate, toDate, limit: 5000 });
      case 'period-comparison':
        return this.getPeriodComparison.execute({ tenantId, role, branchId, period });
      case 'payment-methods':
        return this.getPaymentMethodReport.execute({ tenantId, role, branchId, fromDate, toDate });
      default:
        throw new Error(`Unknown reportType: ${reportType}`);
    }
  }

  // -------------------------------------------------------------------------
  // Route to the right export builder for each report type
  // -------------------------------------------------------------------------
  private async _buildExportForType(reportType: string, data: any, format: string, filters: any): Promise<ExportResult> {
    switch (reportType) {
      case 'daily':
        return format === 'pdf'
          ? this._buildDailyReportPdf(data, filters)
          : format === 'csv'
          ? this._buildDailyReportCsv(data)
          : this._buildDailyReportExcel(data);

      case 'pending-queue':
      case 'outstanding':
      case 'rejected':
        return format === 'pdf'
          ? this._buildTransactionListPdf(data.data || [], reportType, filters)
          : format === 'csv'
          ? this._buildTransactionListCsv(data.data || [], reportType)
          : this._buildTransactionListExcel(data.data || [], reportType);

      case 'branch-collection':
        return format === 'pdf'
          ? this._buildBranchCollectionPdf(data, filters)
          : format === 'csv'
          ? this._buildBranchCollectionCsv(data)
          : this._buildBranchCollectionExcel(data);

      case 'branch-flow':
        return format === 'pdf'
          ? this._buildBranchFlowPdf(data, filters)
          : format === 'csv'
          ? this._buildBranchFlowCsv(data)
          : this._buildBranchFlowExcel(data);

      case 'cash-position':
        return format === 'pdf'
          ? this._buildCashPositionPdf(data, filters)
          : format === 'csv'
          ? this._buildCashPositionCsv(data)
          : this._buildCashPositionExcel(data);

      case 'staff':
        return format === 'pdf'
          ? this._buildStaffReportPdf(data, filters)
          : format === 'csv'
          ? this._buildStaffReportCsv(data)
          : this._buildStaffReportExcel(data);

      case 'commission-overrides':
        return format === 'pdf'
          ? this._buildCommissionOverridesPdf(data, filters)
          : format === 'csv'
          ? this._buildCommissionOverridesCsv(data)
          : this._buildCommissionOverridesExcel(data);

      case 'payment-methods':
        return format === 'pdf'
          ? this._buildPaymentMethodPdf(data, filters)
          : format === 'csv'
          ? this._buildPaymentMethodCsv(data)
          : this._buildPaymentMethodExcel(data);

      case 'period-comparison':
        return format === 'pdf'
          ? this._buildPeriodComparisonPdf(data)
          : format === 'csv'
          ? this._buildPeriodComparisonCsv(data)
          : this._buildPeriodComparisonExcel(data);

      default:
        throw new Error(`Export not supported for reportType: ${reportType}`);
    }
  }

  // =========================================================================
  // ORIGINAL transaction export helpers (preserved)
  // =========================================================================

  private _buildCsv(transactions: any[]): ExportResult {
    const header = [
      'Token', 'Date', 'Amount (₹)', 'Commission (₹)', 'Final Amount (₹)',
      'Approval', 'Payment', 'Collection Branch', 'Payout Branch',
    ];
    const rows = transactions.map((tx) => [
      tx.tokenNumber,
      new Date(tx.createdAt).toLocaleDateString('en-IN'),
      tx.amount,
      tx.commissionAmount,
      tx.finalAmount,
      tx.approvalStatus,
      tx.paymentStatus,
      tx.collectionBranchId?.name || '',
      tx.payoutBranchId?.name || '',
    ]);
    const csv = [header, ...rows]
      .map((row) => row.map((v) => `"${String(v ?? '').replace(/"/g, '""')}"`).join(','))
      .join('\n');
    const buffer = Buffer.from('﻿' + csv, 'utf-8');
    return { buffer, contentType: 'text/csv', filename: 'transactions.csv' };
  }

  private _buildPdf(transactions: any[]): Promise<ExportResult> {
    return new Promise<ExportResult>((resolve, reject) => {
      const doc = new PDFDocument({ margin: 40, size: 'A4', layout: 'landscape' });
      const chunks: Buffer[] = [];
      doc.on('data', (chunk: Buffer) => chunks.push(chunk));
      doc.on('end', () => {
        const buffer = Buffer.concat(chunks);
        resolve({ buffer, contentType: 'application/pdf', filename: 'transactions.pdf' });
      });
      doc.on('error', reject);

      doc.fontSize(16).font('Helvetica-Bold').text('Transaction Report', { align: 'center' });
      doc.fontSize(10).font('Helvetica').text(`Generated: ${new Date().toLocaleDateString('en-IN')}`, { align: 'center' });
      doc.moveDown(1);

      const cols = [
        { label: 'Token',             width: 90 },
        { label: 'Date',              width: 70 },
        { label: 'Amount',            width: 65 },
        { label: 'Commission',        width: 65 },
        { label: 'Final Amt',         width: 65 },
        { label: 'Approval',          width: 65 },
        { label: 'Payment',           width: 60 },
        { label: 'Collection Branch', width: 90 },
        { label: 'Payout Branch',     width: 80 },
      ];

      let x = 40;
      const headerY = doc.y;
      doc.font('Helvetica-Bold').fontSize(8);
      cols.forEach((col) => {
        doc.text(col.label, x, headerY, { width: col.width, ellipsis: true });
        x += col.width;
      });
      doc.moveDown(0.5);

      doc.font('Helvetica').fontSize(7);
      for (const tx of transactions.slice(0, 500)) {
        if (doc.y > 520) doc.addPage();
        const rowY = doc.y;
        x = 40;
        const vals = [
          tx.tokenNumber,
          new Date(tx.createdAt).toLocaleDateString('en-IN'),
          `${tx.amount ?? 0}`,
          `${tx.commissionAmount ?? 0}`,
          `${tx.finalAmount ?? 0}`,
          tx.approvalStatus,
          tx.paymentStatus,
          tx.collectionBranchId?.name || '',
          tx.payoutBranchId?.name || '',
        ];
        vals.forEach((val, i) => {
          doc.text(String(val ?? ''), x, rowY, { width: cols[i].width, ellipsis: true });
          x += cols[i].width;
        });
        doc.moveDown(0.4);
      }
      doc.end();
    });
  }

  private async _buildExcel(transactions: any[]): Promise<ExportResult> {
    const ExcelJS = require('exceljs');
    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet('Transactions');
    sheet.columns = [
      { header: 'Token',             key: 'token',      width: 20 },
      { header: 'Date',              key: 'date',       width: 18 },
      { header: 'Amount (₹)',        key: 'amount',     width: 14 },
      { header: 'Commission (₹)',    key: 'commission', width: 16 },
      { header: 'Final Amount (₹)', key: 'finalAmt',   width: 16 },
      { header: 'Approval',          key: 'approval',   width: 12 },
      { header: 'Payment',           key: 'payment',    width: 12 },
      { header: 'Collection Branch', key: 'collBranch', width: 20 },
      { header: 'Payout Branch',     key: 'payBranch',  width: 20 },
    ];
    for (const tx of transactions) {
      sheet.addRow({
        token:      tx.tokenNumber || '',
        date:       tx.createdAt ? new Date(tx.createdAt).toLocaleDateString('en-IN') : '',
        amount:     (tx.amount || 0).toFixed(2),
        commission: (tx.commissionAmount || 0).toFixed(2),
        finalAmt:   (tx.finalAmount || 0).toFixed(2),
        approval:   tx.approvalStatus || '',
        payment:    tx.paymentStatus || '',
        collBranch: tx.collectionBranchId?.name || '',
        payBranch:  tx.payoutBranchId?.name || '',
      });
    }
    const buffer = await workbook.xlsx.writeBuffer();
    return { buffer: buffer as Buffer, contentType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', filename: 'transactions.xlsx' };
  }

  // =========================================================================
  // DAILY REPORT export helpers
  // =========================================================================

  private _buildDailyReportCsv(data: any): ExportResult {
    const header = ['Date', 'Count', 'Total Amount (₹)', 'Total Commission (₹)', 'Total Final Amount (₹)', 'Pending', 'Approved', 'Completed', 'Rejected'];
    const rows = (data.rows || []).map((r: any) => [
      r.date, r.count, r.totalAmount, r.totalCommission, r.totalFinalAmount,
      r.pendingCount, r.approvedCount, r.completedCount, r.rejectedCount,
    ]);
    const csv = [header, ...rows].map((row) => row.map((v: any) => `"${String(v ?? '')}"`).join(',')).join('\n');
    return { buffer: Buffer.from('﻿' + csv, 'utf-8'), contentType: 'text/csv', filename: 'daily-report.csv' };
  }

  private async _buildDailyReportExcel(data: any): Promise<ExportResult> {
    const ExcelJS = require('exceljs');
    const wb = new ExcelJS.Workbook();
    const ws = wb.addWorksheet('Daily Report');
    ws.columns = [
      { header: 'Date',                  key: 'date',        width: 14 },
      { header: 'Count',                 key: 'count',       width: 10 },
      { header: 'Total Amount (₹)',      key: 'amount',      width: 18 },
      { header: 'Total Commission (₹)',  key: 'commission',  width: 20 },
      { header: 'Final Amount (₹)',      key: 'finalAmt',    width: 18 },
      { header: 'Pending',               key: 'pending',     width: 10 },
      { header: 'Approved',              key: 'approved',    width: 10 },
      { header: 'Completed',             key: 'completed',   width: 12 },
      { header: 'Rejected',              key: 'rejected',    width: 10 },
    ];
    for (const r of (data.rows || [])) {
      ws.addRow({ date: r.date, count: r.count, amount: r.totalAmount, commission: r.totalCommission, finalAmt: r.totalFinalAmount, pending: r.pendingCount, approved: r.approvedCount, completed: r.completedCount, rejected: r.rejectedCount });
    }
    const buffer = await wb.xlsx.writeBuffer();
    return { buffer: buffer as Buffer, contentType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', filename: 'daily-report.xlsx' };
  }

  private _buildDailyReportPdf(data: any, filters: any): Promise<ExportResult> {
    return new Promise<ExportResult>((resolve, reject) => {
      const doc = new PDFDocument({ margin: 40, size: 'A4' });
      const chunks: Buffer[] = [];
      doc.on('data', (c: Buffer) => chunks.push(c));
      doc.on('end', () => resolve({ buffer: Buffer.concat(chunks), contentType: 'application/pdf', filename: 'daily-report.pdf' }));
      doc.on('error', reject);

      this._pdfHeader(doc, 'Daily Transaction Report', filters);
      const s = data.summary || {};
      doc.fontSize(9).font('Helvetica').text(`Summary — Count: ${s.totalCount || 0} | Amount: ₹${s.totalAmount || 0} | Commission: ₹${s.totalCommission || 0}`);
      doc.moveDown(0.5);

      const cols = [
        { label: 'Date', width: 80 }, { label: 'Count', width: 45 }, { label: 'Amount (₹)', width: 80 },
        { label: 'Commission (₹)', width: 90 }, { label: 'Final Amt (₹)', width: 80 }, { label: 'Pending', width: 50 },
        { label: 'Approved', width: 55 }, { label: 'Completed', width: 60 }, { label: 'Rejected', width: 55 },
      ];
      this._pdfTable(doc, cols, (data.rows || []).map((r: any) => [
        r.date, r.count, r.totalAmount, r.totalCommission, r.totalFinalAmount, r.pendingCount, r.approvedCount, r.completedCount, r.rejectedCount,
      ]));
      doc.end();
    });
  }

  // =========================================================================
  // TRANSACTION LIST (pending-queue / outstanding / rejected)
  // =========================================================================

  private _buildTransactionListCsv(rows: any[], type: string): ExportResult {
    const header = ['Token', 'Amount (₹)', 'Commission (₹)', 'Collection Branch', 'Payout Branch', 'Created At', 'Remarks'];
    const data = rows.map((r: any) => [
      r.tokenNumber, r.amount, r.commissionAmount,
      r.collectionBranchId?.name || '', r.payoutBranchId?.name || '',
      r.createdAt ? new Date(r.createdAt).toLocaleDateString('en-IN') : '',
      r.remarks || '',
    ]);
    const csv = [header, ...data].map((row) => row.map((v: any) => `"${String(v ?? '')}"`).join(',')).join('\n');
    return { buffer: Buffer.from('﻿' + csv, 'utf-8'), contentType: 'text/csv', filename: `${type}.csv` };
  }

  private async _buildTransactionListExcel(rows: any[], type: string): Promise<ExportResult> {
    const ExcelJS = require('exceljs');
    const wb = new ExcelJS.Workbook();
    const ws = wb.addWorksheet(type);
    ws.columns = [
      { header: 'Token', key: 'token', width: 22 }, { header: 'Amount (₹)', key: 'amount', width: 14 },
      { header: 'Commission (₹)', key: 'commission', width: 16 }, { header: 'Collection Branch', key: 'coll', width: 20 },
      { header: 'Payout Branch', key: 'payout', width: 20 }, { header: 'Created At', key: 'date', width: 16 }, { header: 'Remarks', key: 'remarks', width: 30 },
    ];
    for (const r of rows) {
      ws.addRow({ token: r.tokenNumber, amount: r.amount, commission: r.commissionAmount, coll: r.collectionBranchId?.name || '', payout: r.payoutBranchId?.name || '', date: r.createdAt ? new Date(r.createdAt).toLocaleDateString('en-IN') : '', remarks: r.remarks || '' });
    }
    const buffer = await wb.xlsx.writeBuffer();
    return { buffer: buffer as Buffer, contentType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', filename: `${type}.xlsx` };
  }

  private _buildTransactionListPdf(rows: any[], type: string, filters: any): Promise<ExportResult> {
    return new Promise<ExportResult>((resolve, reject) => {
      const doc = new PDFDocument({ margin: 40, size: 'A4', layout: 'landscape' });
      const chunks: Buffer[] = [];
      doc.on('data', (c: Buffer) => chunks.push(c));
      doc.on('end', () => resolve({ buffer: Buffer.concat(chunks), contentType: 'application/pdf', filename: `${type}.pdf` }));
      doc.on('error', reject);
      this._pdfHeader(doc, type.replace(/-/g, ' ').replace(/\b\w/g, (l) => l.toUpperCase()), filters);
      const cols = [
        { label: 'Token', width: 110 }, { label: 'Amount (₹)', width: 80 }, { label: 'Commission (₹)', width: 90 },
        { label: 'Collection', width: 100 }, { label: 'Payout', width: 100 }, { label: 'Date', width: 80 }, { label: 'Remarks', width: 140 },
      ];
      this._pdfTable(doc, cols, rows.map((r: any) => [
        r.tokenNumber, r.amount, r.commissionAmount,
        r.collectionBranchId?.name || '', r.payoutBranchId?.name || '',
        r.createdAt ? new Date(r.createdAt).toLocaleDateString('en-IN') : '',
        r.remarks || '',
      ]));
      doc.end();
    });
  }

  // =========================================================================
  // BRANCH COLLECTION REPORT
  // =========================================================================

  private _buildBranchCollectionCsv(data: any): ExportResult {
    const header = ['Branch', 'Code', 'Collection Count', 'Collection Amount (₹)', 'Commission Earned (₹)', 'Payout Count', 'Payout Amount (₹)'];
    const rows = (data.branches || []).map((b: any) => [
      b.branchName, b.branchCode, b.collection.count, b.collection.totalAmount,
      b.collection.totalCommission, b.payout.count, b.payout.totalFinalAmount,
    ]);
    const csv = [header, ...rows].map((row) => row.map((v: any) => `"${String(v ?? '')}"`).join(',')).join('\n');
    return { buffer: Buffer.from('﻿' + csv, 'utf-8'), contentType: 'text/csv', filename: 'branch-collection.csv' };
  }

  private async _buildBranchCollectionExcel(data: any): Promise<ExportResult> {
    const ExcelJS = require('exceljs');
    const wb = new ExcelJS.Workbook();
    const ws = wb.addWorksheet('Branch Collection');
    ws.columns = [
      { header: 'Branch', key: 'branch', width: 20 }, { header: 'Code', key: 'code', width: 10 },
      { header: 'Coll. Count', key: 'cc', width: 12 }, { header: 'Coll. Amount (₹)', key: 'ca', width: 18 },
      { header: 'Commission (₹)', key: 'cm', width: 16 }, { header: 'Payout Count', key: 'pc', width: 14 }, { header: 'Payout Amount (₹)', key: 'pa', width: 18 },
    ];
    for (const b of (data.branches || [])) {
      ws.addRow({ branch: b.branchName, code: b.branchCode, cc: b.collection.count, ca: b.collection.totalAmount, cm: b.collection.totalCommission, pc: b.payout.count, pa: b.payout.totalFinalAmount });
    }
    const buffer = await wb.xlsx.writeBuffer();
    return { buffer: buffer as Buffer, contentType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', filename: 'branch-collection.xlsx' };
  }

  private _buildBranchCollectionPdf(data: any, filters: any): Promise<ExportResult> {
    return new Promise<ExportResult>((resolve, reject) => {
      const doc = new PDFDocument({ margin: 40, size: 'A4', layout: 'landscape' });
      const chunks: Buffer[] = [];
      doc.on('data', (c: Buffer) => chunks.push(c));
      doc.on('end', () => resolve({ buffer: Buffer.concat(chunks), contentType: 'application/pdf', filename: 'branch-collection.pdf' }));
      doc.on('error', reject);
      this._pdfHeader(doc, 'Branch Collection Report', filters);
      const cols = [
        { label: 'Branch', width: 100 }, { label: 'Code', width: 60 }, { label: 'Coll. Count', width: 70 },
        { label: 'Coll. Amount (₹)', width: 100 }, { label: 'Commission (₹)', width: 100 }, { label: 'Payout Count', width: 80 }, { label: 'Payout Amt (₹)', width: 100 },
      ];
      this._pdfTable(doc, cols, (data.branches || []).map((b: any) => [
        b.branchName, b.branchCode, b.collection.count, b.collection.totalAmount, b.collection.totalCommission, b.payout.count, b.payout.totalFinalAmount,
      ]));
      doc.end();
    });
  }

  // =========================================================================
  // BRANCH FLOW MATRIX
  // =========================================================================

  private _buildBranchFlowCsv(data: any): ExportResult {
    const header = ['From Branch', 'From Code', 'To Branch', 'To Code', 'Count', 'Total Amount (₹)', 'Commission (₹)'];
    const rows = (data.corridors || []).map((c: any) => [
      c.fromBranchName, c.fromBranchCode, c.toBranchName, c.toBranchCode, c.count, c.totalAmount, c.totalCommission,
    ]);
    const csv = [header, ...rows].map((row) => row.map((v: any) => `"${String(v ?? '')}"`).join(',')).join('\n');
    return { buffer: Buffer.from('﻿' + csv, 'utf-8'), contentType: 'text/csv', filename: 'branch-flow.csv' };
  }

  private async _buildBranchFlowExcel(data: any): Promise<ExportResult> {
    const ExcelJS = require('exceljs');
    const wb = new ExcelJS.Workbook();
    const ws = wb.addWorksheet('Branch Flow');
    ws.columns = [
      { header: 'From Branch', key: 'from', width: 18 }, { header: 'From Code', key: 'fromCode', width: 12 },
      { header: 'To Branch', key: 'to', width: 18 }, { header: 'To Code', key: 'toCode', width: 12 },
      { header: 'Count', key: 'count', width: 10 }, { header: 'Total Amount (₹)', key: 'amount', width: 18 }, { header: 'Commission (₹)', key: 'commission', width: 16 },
    ];
    for (const c of (data.corridors || [])) {
      ws.addRow({ from: c.fromBranchName, fromCode: c.fromBranchCode, to: c.toBranchName, toCode: c.toBranchCode, count: c.count, amount: c.totalAmount, commission: c.totalCommission });
    }
    const buffer = await wb.xlsx.writeBuffer();
    return { buffer: buffer as Buffer, contentType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', filename: 'branch-flow.xlsx' };
  }

  private _buildBranchFlowPdf(data: any, filters: any): Promise<ExportResult> {
    return new Promise<ExportResult>((resolve, reject) => {
      const doc = new PDFDocument({ margin: 40, size: 'A4', layout: 'landscape' });
      const chunks: Buffer[] = [];
      doc.on('data', (c: Buffer) => chunks.push(c));
      doc.on('end', () => resolve({ buffer: Buffer.concat(chunks), contentType: 'application/pdf', filename: 'branch-flow.pdf' }));
      doc.on('error', reject);
      this._pdfHeader(doc, 'Branch Flow Matrix', filters);
      doc.fontSize(9).text(`Total Corridors: ${data.totalCorridors || 0}`);
      doc.moveDown(0.5);
      const cols = [
        { label: 'From Branch', width: 110 }, { label: 'From Code', width: 70 }, { label: 'To Branch', width: 110 },
        { label: 'To Code', width: 70 }, { label: 'Count', width: 55 }, { label: 'Amount (₹)', width: 90 }, { label: 'Commission (₹)', width: 90 },
      ];
      this._pdfTable(doc, cols, (data.corridors || []).map((c: any) => [
        c.fromBranchName, c.fromBranchCode, c.toBranchName, c.toBranchCode, c.count, c.totalAmount, c.totalCommission,
      ]));
      doc.end();
    });
  }

  // =========================================================================
  // CASH POSITION
  // =========================================================================

  private _buildCashPositionCsv(data: any): ExportResult {
    const header = ['Branch', 'Code', 'Actual Balance (₹)', 'Committed Payout (₹)', 'Pending Payout (₹)', 'Payout Completed (₹)', 'Effective Balance (₹)'];
    const rows = (data.branches || []).map((b: any) => [
      b.branchName, b.branchCode, b.actualBalance, b.committedPayout, b.pendingPayout, b.payoutCompleted, b.effectiveBalance,
    ]);
    const csv = [header, ...rows].map((row) => row.map((v: any) => `"${String(v ?? '')}"`).join(',')).join('\n');
    return { buffer: Buffer.from('﻿' + csv, 'utf-8'), contentType: 'text/csv', filename: 'cash-position.csv' };
  }

  private async _buildCashPositionExcel(data: any): Promise<ExportResult> {
    const ExcelJS = require('exceljs');
    const wb = new ExcelJS.Workbook();
    const ws = wb.addWorksheet('Cash Position');
    ws.columns = [
      { header: 'Branch', key: 'branch', width: 20 }, { header: 'Code', key: 'code', width: 10 },
      { header: 'Actual Balance (₹)', key: 'actual', width: 20 }, { header: 'Committed Payout (₹)', key: 'committed', width: 22 },
      { header: 'Pending Payout (₹)', key: 'pending', width: 20 }, { header: 'Payout Completed (₹)', key: 'completed', width: 22 }, { header: 'Effective Balance (₹)', key: 'effective', width: 22 },
    ];
    for (const b of (data.branches || [])) {
      ws.addRow({ branch: b.branchName, code: b.branchCode, actual: b.actualBalance, committed: b.committedPayout, pending: b.pendingPayout, completed: b.payoutCompleted, effective: b.effectiveBalance });
    }
    const t = data.totals || {};
    ws.addRow({});
    ws.addRow({ branch: 'TOTAL', code: '', actual: t.actualBalance, committed: t.committedPayout, effective: t.effectiveBalance });
    const buffer = await wb.xlsx.writeBuffer();
    return { buffer: buffer as Buffer, contentType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', filename: 'cash-position.xlsx' };
  }

  private _buildCashPositionPdf(data: any, filters: any): Promise<ExportResult> {
    return new Promise<ExportResult>((resolve, reject) => {
      const doc = new PDFDocument({ margin: 40, size: 'A4', layout: 'landscape' });
      const chunks: Buffer[] = [];
      doc.on('data', (c: Buffer) => chunks.push(c));
      doc.on('end', () => resolve({ buffer: Buffer.concat(chunks), contentType: 'application/pdf', filename: 'cash-position.pdf' }));
      doc.on('error', reject);
      this._pdfHeader(doc, 'Cash Position', filters);
      const t = data.totals || {};
      doc.fontSize(9).text(`Totals — Actual: ₹${t.actualBalance || 0} | Committed: ₹${t.committedPayout || 0} | Effective: ₹${t.effectiveBalance || 0}`);
      doc.moveDown(0.5);
      const cols = [
        { label: 'Branch', width: 100 }, { label: 'Code', width: 60 }, { label: 'Actual Bal (₹)', width: 90 },
        { label: 'Committed (₹)', width: 90 }, { label: 'Pending (₹)', width: 80 }, { label: 'Completed (₹)', width: 90 }, { label: 'Effective (₹)', width: 90 },
      ];
      this._pdfTable(doc, cols, (data.branches || []).map((b: any) => [
        b.branchName, b.branchCode, b.actualBalance, b.committedPayout, b.pendingPayout, b.payoutCompleted, b.effectiveBalance,
      ]));
      doc.end();
    });
  }

  // =========================================================================
  // STAFF REPORT
  // =========================================================================

  private _buildStaffReportCsv(data: any): ExportResult {
    const header = ['Name', 'Username', 'Role', 'Branch', 'Branch Code', 'Count', 'Total Amount (₹)', 'Commission (₹)', 'Final Amount (₹)'];
    const rows = (data.staff || []).map((s: any) => [
      s.name, s.username, s.role, s.branchName, s.branchCode, s.count, s.totalAmount, s.totalCommission, s.totalFinalAmount,
    ]);
    const csv = [header, ...rows].map((row) => row.map((v: any) => `"${String(v ?? '')}"`).join(',')).join('\n');
    return { buffer: Buffer.from('﻿' + csv, 'utf-8'), contentType: 'text/csv', filename: 'staff-report.csv' };
  }

  private async _buildStaffReportExcel(data: any): Promise<ExportResult> {
    const ExcelJS = require('exceljs');
    const wb = new ExcelJS.Workbook();
    const ws = wb.addWorksheet('Staff Report');
    ws.columns = [
      { header: 'Name', key: 'name', width: 20 }, { header: 'Username', key: 'user', width: 16 }, { header: 'Role', key: 'role', width: 14 },
      { header: 'Branch', key: 'branch', width: 18 }, { header: 'Code', key: 'code', width: 10 }, { header: 'Count', key: 'count', width: 10 },
      { header: 'Total Amount (₹)', key: 'amount', width: 18 }, { header: 'Commission (₹)', key: 'commission', width: 16 }, { header: 'Final Amount (₹)', key: 'final', width: 18 },
    ];
    for (const s of (data.staff || [])) {
      ws.addRow({ name: s.name, user: s.username, role: s.role, branch: s.branchName, code: s.branchCode, count: s.count, amount: s.totalAmount, commission: s.totalCommission, final: s.totalFinalAmount });
    }
    const buffer = await wb.xlsx.writeBuffer();
    return { buffer: buffer as Buffer, contentType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', filename: 'staff-report.xlsx' };
  }

  private _buildStaffReportPdf(data: any, filters: any): Promise<ExportResult> {
    return new Promise<ExportResult>((resolve, reject) => {
      const doc = new PDFDocument({ margin: 40, size: 'A4', layout: 'landscape' });
      const chunks: Buffer[] = [];
      doc.on('data', (c: Buffer) => chunks.push(c));
      doc.on('end', () => resolve({ buffer: Buffer.concat(chunks), contentType: 'application/pdf', filename: 'staff-report.pdf' }));
      doc.on('error', reject);
      this._pdfHeader(doc, 'Staff Report', filters);
      const cols = [
        { label: 'Name', width: 100 }, { label: 'Username', width: 80 }, { label: 'Role', width: 70 },
        { label: 'Branch', width: 90 }, { label: 'Code', width: 50 }, { label: 'Count', width: 45 },
        { label: 'Amount (₹)', width: 80 }, { label: 'Commission (₹)', width: 80 }, { label: 'Final Amt (₹)', width: 80 },
      ];
      this._pdfTable(doc, cols, (data.staff || []).map((s: any) => [
        s.name, s.username, s.role, s.branchName, s.branchCode, s.count, s.totalAmount, s.totalCommission, s.totalFinalAmount,
      ]));
      doc.end();
    });
  }

  // =========================================================================
  // COMMISSION OVERRIDES
  // =========================================================================

  private _buildCommissionOverridesCsv(data: any): ExportResult {
    const header = ['Actor', 'Username', 'Transaction ID', 'Token Number', 'Override Type', 'Override Value', 'Commission Amount (₹)', 'Date'];
    const rows = (data.data || []).map((d: any) => [
      d.actorName, d.actorUsername, d.entityId, d.after?.tokenNumber || '', d.after?.overrideType || '', d.after?.overrideValue || '', d.after?.commissionAmount || '',
      d.createdAt ? new Date(d.createdAt).toLocaleDateString('en-IN') : '',
    ]);
    const csv = [header, ...rows].map((row) => row.map((v: any) => `"${String(v ?? '')}"`).join(',')).join('\n');
    return { buffer: Buffer.from('﻿' + csv, 'utf-8'), contentType: 'text/csv', filename: 'commission-overrides.csv' };
  }

  private async _buildCommissionOverridesExcel(data: any): Promise<ExportResult> {
    const ExcelJS = require('exceljs');
    const wb = new ExcelJS.Workbook();
    const ws = wb.addWorksheet('Commission Overrides');
    ws.columns = [
      { header: 'Actor', key: 'actor', width: 20 }, { header: 'Username', key: 'user', width: 16 }, { header: 'Transaction ID', key: 'txnId', width: 26 },
      { header: 'Token', key: 'token', width: 20 }, { header: 'Override Type', key: 'type', width: 16 }, { header: 'Override Value', key: 'value', width: 16 },
      { header: 'Commission (₹)', key: 'commission', width: 16 }, { header: 'Date', key: 'date', width: 16 },
    ];
    for (const d of (data.data || [])) {
      ws.addRow({ actor: d.actorName, user: d.actorUsername, txnId: String(d.entityId || ''), token: d.after?.tokenNumber || '', type: d.after?.overrideType || '', value: d.after?.overrideValue || '', commission: d.after?.commissionAmount || 0, date: d.createdAt ? new Date(d.createdAt).toLocaleDateString('en-IN') : '' });
    }
    const buffer = await wb.xlsx.writeBuffer();
    return { buffer: buffer as Buffer, contentType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', filename: 'commission-overrides.xlsx' };
  }

  private _buildCommissionOverridesPdf(data: any, filters: any): Promise<ExportResult> {
    return new Promise<ExportResult>((resolve, reject) => {
      const doc = new PDFDocument({ margin: 40, size: 'A4', layout: 'landscape' });
      const chunks: Buffer[] = [];
      doc.on('data', (c: Buffer) => chunks.push(c));
      doc.on('end', () => resolve({ buffer: Buffer.concat(chunks), contentType: 'application/pdf', filename: 'commission-overrides.pdf' }));
      doc.on('error', reject);
      this._pdfHeader(doc, 'Commission Override Report', filters);
      const cols = [
        { label: 'Actor', width: 100 }, { label: 'Username', width: 80 }, { label: 'Token', width: 110 },
        { label: 'Override Type', width: 80 }, { label: 'Value', width: 60 }, { label: 'Commission (₹)', width: 90 }, { label: 'Date', width: 80 },
      ];
      this._pdfTable(doc, cols, (data.data || []).map((d: any) => [
        d.actorName, d.actorUsername, d.after?.tokenNumber || '', d.after?.overrideType || '', d.after?.overrideValue || '', d.after?.commissionAmount || 0,
        d.createdAt ? new Date(d.createdAt).toLocaleDateString('en-IN') : '',
      ]));
      doc.end();
    });
  }

  // =========================================================================
  // PAYMENT METHOD REPORT
  // =========================================================================

  private _buildPaymentMethodCsv(data: any): ExportResult {
    const header = ['Payment Method', 'Count', 'Total Amount (₹)', 'Commission (₹)', 'Final Amount (₹)'];
    const rows = (data.methods || []).map((m: any) => [m.method, m.count, m.totalAmount, m.totalCommission, m.totalFinalAmount]);
    const csv = [header, ...rows].map((row) => row.map((v: any) => `"${String(v ?? '')}"`).join(',')).join('\n');
    return { buffer: Buffer.from('﻿' + csv, 'utf-8'), contentType: 'text/csv', filename: 'payment-methods.csv' };
  }

  private async _buildPaymentMethodExcel(data: any): Promise<ExportResult> {
    const ExcelJS = require('exceljs');
    const wb = new ExcelJS.Workbook();
    const ws = wb.addWorksheet('Payment Methods');
    ws.columns = [
      { header: 'Payment Method', key: 'method', width: 18 }, { header: 'Count', key: 'count', width: 10 },
      { header: 'Total Amount (₹)', key: 'amount', width: 18 }, { header: 'Commission (₹)', key: 'commission', width: 16 }, { header: 'Final Amount (₹)', key: 'final', width: 18 },
    ];
    for (const m of (data.methods || [])) {
      ws.addRow({ method: m.method, count: m.count, amount: m.totalAmount, commission: m.totalCommission, final: m.totalFinalAmount });
    }
    const buffer = await wb.xlsx.writeBuffer();
    return { buffer: buffer as Buffer, contentType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', filename: 'payment-methods.xlsx' };
  }

  private _buildPaymentMethodPdf(data: any, filters: any): Promise<ExportResult> {
    return new Promise<ExportResult>((resolve, reject) => {
      const doc = new PDFDocument({ margin: 40, size: 'A4' });
      const chunks: Buffer[] = [];
      doc.on('data', (c: Buffer) => chunks.push(c));
      doc.on('end', () => resolve({ buffer: Buffer.concat(chunks), contentType: 'application/pdf', filename: 'payment-methods.pdf' }));
      doc.on('error', reject);
      this._pdfHeader(doc, 'Payment Method Report', filters);
      const s = data.summary || {};
      doc.fontSize(9).text(`Total Count: ${s.totalCount || 0} | Total Amount: ₹${s.totalAmount || 0}`);
      doc.moveDown(0.5);
      const cols = [
        { label: 'Payment Method', width: 130 }, { label: 'Count', width: 60 }, { label: 'Total Amount (₹)', width: 120 },
        { label: 'Commission (₹)', width: 120 }, { label: 'Final Amount (₹)', width: 120 },
      ];
      this._pdfTable(doc, cols, (data.methods || []).map((m: any) => [m.method, m.count, m.totalAmount, m.totalCommission, m.totalFinalAmount]));
      doc.end();
    });
  }

  // =========================================================================
  // PERIOD COMPARISON
  // =========================================================================

  private _buildPeriodComparisonCsv(data: any): ExportResult {
    const header = ['Period', 'Start Date', 'End Date', 'Count', 'Total Amount (₹)', 'Commission (₹)', 'Completed Count'];
    const rows = [
      ['current', data.current?.startDate, data.current?.endDate, data.current?.count, data.current?.totalAmount, data.current?.totalCommission, data.current?.completedCount],
      ['previous', data.previous?.startDate, data.previous?.endDate, data.previous?.count, data.previous?.totalAmount, data.previous?.totalCommission, data.previous?.completedCount],
    ];
    const csv = [header, ...rows].map((row) => row.map((v: any) => `"${String(v ?? '')}"`).join(',')).join('\n');
    return { buffer: Buffer.from('﻿' + csv, 'utf-8'), contentType: 'text/csv', filename: 'period-comparison.csv' };
  }

  private async _buildPeriodComparisonExcel(data: any): Promise<ExportResult> {
    const ExcelJS = require('exceljs');
    const wb = new ExcelJS.Workbook();
    const ws = wb.addWorksheet('Period Comparison');
    ws.columns = [
      { header: 'Period', key: 'period', width: 12 }, { header: 'Start Date', key: 'start', width: 14 }, { header: 'End Date', key: 'end', width: 14 },
      { header: 'Count', key: 'count', width: 10 }, { header: 'Total Amount (₹)', key: 'amount', width: 18 }, { header: 'Commission (₹)', key: 'commission', width: 16 }, { header: 'Completed', key: 'completed', width: 12 },
    ];
    const addRow = (label: string, d: any) => ws.addRow({ period: label, start: d?.startDate, end: d?.endDate, count: d?.count, amount: d?.totalAmount, commission: d?.totalCommission, completed: d?.completedCount });
    addRow('Current', data.current);
    addRow('Previous', data.previous);
    ws.addRow({});
    const g = data.growth || {};
    ws.addRow({ period: 'Growth %', count: `${g.countPct}%`, amount: `${g.amountPct}%`, commission: `${g.commissionPct}%` });
    const buffer = await wb.xlsx.writeBuffer();
    return { buffer: buffer as Buffer, contentType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', filename: 'period-comparison.xlsx' };
  }

  private _buildPeriodComparisonPdf(data: any): Promise<ExportResult> {
    return new Promise<ExportResult>((resolve, reject) => {
      const doc = new PDFDocument({ margin: 40, size: 'A4' });
      const chunks: Buffer[] = [];
      doc.on('data', (c: Buffer) => chunks.push(c));
      doc.on('end', () => resolve({ buffer: Buffer.concat(chunks), contentType: 'application/pdf', filename: 'period-comparison.pdf' }));
      doc.on('error', reject);
      doc.fontSize(16).font('Helvetica-Bold').text(`Period Comparison — ${(data.period || '').toUpperCase()}`, { align: 'center' });
      doc.fontSize(10).font('Helvetica').text(`Generated: ${new Date().toLocaleDateString('en-IN')}`, { align: 'center' });
      doc.moveDown(1);
      const cols = [
        { label: 'Period', width: 80 }, { label: 'Start Date', width: 90 }, { label: 'End Date', width: 90 },
        { label: 'Count', width: 55 }, { label: 'Amount (₹)', width: 90 }, { label: 'Commission (₹)', width: 100 }, { label: 'Completed', width: 75 },
      ];
      const rows: any[] = [];
      const c = data.current || {};
      const p = data.previous || {};
      const g = data.growth || {};
      rows.push(['Current', c.startDate, c.endDate, c.count, c.totalAmount, c.totalCommission, c.completedCount]);
      rows.push(['Previous', p.startDate, p.endDate, p.count, p.totalAmount, p.totalCommission, p.completedCount]);
      rows.push([`Growth %`, '', '', `${g.countPct}%`, `${g.amountPct}%`, `${g.commissionPct}%`, '']);
      this._pdfTable(doc, cols, rows);
      doc.end();
    });
  }

  // =========================================================================
  // PDF helper utilities
  // =========================================================================

  private _pdfHeader(doc: any, title: string, filters: any = {}) {
    doc.fontSize(16).font('Helvetica-Bold').text(title, { align: 'center' });
    const parts: string[] = [];
    if (filters.fromDate) parts.push(`From: ${filters.fromDate}`);
    if (filters.toDate) parts.push(`To: ${filters.toDate}`);
    parts.push(`Generated: ${new Date().toLocaleDateString('en-IN')}`);
    doc.fontSize(9).font('Helvetica').text(parts.join('  |  '), { align: 'center' });
    doc.moveDown(0.8);
  }

  private _pdfTable(doc: any, cols: Array<{ label: string; width: number }>, rows: any[][]) {
    // Header row
    let x = 40;
    const headerY = doc.y;
    doc.font('Helvetica-Bold').fontSize(8);
    cols.forEach((col) => {
      doc.text(col.label, x, headerY, { width: col.width, ellipsis: true });
      x += col.width;
    });
    doc.moveDown(0.4);

    // Draw header underline
    const totalWidth = cols.reduce((s, c) => s + c.width, 0);
    doc.moveTo(40, doc.y).lineTo(40 + totalWidth, doc.y).stroke();
    doc.moveDown(0.3);

    // Data rows
    doc.font('Helvetica').fontSize(7);
    for (const row of rows) {
      if (doc.y > (doc.page.height - 80)) {
        doc.addPage();
      }
      const rowY = doc.y;
      x = 40;
      row.forEach((val: any, i: number) => {
        doc.text(String(val ?? ''), x, rowY, { width: cols[i]?.width || 60, ellipsis: true });
        x += cols[i]?.width || 60;
      });
      doc.moveDown(0.4);
    }
  }
}
