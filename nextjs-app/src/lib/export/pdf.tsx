import React from "react";
import {
  Document,
  Page,
  Text,
  View,
  StyleSheet,
  renderToBuffer,
} from "@react-pdf/renderer";

// ── Brand colours ──────────────────────────────────────────────────────────
const C = {
  navy: "#0f172a",
  navyMid: "#1e3a5f",
  cyan: "#06b6d4",
  white: "#ffffff",
  gray50: "#f8fafc",
  gray100: "#f1f5f9",
  gray200: "#e2e8f0",
  gray400: "#94a3b8",
  gray700: "#334155",
  green: "#22c55e",
  orange: "#f97316",
  purple: "#a855f7",
  blue: "#3b82f6",
};

const s = StyleSheet.create({
  page: {
    fontFamily: "Helvetica",
    fontSize: 8,
    backgroundColor: C.white,
    paddingBottom: 48,
  },
  // Header
  header: {
    backgroundColor: C.navy,
    paddingHorizontal: 36,
    paddingTop: 22,
    paddingBottom: 18,
    marginBottom: 18,
  },
  headerTop: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: 8,
  },
  brand: { fontSize: 7, color: C.cyan, letterSpacing: 3 },
  headerDate: { fontSize: 7, color: C.gray400, textAlign: "right" },
  headerTitle: {
    fontSize: 16,
    color: C.white,
    fontFamily: "Helvetica-Bold",
    marginBottom: 3,
  },
  headerOrg: { fontSize: 8, color: C.gray400 },
  // Body
  body: { paddingHorizontal: 36 },
  // Summary boxes
  summaryRow: { flexDirection: "row", gap: 8, marginBottom: 16 },
  summaryBox: {
    flex: 1,
    backgroundColor: C.gray50,
    borderRadius: 4,
    padding: 10,
    borderLeftWidth: 3,
    borderLeftColor: C.cyan,
  },
  summaryLabel: {
    fontSize: 6.5,
    color: C.gray400,
    marginBottom: 3,
    textTransform: "uppercase",
    letterSpacing: 0.8,
  },
  summaryValue: { fontSize: 16, fontFamily: "Helvetica-Bold", color: C.navy },
  summaryUnit: { fontSize: 7, color: C.gray400 },
  // Section
  sectionHeader: {
    backgroundColor: C.navyMid,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 3,
    marginBottom: 4,
    marginTop: 14,
  },
  sectionTitle: {
    fontSize: 8,
    fontFamily: "Helvetica-Bold",
    color: C.white,
    textTransform: "uppercase",
    letterSpacing: 1.2,
  },
  // Table
  tableHeaderRow: {
    flexDirection: "row",
    backgroundColor: C.navyMid,
    marginBottom: 0,
  },
  tableRow: {
    flexDirection: "row",
    borderBottomWidth: 0.5,
    borderBottomColor: C.gray200,
  },
  tableRowEven: { backgroundColor: C.gray50 },
  tableHeaderCell: {
    padding: "5 6",
    fontSize: 7,
    color: C.white,
    fontFamily: "Helvetica-Bold",
    letterSpacing: 0.3,
  },
  tableCell: {
    padding: "4 6",
    fontSize: 7.5,
    color: C.gray700,
  },
  // Badge
  badge: {
    paddingHorizontal: 5,
    paddingVertical: 2,
    borderRadius: 3,
    fontSize: 6.5,
    fontFamily: "Helvetica-Bold",
  },
  // Footer
  footer: {
    position: "absolute",
    bottom: 18,
    left: 36,
    right: 36,
    borderTopWidth: 0.5,
    borderTopColor: C.gray200,
    paddingTop: 5,
    flexDirection: "row",
    justifyContent: "space-between",
  },
  footerText: { fontSize: 6.5, color: C.gray400 },
});

// ── Shared layout components ───────────────────────────────────────────────

function PDFHeader({
  title,
  org,
  subtitle,
}: {
  title: string;
  org: string;
  subtitle?: string;
}) {
  const now = new Date().toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
  return (
    <View style={s.header}>
      <View style={s.headerTop}>
        <Text style={s.brand}>TRANSFORMHUB</Text>
        <Text style={s.headerDate}>{now}</Text>
      </View>
      <Text style={s.headerTitle}>{title}</Text>
      <Text style={s.headerOrg}>
        {org}
        {subtitle ? ` · ${subtitle}` : ""}
      </Text>
    </View>
  );
}

function SummaryBoxes({ boxes }: { boxes: { label: string; value: string; unit?: string }[] }) {
  return (
    <View style={s.summaryRow}>
      {boxes.map((b) => (
        <View key={b.label} style={s.summaryBox}>
          <Text style={s.summaryLabel}>{b.label}</Text>
          <Text style={s.summaryValue}>
            {b.value}
            {b.unit ? <Text style={s.summaryUnit}> {b.unit}</Text> : null}
          </Text>
        </View>
      ))}
    </View>
  );
}

function Section({ title }: { title: string }) {
  return (
    <View style={s.sectionHeader}>
      <Text style={s.sectionTitle}>{title}</Text>
    </View>
  );
}

function PDFTable({
  headers,
  rows,
  flex,
}: {
  headers: string[];
  rows: (string | number | null)[][];
  flex?: number[];
}) {
  const flx = flex ?? headers.map(() => 1);
  return (
    <View>
      <View style={s.tableHeaderRow}>
        {headers.map((h, i) => (
          <Text key={i} style={[s.tableHeaderCell, { flex: flx[i] }]}>
            {h}
          </Text>
        ))}
      </View>
      {rows.map((row, ri) => (
        <View key={ri} style={[s.tableRow, ri % 2 === 0 ? s.tableRowEven : {}]}>
          {row.map((cell, ci) => (
            <Text key={ci} style={[s.tableCell, { flex: flx[ci] }]}>
              {cell == null ? "" : String(cell)}
            </Text>
          ))}
        </View>
      ))}
    </View>
  );
}

function PDFFooter({ org }: { org: string }) {
  return (
    <View style={s.footer} fixed>
      <Text style={s.footerText}>TransformHub · {org} · Confidential</Text>
      <Text
        style={s.footerText}
        render={({ pageNumber, totalPages }) => `Page ${pageNumber} of ${totalPages}`}
      />
    </View>
  );
}

// ── Discovery PDF ──────────────────────────────────────────────────────────

export interface DiscoveryPDFData {
  orgName: string;
  products: {
    name: string;
    segment: string;
    capabilities: {
      name: string;
      category: string;
      functionalities: { name: string }[];
      vsmMetrics: { processTime: number; waitTime: number; flowEfficiency: number }[];
    }[];
  }[];
}

function DiscoveryDoc({ data }: { data: DiscoveryPDFData }) {
  const totalCaps = data.products.reduce((s, p) => s + p.capabilities.length, 0);
  const totalFuncs = data.products.reduce(
    (s, p) => s + p.capabilities.reduce((ss, c) => ss + c.functionalities.length, 0),
    0
  );

  const capRows: (string | number | null)[][] = [];
  for (const prod of data.products) {
    for (const cap of prod.capabilities) {
      const vsm = cap.vsmMetrics[0];
      capRows.push([
        prod.name,
        cap.name,
        cap.category || "—",
        cap.functionalities.length,
        vsm ? vsm.processTime.toFixed(1) : "—",
        vsm ? vsm.waitTime.toFixed(1) : "—",
        vsm ? `${(vsm.flowEfficiency * 100).toFixed(0)}%` : "—",
      ]);
    }
  }

  const funcRows: (string | number | null)[][] = [];
  for (const prod of data.products) {
    for (const cap of prod.capabilities) {
      for (const func of cap.functionalities) {
        funcRows.push([prod.name, cap.name, func.name]);
      }
    }
  }

  return (
    <Document>
      <Page size="A4" orientation="landscape" style={s.page}>
        <PDFHeader
          title="Discovery Report"
          org={data.orgName}
          subtitle={`${data.products.length} Products Analysed`}
        />
        <View style={s.body}>
          <SummaryBoxes
            boxes={[
              { label: "Digital Products", value: String(data.products.length) },
              { label: "Capabilities", value: String(totalCaps) },
              { label: "Functionalities", value: String(totalFuncs) },
            ]}
          />
          <Section title="Products Overview" />
          <PDFTable
            headers={["Product", "Segment", "Capabilities", "Functionalities"]}
            flex={[3, 2, 1, 1]}
            rows={data.products.map((p) => [
              p.name,
              p.segment || "—",
              p.capabilities.length,
              p.capabilities.reduce((s, c) => s + c.functionalities.length, 0),
            ])}
          />
          <Section title="Capabilities" />
          <PDFTable
            headers={["Product", "Capability", "Category", "Funcs", "PT (h)", "WT (h)", "FE%"]}
            flex={[2.5, 2.5, 1.5, 0.6, 0.7, 0.7, 0.7]}
            rows={capRows}
          />
        </View>
        <PDFFooter org={data.orgName} />
      </Page>
      {funcRows.length > 0 && (
        <Page size="A4" orientation="landscape" style={s.page}>
          <PDFHeader title="Discovery Report — Functionalities" org={data.orgName} />
          <View style={s.body}>
            <Section title="Functionalities" />
            <PDFTable
              headers={["Product", "Capability", "Functionality"]}
              flex={[2, 2, 4]}
              rows={funcRows}
            />
          </View>
          <PDFFooter org={data.orgName} />
        </Page>
      )}
    </Document>
  );
}

// ── Workbench PDF ──────────────────────────────────────────────────────────

export interface WorkbenchPDFData {
  orgName: string;
  product: {
    name: string;
    segment: string;
    currentState: string | null;
    capabilities: {
      name: string;
      category: string;
      functionalities: { name: string; description: string | null }[];
      vsmMetrics: { processTime: number; waitTime: number; leadTime: number; flowEfficiency: number }[];
    }[];
  };
  readinessScore: number;
}

function WorkbenchDoc({ data }: { data: WorkbenchPDFData }) {
  const caps = data.product.capabilities;
  const vsmCaps = caps.filter((c) => c.vsmMetrics.length > 0);
  const avgFE =
    vsmCaps.length > 0
      ? vsmCaps.reduce((s, c) => s + c.vsmMetrics[0].flowEfficiency, 0) / vsmCaps.length
      : 0;
  const totalFuncs = caps.reduce((s, c) => s + c.functionalities.length, 0);

  return (
    <Document>
      <Page size="A4" orientation="landscape" style={s.page}>
        <PDFHeader
          title="Product Workbench"
          org={data.orgName}
          subtitle={data.product.name}
        />
        <View style={s.body}>
          <SummaryBoxes
            boxes={[
              { label: "Readiness Score", value: data.readinessScore.toFixed(1), unit: "/ 10" },
              { label: "Capabilities", value: String(caps.length) },
              { label: "Functionalities", value: String(totalFuncs) },
              { label: "Avg Flow Efficiency", value: `${(avgFE * 100).toFixed(0)}%` },
            ]}
          />
          {data.product.currentState && (
            <>
              <Section title="Current State" />
              <Text style={{ fontSize: 7.5, color: C.gray700, marginBottom: 10, lineHeight: 1.5 }}>
                {data.product.currentState}
              </Text>
            </>
          )}
          <Section title="Capabilities & VSM Metrics" />
          <PDFTable
            headers={["Capability", "Category", "Funcs", "PT (h)", "WT (h)", "LT (h)", "FE%"]}
            flex={[3, 1.8, 0.6, 0.8, 0.8, 0.8, 0.8]}
            rows={caps.map((c) => {
              const vsm = c.vsmMetrics[0];
              return [
                c.name,
                c.category || "—",
                c.functionalities.length,
                vsm ? vsm.processTime.toFixed(1) : "—",
                vsm ? vsm.waitTime.toFixed(1) : "—",
                vsm ? vsm.leadTime.toFixed(1) : "—",
                vsm ? `${(vsm.flowEfficiency * 100).toFixed(0)}%` : "—",
              ];
            })}
          />
          <Section title="Functionalities" />
          <PDFTable
            headers={["Capability", "Functionality", "Description"]}
            flex={[2, 2, 4]}
            rows={caps.flatMap((c) =>
              c.functionalities.map((f) => [c.name, f.name, f.description || "—"])
            )}
          />
        </View>
        <PDFFooter org={data.orgName} />
      </Page>
    </Document>
  );
}

// ── Future State PDF ───────────────────────────────────────────────────────

export interface FutureStatePDFData {
  orgName: string;
  productName: string;
  futureCaps: {
    name: string;
    category: string;
    description: string;
    businessImpact: string;
    complexity: string;
    estimatedRoiPct: number | null;
    product_name: string;
  }[];
  futureValueStreams: {
    product_name: string;
    efficiency_gain_pct: number;
    headcount_impact: string;
    future_steps: { name: string; type: string; duration_hours: number }[];
  }[];
}

function catColor(cat: string): string {
  if (cat.includes("AGENT")) return C.purple;
  if (cat.includes("CONVERS")) return C.green;
  if (cat.includes("RPA")) return C.orange;
  if (cat.includes("AI_ML")) return C.blue;
  return C.cyan;
}

function FutureStateDoc({ data }: { data: FutureStatePDFData }) {
  const byProduct = data.futureCaps.reduce<Record<string, typeof data.futureCaps>>(
    (acc, c) => { (acc[c.product_name] = acc[c.product_name] || []).push(c); return acc; },
    {}
  );

  return (
    <Document>
      <Page size="A4" orientation="landscape" style={s.page}>
        <PDFHeader
          title="Future State Vision"
          org={data.orgName}
          subtitle={data.productName !== "All Products" ? data.productName : undefined}
        />
        <View style={s.body}>
          <SummaryBoxes
            boxes={[
              { label: "Future Capabilities", value: String(data.futureCaps.length) },
              {
                label: "Products Covered",
                value: String(Object.keys(byProduct).length),
              },
              {
                label: "Value Streams",
                value: String(data.futureValueStreams.length),
              },
              {
                label: "Avg Efficiency Gain",
                value:
                  data.futureValueStreams.length > 0
                    ? `${(data.futureValueStreams.reduce((s, v) => s + (v.efficiency_gain_pct || 0), 0) / data.futureValueStreams.length).toFixed(0)}%`
                    : "—",
              },
            ]}
          />
          <Section title="Future Capabilities" />
          <PDFTable
            headers={["Product", "Capability", "Category", "Impact", "Complexity", "Est. ROI%"]}
            flex={[2, 3, 1.8, 1, 1, 0.9]}
            rows={data.futureCaps.map((c) => [
              c.product_name,
              c.name,
              c.category.replace(/_/g, " "),
              c.businessImpact,
              c.complexity,
              c.estimatedRoiPct != null ? `${c.estimatedRoiPct.toFixed(0)}%` : "—",
            ])}
          />
          {data.futureValueStreams.length > 0 && (
            <>
              <Section title="Future Value Streams" />
              <PDFTable
                headers={["Product", "Efficiency Gain", "Headcount Impact"]}
                flex={[3, 2, 4]}
                rows={data.futureValueStreams.map((v) => [
                  v.product_name,
                  `${(v.efficiency_gain_pct || 0).toFixed(0)}%`,
                  v.headcount_impact || "—",
                ])}
              />
            </>
          )}
        </View>
        <PDFFooter org={data.orgName} />
      </Page>
    </Document>
  );
}

// ── Roadmap PDF ────────────────────────────────────────────────────────────

export interface RoadmapPDFData {
  orgName: string;
  productName: string;
  items: {
    capabilityName: string;
    category: string;
    description: string | null;
    quarter: string;
    status: string;
    approvalStatus: string;
    riceScore: number;
    itemType: string;
    digitalProduct?: { name: string } | null;
  }[];
}

function RoadmapDoc({ data }: { data: RoadmapPDFData }) {
  const quarters = ["Q1 2026", "Q2 2026", "Q3 2026", "Q4 2026"];
  const caps = data.items.filter((i) => i.itemType === "capability");
  const funcs = data.items.filter((i) => i.itemType === "functionality");

  return (
    <Document>
      <Page size="A4" orientation="landscape" style={s.page}>
        <PDFHeader
          title="Product Roadmap"
          org={data.orgName}
          subtitle={data.productName !== "All Products" ? data.productName : undefined}
        />
        <View style={s.body}>
          <SummaryBoxes
            boxes={[
              { label: "Total Items", value: String(data.items.length) },
              { label: "Capabilities", value: String(caps.length) },
              { label: "Functionalities", value: String(funcs.length) },
              {
                label: "Approved",
                value: `${data.items.filter((i) => i.approvalStatus === "APPROVED").length}`,
              },
            ]}
          />
          <Section title="Timeline Overview" />
          <PDFTable
            headers={["Quarter", "Items", "Capabilities", "Funcs", "Avg RICE", "% Approved"]}
            flex={[1.5, 0.8, 1.2, 0.8, 0.8, 1]}
            rows={quarters.map((q) => {
              const qi = data.items.filter((i) => i.quarter === q);
              const approved = qi.filter((i) => i.approvalStatus === "APPROVED").length;
              return [
                q,
                qi.length,
                qi.filter((i) => i.itemType === "capability").length,
                qi.filter((i) => i.itemType === "functionality").length,
                qi.length > 0 ? (qi.reduce((s, i) => s + i.riceScore, 0) / qi.length).toFixed(1) : "—",
                qi.length > 0 ? `${((approved / qi.length) * 100).toFixed(0)}%` : "—",
              ];
            })}
          />
          {caps.length > 0 && (
            <>
              <Section title="Capability Items" />
              <PDFTable
                headers={["Quarter", "Product", "Category", "Capability", "Status", "Approval", "RICE"]}
                flex={[1, 1.8, 1.5, 3, 1, 1, 0.8]}
                rows={caps.map((i) => [
                  i.quarter,
                  i.digitalProduct?.name || "—",
                  i.category.replace(/_/g, " "),
                  i.capabilityName,
                  i.status,
                  i.approvalStatus,
                  i.riceScore.toFixed(1),
                ])}
              />
            </>
          )}
        </View>
        <PDFFooter org={data.orgName} />
      </Page>
      {funcs.length > 0 && (
        <Page size="A4" orientation="landscape" style={s.page}>
          <PDFHeader title="Product Roadmap — Functionalities" org={data.orgName} />
          <View style={s.body}>
            <Section title="Functionality Items" />
            <PDFTable
              headers={["Quarter", "Product", "Category", "Functionality", "Status", "Approval", "RICE"]}
              flex={[1, 1.8, 1.5, 3, 1, 1, 0.8]}
              rows={funcs.map((i) => [
                i.quarter,
                i.digitalProduct?.name || "—",
                i.category.replace(/_/g, " "),
                i.capabilityName,
                i.status,
                i.approvalStatus,
                i.riceScore.toFixed(1),
              ])}
            />
          </View>
          <PDFFooter org={data.orgName} />
        </Page>
      )}
    </Document>
  );
}

// ── Export helpers ─────────────────────────────────────────────────────────

export async function renderDiscoveryPDF(data: DiscoveryPDFData): Promise<Buffer> {
  return renderToBuffer(<DiscoveryDoc data={data} />);
}

export async function renderWorkbenchPDF(data: WorkbenchPDFData): Promise<Buffer> {
  return renderToBuffer(<WorkbenchDoc data={data} />);
}

export async function renderFutureStatePDF(data: FutureStatePDFData): Promise<Buffer> {
  return renderToBuffer(<FutureStateDoc data={data} />);
}

export async function renderRoadmapPDF(data: RoadmapPDFData): Promise<Buffer> {
  return renderToBuffer(<RoadmapDoc data={data} />);
}
