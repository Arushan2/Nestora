import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

type ExportData = {
  overview: {
    total_profile_views: number;
    total_product_views: number;
    total_service_views: number;
    total_portfolio_views: number;
    total_favorites: number;
    total_cart_adds: number;
    total_contact_clicks: number;
    total_checkout_initiated: number;
    total_orders: number;
    total_revenue: number;
    total_inquiries: number;
    aov: number;
  };
  orders_breakdown: { status: string; count: number; total_amount: string }[];
  inquiries_breakdown: Record<string, number>;
  sales_by_category: { category: string; revenue: string }[];
  review_sentiment: Record<string, number>;
  timeRange: string;
};

// Nestora brand colors
const BRAND = {
  aura: [139, 92, 246] as [number, number, number],     // #8b5cf6
  auraDark: [109, 40, 217] as [number, number, number],  // #6d28d9
  ink900: [15, 23, 42] as [number, number, number],      // #0f172a
  ink700: [51, 65, 85] as [number, number, number],      // #334155
  ink500: [100, 116, 139] as [number, number, number],   // #64748b
  ink200: [226, 232, 240] as [number, number, number],   // #e2e8f0
  ink50: [248, 250, 252] as [number, number, number],    // #f8fafc
  emerald: [16, 185, 129] as [number, number, number],   // #10b981
  white: [255, 255, 255] as [number, number, number],
};

function formatCurrency(value: number): string {
  return `LKR ${value.toLocaleString(undefined, { maximumFractionDigits: 0 })}`;
}

function getTimeRangeLabel(tr: string): string {
  switch (tr) {
    case '7d': return 'Last 7 Days';
    case '30d': return 'Last 30 Days';
    case '90d': return 'Last 90 Days';
    case 'ytd': return 'Year to Date';
    default: return tr;
  }
}

export function exportAnalyticsPDF(data: ExportData): void {
  const doc = new jsPDF('p', 'mm', 'a4');
  const pageWidth = doc.internal.pageSize.getWidth();
  const margin = 16;
  const contentWidth = pageWidth - margin * 2;
  let y = 0;

  // ─── HEADER BAND ────────────────────────────────────────
  doc.setFillColor(...BRAND.ink900);
  doc.rect(0, 0, pageWidth, 48, 'F');

  // Accent stripe
  doc.setFillColor(...BRAND.aura);
  doc.rect(0, 48, pageWidth, 3, 'F');

  // Logo text
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(22);
  doc.setTextColor(...BRAND.white);
  doc.text('NESTORA', margin, 20);

  // Sub-title
  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(180, 180, 200);
  doc.text('Analytics Performance Report', margin, 28);

  // Date range badge
  const rangeLabel = getTimeRangeLabel(data.timeRange);
  doc.setFontSize(9);
  doc.setTextColor(...BRAND.white);
  const dateStr = `Period: ${rangeLabel}  •  Generated: ${new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}`;
  doc.text(dateStr, margin, 38);

  y = 60;

  // ─── KPI SECTION TITLE ──────────────────────────────────
  doc.setFillColor(...BRAND.ink50);
  doc.roundedRect(margin, y - 4, contentWidth, 10, 2, 2, 'F');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  doc.setTextColor(...BRAND.aura);
  doc.text('KEY PERFORMANCE INDICATORS', margin + 4, y + 3);
  y += 14;

  // ─── KPI CARDS ──────────────────────────────────────────
  const totalViews = data.overview.total_profile_views + data.overview.total_product_views +
    data.overview.total_service_views + data.overview.total_portfolio_views;

  const kpis = [
    { label: 'Total Traffic', value: totalViews.toLocaleString(), sub: 'All page views' },
    { label: 'Revenue (GMV)', value: formatCurrency(data.overview.total_revenue), sub: 'Gross Merchandise Value' },
    { label: 'Completed Orders', value: data.overview.total_orders.toString(), sub: `${data.overview.total_checkout_initiated} checkouts` },
    { label: 'Inquiries', value: data.overview.total_inquiries.toString(), sub: 'Direct leads' },
  ];

  const cardWidth = (contentWidth - 12) / 4;
  const cardHeight = 28;

  kpis.forEach((kpi, i) => {
    const x = margin + i * (cardWidth + 4);

    // Card background
    doc.setFillColor(...BRAND.white);
    doc.setDrawColor(...BRAND.ink200);
    doc.roundedRect(x, y, cardWidth, cardHeight, 2, 2, 'FD');

    // Colored top edge
    const topColor = i === 1 ? BRAND.emerald : BRAND.aura;
    doc.setFillColor(...topColor);
    doc.rect(x, y, cardWidth, 1.5, 'F');

    // Label
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(6.5);
    doc.setTextColor(...BRAND.ink500);
    doc.text(kpi.label.toUpperCase(), x + 4, y + 8);

    // Value
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(13);
    doc.setTextColor(...BRAND.ink900);
    doc.text(kpi.value, x + 4, y + 18);

    // Sub text
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(5.5);
    doc.setTextColor(...BRAND.ink500);
    doc.text(kpi.sub, x + 4, y + 24);
  });

  y += cardHeight + 10;

  // ─── SECONDARY METRICS ROW ──────────────────────────────
  const secondaryKpis = [
    { label: 'Avg. Order Value', value: formatCurrency(data.overview.aov) },
    { label: 'Favorites', value: data.overview.total_favorites.toString() },
    { label: 'Cart Adds', value: data.overview.total_cart_adds.toString() },
    { label: 'Contact Clicks', value: data.overview.total_contact_clicks.toString() },
  ];

  const smCardW = (contentWidth - 12) / 4;
  secondaryKpis.forEach((kpi, i) => {
    const x = margin + i * (smCardW + 4);
    doc.setFillColor(245, 243, 255); // light aura
    doc.roundedRect(x, y, smCardW, 16, 2, 2, 'F');

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(6);
    doc.setTextColor(...BRAND.ink500);
    doc.text(kpi.label.toUpperCase(), x + 4, y + 6);

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10);
    doc.setTextColor(...BRAND.ink900);
    doc.text(kpi.value, x + 4, y + 13);
  });

  y += 24;

  // ─── TRAFFIC BREAKDOWN TABLE ────────────────────────────
  doc.setFillColor(...BRAND.ink50);
  doc.roundedRect(margin, y - 4, contentWidth, 10, 2, 2, 'F');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  doc.setTextColor(...BRAND.aura);
  doc.text('AUDIENCE BREAKDOWN', margin + 4, y + 3);
  y += 12;

  autoTable(doc, {
    startY: y,
    margin: { left: margin, right: margin },
    head: [['Source', 'Views', '% of Total']],
    body: [
      ['Product Listings', data.overview.total_product_views.toString(), totalViews > 0 ? `${((data.overview.total_product_views / totalViews) * 100).toFixed(1)}%` : '0%'],
      ['Service Listings', data.overview.total_service_views.toString(), totalViews > 0 ? `${((data.overview.total_service_views / totalViews) * 100).toFixed(1)}%` : '0%'],
      ['Profile Page', data.overview.total_profile_views.toString(), totalViews > 0 ? `${((data.overview.total_profile_views / totalViews) * 100).toFixed(1)}%` : '0%'],
      ['Portfolio', data.overview.total_portfolio_views.toString(), totalViews > 0 ? `${((data.overview.total_portfolio_views / totalViews) * 100).toFixed(1)}%` : '0%'],
    ],
    theme: 'plain',
    headStyles: {
      fillColor: BRAND.ink900,
      textColor: BRAND.white,
      fontStyle: 'bold',
      fontSize: 7.5,
      cellPadding: 3,
    },
    bodyStyles: {
      fontSize: 7.5,
      textColor: BRAND.ink700,
      cellPadding: 3,
    },
    alternateRowStyles: {
      fillColor: [248, 250, 252],
    },
    columnStyles: {
      0: { fontStyle: 'bold', cellWidth: 60 },
      1: { halign: 'center', cellWidth: 40 },
      2: { halign: 'center', cellWidth: 40 },
    },
  });

  y = (doc as any).lastAutoTable.finalY + 10;

  // ─── CONVERSION FUNNEL (2×2 Grid) ────────────────────────
  doc.setFillColor(...BRAND.ink50);
  doc.roundedRect(margin, y - 4, contentWidth, 10, 2, 2, 'F');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  doc.setTextColor(...BRAND.aura);
  doc.text('SALES CONVERSION FUNNEL', margin + 4, y + 3);
  y += 14;

  const funnelSteps = [
    { label: 'Total Views', value: totalViews, icon: '👁' },
    { label: 'Favorites', value: data.overview.total_favorites, icon: '♥' },
    { label: 'Added to Cart', value: data.overview.total_cart_adds, icon: '🛒' },
    { label: 'Checkout Initiated', value: data.overview.total_checkout_initiated, icon: '💳' },
    { label: 'Orders Completed', value: data.overview.total_orders, icon: '✓' },
  ];

  const maxFunnelVal = funnelSteps[0].value || 1;
  const fCardGap = 5;
  const fCardW = (contentWidth - fCardGap) / 2;
  const fCardH = 18;

  const drawFunnelCard = (step: typeof funnelSteps[0], i: number, cx: number, cy: number) => {
    const dropOff = i > 0 && funnelSteps[i - 1].value > 0
      ? Math.round((step.value / funnelSteps[i - 1].value) * 100)
      : 100;

    const r = Math.round(BRAND.aura[0] + (BRAND.emerald[0] - BRAND.aura[0]) * (i / (funnelSteps.length - 1)));
    const g = Math.round(BRAND.aura[1] + (BRAND.emerald[1] - BRAND.aura[1]) * (i / (funnelSteps.length - 1)));
    const b = Math.round(BRAND.aura[2] + (BRAND.emerald[2] - BRAND.aura[2]) * (i / (funnelSteps.length - 1)));

    // Card
    doc.setFillColor(...BRAND.white);
    doc.setDrawColor(...BRAND.ink200);
    doc.roundedRect(cx, cy, fCardW, fCardH, 2, 2, 'FD');

    // Left accent
    doc.setFillColor(r, g, b);
    doc.rect(cx, cy + 2, 1.5, fCardH - 4, 'F');

    // Label
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(6);
    doc.setTextColor(...BRAND.ink500);
    doc.text(`${i + 1}. ${step.label}`, cx + 6, cy + 6.5);

    // Value
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(11);
    doc.setTextColor(...BRAND.ink900);
    doc.text(step.value.toLocaleString(), cx + 6, cy + 14);

    // Drop-off
    if (i > 0) {
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(6);
      doc.setTextColor(r, g, b);
      doc.text(`${dropOff}%`, cx + fCardW - 6, cy + 14, { align: 'right' });
    }
  };

  // Row 1
  drawFunnelCard(funnelSteps[0], 0, margin, y);
  drawFunnelCard(funnelSteps[1], 1, margin + fCardW + fCardGap, y);
  y += fCardH + fCardGap;

  // Row 2
  drawFunnelCard(funnelSteps[2], 2, margin, y);
  drawFunnelCard(funnelSteps[3], 3, margin + fCardW + fCardGap, y);
  y += fCardH + fCardGap;

  // Row 3 — centered
  const centerX = margin + (contentWidth - fCardW) / 2;
  drawFunnelCard(funnelSteps[4], 4, centerX, y);
  y += fCardH + 8;

  // ─── ORDERS BREAKDOWN TABLE ─────────────────────────────
  if (data.orders_breakdown.length > 0) {
    // Check if we need a new page
    if (y > 240) {
      doc.addPage();
      y = 20;
    }

    doc.setFillColor(...BRAND.ink50);
    doc.roundedRect(margin, y - 4, contentWidth, 10, 2, 2, 'F');
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9);
    doc.setTextColor(...BRAND.aura);
    doc.text('ORDER STATUS BREAKDOWN', margin + 4, y + 3);
    y += 12;

    autoTable(doc, {
      startY: y,
      margin: { left: margin, right: margin },
      head: [['Status', 'Count', 'Total Amount']],
      body: data.orders_breakdown.map(o => [
        o.status,
        o.count.toString(),
        formatCurrency(parseFloat(o.total_amount)),
      ]),
      theme: 'plain',
      headStyles: {
        fillColor: BRAND.ink900,
        textColor: BRAND.white,
        fontStyle: 'bold',
        fontSize: 7.5,
        cellPadding: 3,
      },
      bodyStyles: {
        fontSize: 7.5,
        textColor: BRAND.ink700,
        cellPadding: 3,
      },
      alternateRowStyles: {
        fillColor: [248, 250, 252],
      },
      columnStyles: {
        0: { fontStyle: 'bold' },
        1: { halign: 'center' },
        2: { halign: 'right' },
      },
    });

    y = (doc as any).lastAutoTable.finalY + 10;
  }

  // ─── SALES BY CATEGORY TABLE ────────────────────────────
  if (data.sales_by_category.length > 0) {
    if (y > 240) {
      doc.addPage();
      y = 20;
    }

    doc.setFillColor(...BRAND.ink50);
    doc.roundedRect(margin, y - 4, contentWidth, 10, 2, 2, 'F');
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9);
    doc.setTextColor(...BRAND.aura);
    doc.text('REVENUE BY CATEGORY', margin + 4, y + 3);
    y += 12;

    const totalCategoryRevenue = data.sales_by_category.reduce((s, c) => s + parseFloat(c.revenue), 0);

    autoTable(doc, {
      startY: y,
      margin: { left: margin, right: margin },
      head: [['Category', 'Revenue', '% Share']],
      body: data.sales_by_category.map(c => [
        c.category || 'Uncategorized',
        formatCurrency(parseFloat(c.revenue)),
        totalCategoryRevenue > 0 ? `${((parseFloat(c.revenue) / totalCategoryRevenue) * 100).toFixed(1)}%` : '0%',
      ]),
      theme: 'plain',
      headStyles: {
        fillColor: BRAND.emerald,
        textColor: BRAND.white,
        fontStyle: 'bold',
        fontSize: 7.5,
        cellPadding: 3,
      },
      bodyStyles: {
        fontSize: 7.5,
        textColor: BRAND.ink700,
        cellPadding: 3,
      },
      alternateRowStyles: {
        fillColor: [236, 253, 245],
      },
      columnStyles: {
        0: { fontStyle: 'bold' },
        1: { halign: 'right' },
        2: { halign: 'center' },
      },
    });

    y = (doc as any).lastAutoTable.finalY + 10;
  }

  // ─── REVIEW SENTIMENT ───────────────────────────────────
  const sentimentEntries = Object.entries(data.review_sentiment);
  if (sentimentEntries.length > 0) {
    if (y > 250) {
      doc.addPage();
      y = 20;
    }

    doc.setFillColor(...BRAND.ink50);
    doc.roundedRect(margin, y - 4, contentWidth, 10, 2, 2, 'F');
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9);
    doc.setTextColor(...BRAND.aura);
    doc.text('REVIEW SENTIMENT', margin + 4, y + 3);
    y += 12;

    autoTable(doc, {
      startY: y,
      margin: { left: margin, right: margin },
      head: [['Rating', 'Count']],
      body: sentimentEntries
        .sort((a, b) => parseInt(b[0]) - parseInt(a[0]))
        .map(([rating, count]) => [`${rating} Star${rating === '1' ? '' : 's'} ★`, count.toString()]),
      theme: 'plain',
      headStyles: {
        fillColor: [245, 158, 11],
        textColor: BRAND.white,
        fontStyle: 'bold',
        fontSize: 7.5,
        cellPadding: 3,
      },
      bodyStyles: {
        fontSize: 7.5,
        textColor: BRAND.ink700,
        cellPadding: 3,
      },
      alternateRowStyles: {
        fillColor: [255, 251, 235],
      },
    });

    y = (doc as any).lastAutoTable.finalY + 10;
  }

  // ─── FOOTER ─────────────────────────────────────────────
  const pageCount = doc.getNumberOfPages();
  for (let p = 1; p <= pageCount; p++) {
    doc.setPage(p);
    const pageH = doc.internal.pageSize.getHeight();

    // Footer line
    doc.setDrawColor(...BRAND.ink200);
    doc.line(margin, pageH - 14, pageWidth - margin, pageH - 14);

    // Footer text
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(6);
    doc.setTextColor(...BRAND.ink500);
    doc.text('Nestora Analytics — Confidential Business Report', margin, pageH - 9);
    doc.text(`Page ${p} of ${pageCount}`, pageWidth - margin, pageH - 9, { align: 'right' });
  }

  // ─── SAVE ───────────────────────────────────────────────
  const filename = `Nestora_Analytics_${getTimeRangeLabel(data.timeRange).replace(/\s/g, '_')}_${new Date().toISOString().split('T')[0]}.pdf`;
  doc.save(filename);
}
