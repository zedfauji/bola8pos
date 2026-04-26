/* eslint-disable @typescript-eslint/no-unsafe-argument, react-refresh/only-export-components */
import { Document, Page, View, Text, StyleSheet, pdf } from '@react-pdf/renderer';
import React from 'react';
import type {
  CajaReport,
  ComboMixRow,
  CategoryRevenueRow,
  HourlyRow,
  ProductSalesRow,
  RecipeVarianceRow,
  RefundRegisterRow,
  StaffMetric,
  StaffTips,
  VoidRefundRow,
  WaitlistMetricsRow,
} from '@shared/lib/domain';

const DARK_HEADER = '#1e293b';

const styles = StyleSheet.create({
  page: { padding: 32, fontSize: 10, fontFamily: 'Helvetica', color: '#0f172a' },
  header: { marginBottom: 16 },
  title: { fontSize: 16, fontWeight: 'bold', marginBottom: 2 },
  subtitle: { fontSize: 10, color: '#64748b' },
  tableHeader: {
    flexDirection: 'row',
    backgroundColor: DARK_HEADER,
    color: '#ffffff',
    paddingHorizontal: 6,
    paddingVertical: 4,
    fontWeight: 'bold',
  },
  row: { flexDirection: 'row', paddingHorizontal: 6, paddingVertical: 3 },
  rowAlt: { backgroundColor: '#f8fafc' },
  cell: { flex: 1 },
  cellRight: { flex: 1, textAlign: 'right' },
  sectionTitle: { fontSize: 11, fontWeight: 'bold', marginTop: 14, marginBottom: 4 },
});

function fmt(n: number): string {
  return `$${n.toFixed(2)}`;
}

function ReportHeader({ title, date }: { title: string; date: string }) {
  return (
    <View style={styles.header}>
      <Text style={styles.title}>{'Bar & Pool Parlor POS'}</Text>
      <Text style={styles.subtitle}>{title}</Text>
      <Text style={styles.subtitle}>{date}</Text>
    </View>
  );
}

function CajaReportDoc({ report }: { report: CajaReport }) {
  const date = report.cajaSession.openedAt.toLocaleDateString();
  return (
    <Document>
      <Page size="A4" style={styles.page}>
        <ReportHeader title="Daily Caja Report" date={date} />

        <Text style={styles.sectionTitle}>Summary</Text>
        <View style={styles.tableHeader}>
          <Text style={styles.cell}>Metric</Text>
          <Text style={styles.cellRight}>Value</Text>
        </View>
        {[
          ['Total Revenue', fmt(report.summary.totalRevenue)],
          ['Cash Sales', fmt(report.summary.cashSales)],
          ['Card Sales', fmt(report.summary.cardSales)],
          ['Rappi Sales', fmt(report.summary.rappiSales)],
          ['Order Count', String(report.summary.orderCount)],
          ['Tab Count', String(report.summary.tabCount)],
        ].map(([label, value], i) => (
          <View key={label} style={[styles.row, i % 2 === 1 ? styles.rowAlt : {}]}>
            <Text style={styles.cell}>{label}</Text>
            <Text style={styles.cellRight}>{value}</Text>
          </View>
        ))}

        <Text style={styles.sectionTitle}>Cash Reconciliation</Text>
        <View style={styles.tableHeader}>
          <Text style={styles.cell}>Item</Text>
          <Text style={styles.cellRight}>Amount</Text>
        </View>
        {[
          ['Opening Cash', fmt(report.cashReconciliation.openingCash)],
          ['Cash Sales', fmt(report.cashReconciliation.cashSales)],
          ['Expected Cash', fmt(report.cashReconciliation.expectedCash)],
          [
            'Closing Cash',
            report.cashReconciliation.closingCash !== null
              ? fmt(report.cashReconciliation.closingCash)
              : '—',
          ],
          [
            'Variance',
            report.cashReconciliation.variance !== null
              ? fmt(report.cashReconciliation.variance)
              : '—',
          ],
        ].map(([label, value], i) => (
          <View key={label} style={[styles.row, i % 2 === 1 ? styles.rowAlt : {}]}>
            <Text style={styles.cell}>{label}</Text>
            <Text style={styles.cellRight}>{value}</Text>
          </View>
        ))}

        <Text style={styles.sectionTitle}>Top Products</Text>
        <View style={styles.tableHeader}>
          <Text style={styles.cell}>Product</Text>
          <Text style={styles.cellRight}>Qty</Text>
          <Text style={styles.cellRight}>Revenue</Text>
        </View>
        {report.topProducts.map((p, i) => (
          <View key={p.productName} style={[styles.row, i % 2 === 1 ? styles.rowAlt : {}]}>
            <Text style={styles.cell}>{p.productName}</Text>
            <Text style={styles.cellRight}>{String(p.quantity)}</Text>
            <Text style={styles.cellRight}>{fmt(p.revenue)}</Text>
          </View>
        ))}

        <Text style={styles.sectionTitle}>Staff Performance</Text>
        <View style={styles.tableHeader}>
          <Text style={styles.cell}>Staff</Text>
          <Text style={styles.cellRight}>Orders</Text>
          <Text style={styles.cellRight}>Sales Total</Text>
        </View>
        {report.staffSummary.map((s, i) => (
          <View key={s.staffId} style={[styles.row, i % 2 === 1 ? styles.rowAlt : {}]}>
            <Text style={styles.cell}>{s.staffName}</Text>
            <Text style={styles.cellRight}>{String(s.orderCount)}</Text>
            <Text style={styles.cellRight}>{fmt(s.salesTotal)}</Text>
          </View>
        ))}
      </Page>
    </Document>
  );
}

function ProductSalesDoc({
  rows,
  dateRange,
}: {
  rows: ProductSalesRow[];
  dateRange: { from: Date; to: Date };
}) {
  const dateLabel = `${dateRange.from.toLocaleDateString()} – ${dateRange.to.toLocaleDateString()}`;
  return (
    <Document>
      <Page size="A4" style={styles.page}>
        <ReportHeader title="Product Sales Report" date={dateLabel} />
        <View style={styles.tableHeader}>
          <Text style={styles.cell}>Product</Text>
          <Text style={styles.cell}>Category</Text>
          <Text style={styles.cellRight}>Units</Text>
          <Text style={styles.cellRight}>Revenue</Text>
        </View>
        {rows.map((r, i) => (
          <View key={r.productName} style={[styles.row, i % 2 === 1 ? styles.rowAlt : {}]}>
            <Text style={styles.cell}>{r.productName}</Text>
            <Text style={styles.cell}>{r.categoryName}</Text>
            <Text style={styles.cellRight}>{String(r.units)}</Text>
            <Text style={styles.cellRight}>{fmt(r.revenue)}</Text>
          </View>
        ))}
      </Page>
    </Document>
  );
}

function HourlySalesDoc({ rows }: { rows: HourlyRow[] }) {
  return (
    <Document>
      <Page size="A4" style={styles.page}>
        <ReportHeader title="Hourly Sales Report" date={new Date().toLocaleDateString()} />
        <View style={styles.tableHeader}>
          <Text style={styles.cell}>Hour</Text>
          <Text style={styles.cellRight}>Orders</Text>
          <Text style={styles.cellRight}>Revenue</Text>
        </View>
        {rows.map((r, i) => (
          <View key={r.hour} style={[styles.row, i % 2 === 1 ? styles.rowAlt : {}]}>
            <Text style={styles.cell}>{String(r.hour)}:00</Text>
            <Text style={styles.cellRight}>{String(r.orderCount)}</Text>
            <Text style={styles.cellRight}>{fmt(r.revenue)}</Text>
          </View>
        ))}
      </Page>
    </Document>
  );
}

async function docToBytes(doc: React.ReactElement): Promise<Uint8Array> {
  // pdf() accepts React elements that render a Document — cast needed because
  // @react-pdf/renderer's TS signature is narrower than the actual runtime API.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const blob = await pdf(doc as any).toBlob();
  const buffer = await blob.arrayBuffer();
  return new Uint8Array(buffer);
}

export async function cajaReportToPdfBytes(report: CajaReport): Promise<Uint8Array> {
  return docToBytes(React.createElement(CajaReportDoc, { report }));
}

export async function productSalesToPdfBytes(
  rows: ProductSalesRow[],
  dateRange: { from: Date; to: Date }
): Promise<Uint8Array> {
  return docToBytes(React.createElement(ProductSalesDoc, { rows, dateRange }));
}

export async function hourlySalesToPdfBytes(rows: HourlyRow[]): Promise<Uint8Array> {
  return docToBytes(React.createElement(HourlySalesDoc, { rows }));
}

function VoidRefundDoc({
  rows,
  dateRange,
}: {
  rows: VoidRefundRow[];
  dateRange: { from: Date; to: Date };
}) {
  const dateLabel = `${dateRange.from.toLocaleDateString()} – ${dateRange.to.toLocaleDateString()}`;
  return (
    <Document>
      <Page size="A4" style={styles.page}>
        <ReportHeader title="Voids & Refunds Report" date={dateLabel} />
        <View style={styles.tableHeader}>
          <Text style={styles.cell}>Timestamp</Text>
          <Text style={styles.cell}>Staff</Text>
          <Text style={styles.cellRight}>Amount</Text>
          <Text style={styles.cell}>Reason</Text>
        </View>
        {rows.map((r, i) => (
          <View key={r.orderId} style={[styles.row, i % 2 === 1 ? styles.rowAlt : {}]}>
            <Text style={styles.cell}>{r.voidedAt.toLocaleString()}</Text>
            <Text style={styles.cell}>{r.staffName}</Text>
            <Text style={styles.cellRight}>{fmt(r.amount)}</Text>
            <Text style={styles.cell}>{r.reason}</Text>
          </View>
        ))}
      </Page>
    </Document>
  );
}

export async function voidRefundToPdfBytes(
  rows: VoidRefundRow[],
  dateRange: { from: Date; to: Date }
): Promise<Uint8Array> {
  return docToBytes(React.createElement(VoidRefundDoc, { rows, dateRange }));
}

function CategoryRevenueDoc({
  rows,
  dateRange,
}: {
  rows: CategoryRevenueRow[];
  dateRange: { from: Date; to: Date };
}) {
  const dateLabel = `${dateRange.from.toLocaleDateString()} – ${dateRange.to.toLocaleDateString()}`;
  return (
    <Document>
      <Page size="A4" style={styles.page}>
        <ReportHeader title="Revenue by Category" date={dateLabel} />
        <View style={styles.tableHeader}>
          <Text style={styles.cell}>Category</Text>
          <Text style={styles.cellRight}>Units</Text>
          <Text style={styles.cellRight}>Orders</Text>
          <Text style={styles.cellRight}>Revenue</Text>
          <Text style={styles.cellRight}>% of Total</Text>
        </View>
        {rows.map((r, i) => (
          <View key={r.categoryId} style={[styles.row, i % 2 === 1 ? styles.rowAlt : {}]}>
            <Text style={styles.cell}>{r.categoryName}</Text>
            <Text style={styles.cellRight}>{String(r.unitsSold)}</Text>
            <Text style={styles.cellRight}>{String(r.orderCount)}</Text>
            <Text style={styles.cellRight}>{fmt(r.revenue)}</Text>
            <Text style={styles.cellRight}>{String(r.pctTotal)}%</Text>
          </View>
        ))}
      </Page>
    </Document>
  );
}

export async function categoryRevenueToPdfBytes(
  rows: CategoryRevenueRow[],
  dateRange: { from: Date; to: Date }
): Promise<Uint8Array> {
  return docToBytes(React.createElement(CategoryRevenueDoc, { rows, dateRange }));
}

function StaffMetricsDoc({
  rows,
  dateRange,
}: {
  rows: StaffMetric[];
  dateRange: { from: Date; to: Date };
}) {
  const dateLabel = `${dateRange.from.toLocaleDateString()} – ${dateRange.to.toLocaleDateString()}`;
  return (
    <Document>
      <Page size="A4" style={styles.page}>
        <ReportHeader title="Staff Performance Report" date={dateLabel} />
        <View style={styles.tableHeader}>
          <Text style={styles.cell}>Staff Member</Text>
          <Text style={styles.cellRight}>Revenue</Text>
          <Text style={styles.cellRight}>Transactions</Text>
          <Text style={styles.cellRight}>Avg Check</Text>
          <Text style={styles.cellRight}>Voids</Text>
        </View>
        {rows.map((r, i) => (
          <View key={r.staffId} style={[styles.row, i % 2 === 1 ? styles.rowAlt : {}]}>
            <Text style={styles.cell}>{r.staffName}</Text>
            <Text style={styles.cellRight}>{fmt(r.revenue)}</Text>
            <Text style={styles.cellRight}>{String(r.transactionCount)}</Text>
            <Text style={styles.cellRight}>{fmt(r.avgCheckSize)}</Text>
            <Text style={styles.cellRight}>{String(r.voidCount)}</Text>
          </View>
        ))}
      </Page>
    </Document>
  );
}

export async function staffMetricsToPdfBytes(
  rows: StaffMetric[],
  dateRange: { from: Date; to: Date }
): Promise<Uint8Array> {
  return docToBytes(React.createElement(StaffMetricsDoc, { rows, dateRange }));
}

function StaffTipsDoc({
  rows,
  dateRange,
}: {
  rows: StaffTips[];
  dateRange: { from: Date; to: Date };
}) {
  const dateLabel = `${dateRange.from.toLocaleDateString()} – ${dateRange.to.toLocaleDateString()}`;
  return (
    <Document>
      <Page size="A4" style={styles.page}>
        <ReportHeader title="Tip Distribution Report" date={dateLabel} />
        <View style={styles.tableHeader}>
          <Text style={styles.cell}>Staff Member</Text>
          <Text style={styles.cellRight}>Total Tips</Text>
        </View>
        {rows.map((r, i) => (
          <View key={r.staffId} style={[styles.row, i % 2 === 1 ? styles.rowAlt : {}]}>
            <Text style={styles.cell}>{r.staffName}</Text>
            <Text style={styles.cellRight}>{fmt(r.totalTips)}</Text>
          </View>
        ))}
      </Page>
    </Document>
  );
}

export async function staffTipsToPdfBytes(
  rows: StaffTips[],
  dateRange: { from: Date; to: Date }
): Promise<Uint8Array> {
  return docToBytes(React.createElement(StaffTipsDoc, { rows, dateRange }));
}

// Phase 8 S6-08 PDF builders

function ComboMixDoc({
  rows,
  dateRange,
}: {
  rows: ComboMixRow[];
  dateRange: { from: Date; to: Date };
}) {
  const dateLabel = `${dateRange.from.toLocaleDateString()} – ${dateRange.to.toLocaleDateString()}`;
  return (
    <Document>
      <Page size="A4" style={styles.page}>
        <ReportHeader title="Combo Mix Report" date={dateLabel} />
        <View style={styles.tableHeader}>
          <Text style={styles.cell}>Date</Text>
          <Text style={styles.cell}>Combo</Text>
          <Text style={styles.cellRight}>Units</Text>
          <Text style={styles.cellRight}>Revenue</Text>
          <Text style={styles.cellRight}>Avg Price</Text>
          <Text style={styles.cellRight}>Overrides</Text>
        </View>
        {rows.map((r, i) => (
          <View key={`${r.date}-${r.comboProductId}`} style={[styles.row, i % 2 === 1 ? styles.rowAlt : {}]}>
            <Text style={styles.cell}>{r.date}</Text>
            <Text style={styles.cell}>{r.comboName}</Text>
            <Text style={styles.cellRight}>{String(r.qtySold)}</Text>
            <Text style={styles.cellRight}>{fmt(r.netRevenue)}</Text>
            <Text style={styles.cellRight}>{fmt(r.avgPrice)}</Text>
            <Text style={styles.cellRight}>{String(r.overrideCount)}</Text>
          </View>
        ))}
      </Page>
    </Document>
  );
}

export async function comboMixToPdfBytes(
  rows: ComboMixRow[],
  dateRange: { from: Date; to: Date }
): Promise<Uint8Array> {
  return docToBytes(React.createElement(ComboMixDoc, { rows, dateRange }));
}

function RecipeVarianceDoc({
  rows,
  dateRange,
}: {
  rows: RecipeVarianceRow[];
  dateRange: { from: Date; to: Date };
}) {
  const dateLabel = `${dateRange.from.toLocaleDateString()} – ${dateRange.to.toLocaleDateString()}`;
  return (
    <Document>
      <Page size="A4" style={styles.page}>
        <ReportHeader title="Recipe Variance Report" date={dateLabel} />
        <View style={styles.tableHeader}>
          <Text style={styles.cell}>Date</Text>
          <Text style={styles.cell}>Ingredient</Text>
          <Text style={styles.cellRight}>Theoretical</Text>
          <Text style={styles.cellRight}>Delta</Text>
          <Text style={styles.cellRight}>Variance %</Text>
        </View>
        {rows.map((r, i) => (
          <View key={`${r.date}-${r.ingredientId}`} style={[styles.row, i % 2 === 1 ? styles.rowAlt : {}]}>
            <Text style={styles.cell}>{r.date}</Text>
            <Text style={styles.cell}>{r.ingredientName}</Text>
            <Text style={styles.cellRight}>{String(r.theoreticalUsed)}</Text>
            <Text style={styles.cellRight}>{String(r.physicalDelta)}</Text>
            <Text style={styles.cellRight}>{String(r.variancePct)}%</Text>
          </View>
        ))}
      </Page>
    </Document>
  );
}

export async function recipeVarianceToPdfBytes(
  rows: RecipeVarianceRow[],
  dateRange: { from: Date; to: Date }
): Promise<Uint8Array> {
  return docToBytes(React.createElement(RecipeVarianceDoc, { rows, dateRange }));
}

function WaitlistMetricsDoc({
  rows,
  dateRange,
}: {
  rows: WaitlistMetricsRow[];
  dateRange: { from: Date; to: Date };
}) {
  const dateLabel = `${dateRange.from.toLocaleDateString()} – ${dateRange.to.toLocaleDateString()}`;
  return (
    <Document>
      <Page size="A4" style={styles.page}>
        <ReportHeader title="Waitlist Analytics Report" date={dateLabel} />
        <View style={styles.tableHeader}>
          <Text style={styles.cell}>Date</Text>
          <Text style={styles.cellRight}>Parties Seated</Text>
          <Text style={styles.cellRight}>Avg Quoted (min)</Text>
          <Text style={styles.cellRight}>Avg Actual (min)</Text>
          <Text style={styles.cellRight}>No-Show %</Text>
        </View>
        {rows.map((r, i) => (
          <View key={r.date} style={[styles.row, i % 2 === 1 ? styles.rowAlt : {}]}>
            <Text style={styles.cell}>{r.date}</Text>
            <Text style={styles.cellRight}>{String(r.partiesSeated)}</Text>
            <Text style={styles.cellRight}>{r.avgQuotedWait !== null ? String(r.avgQuotedWait) : '—'}</Text>
            <Text style={styles.cellRight}>{r.avgActualWait !== null ? String(r.avgActualWait) : '—'}</Text>
            <Text style={styles.cellRight}>{r.noShowRate !== null ? String(r.noShowRate) : '—'}</Text>
          </View>
        ))}
      </Page>
    </Document>
  );
}

export async function waitlistMetricsToPdfBytes(
  rows: WaitlistMetricsRow[],
  dateRange: { from: Date; to: Date }
): Promise<Uint8Array> {
  return docToBytes(React.createElement(WaitlistMetricsDoc, { rows, dateRange }));
}

function RefundsRegisterDoc({
  rows,
  dateRange,
}: {
  rows: RefundRegisterRow[];
  dateRange: { from: Date; to: Date };
}) {
  const dateLabel = `${dateRange.from.toLocaleDateString()} – ${dateRange.to.toLocaleDateString()}`;
  return (
    <Document>
      <Page size="A4" style={styles.page}>
        <ReportHeader title="Refunds Register" date={dateLabel} />
        <View style={styles.tableHeader}>
          <Text style={styles.cell}>Date</Text>
          <Text style={styles.cell}>Operator</Text>
          <Text style={styles.cellRight}>Amount</Text>
          <Text style={styles.cell}>Reason</Text>
          <Text style={styles.cellRight}>Restock</Text>
        </View>
        {rows.map((r, i) => (
          <View key={r.id} style={[styles.row, i % 2 === 1 ? styles.rowAlt : {}]}>
            <Text style={styles.cell}>{new Date(r.date).toLocaleDateString()}</Text>
            <Text style={styles.cell}>{r.operatorName}</Text>
            <Text style={styles.cellRight}>{fmt(r.amount)}</Text>
            <Text style={styles.cell}>{r.reason}</Text>
            <Text style={styles.cellRight}>{String(r.restockCount)}</Text>
          </View>
        ))}
      </Page>
    </Document>
  );
}

export async function refundsRegisterToPdfBytes(
  rows: RefundRegisterRow[],
  dateRange: { from: Date; to: Date }
): Promise<Uint8Array> {
  return docToBytes(React.createElement(RefundsRegisterDoc, { rows, dateRange }));
}
