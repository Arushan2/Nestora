import React, { useEffect, useState } from 'react';
import { requestJson } from '../../lib/api';
import { exportAnalyticsPDF } from '../../lib/analyticsExport';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../../components/ui/tabs';
import {
  Area, AreaChart, ResponsiveContainer, Tooltip, XAxis, YAxis,
  Bar, BarChart, Legend, CartesianGrid, PieChart, Pie, Cell
} from 'recharts';

type AnalyticsOverview = {
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

type ChartDataPoint = {
  date: string;
  profile_view: number;
  product_view: number;
  service_view: number;
  cart_add: number;
  favourite_add: number;
  portfolio_view: number;
  contact_click: number;
  checkout_initiated: number;
  orders_count: number;
  inquiries_count: number;
};

type AnalyticsData = {
  overview: AnalyticsOverview;
  orders_breakdown: { status: string; count: number; total_amount: string }[];
  inquiries_breakdown: Record<string, number>;
  sales_by_category: { category: string; revenue: string }[];
  review_sentiment: Record<string, number>;
  chart_data: ChartDataPoint[];
};

const COLORS = ['#8b5cf6', '#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#64748b'];

export function AnalyticsDashboard() {
  const [data, setData] = useState<AnalyticsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  
  const [timeRange, setTimeRange] = useState<'7d' | '30d' | '90d' | 'ytd'>('30d');

  useEffect(() => {
    async function fetchAnalytics() {
      setLoading(true);
      setError('');
      try {
        const end = new Date();
        const start = new Date();
        if (timeRange === '7d') start.setDate(end.getDate() - 7);
        else if (timeRange === '30d') start.setDate(end.getDate() - 30);
        else if (timeRange === '90d') start.setDate(end.getDate() - 90);
        else if (timeRange === 'ytd') start.setMonth(0, 1);

        const startDateStr = start.toISOString().split('T')[0];
        const endDateStr = end.toISOString().split('T')[0];

        const response = await requestJson<AnalyticsData>(
          `/api/analytics/dashboard?start_date=${startDateStr}&end_date=${endDateStr}`
        );
        setData(response as unknown as AnalyticsData);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load analytics');
      } finally {
        setLoading(false);
      }
    }
    void fetchAnalytics();
  }, [timeRange]);

  if (loading) {
    return (
      <div className="flex h-[400px] items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-aura-200 border-t-aura-600" />
          <p className="text-sm font-semibold text-ink-500 animate-pulse">Aggregating comprehensive metrics...</p>
        </div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="rounded-3xl border border-dashed border-red-200 bg-red-50/50 p-8 text-center">
        <p className="text-red-600 font-semibold">{error || 'Failed to load data.'}</p>
      </div>
    );
  }

  const { overview, chart_data, orders_breakdown, sales_by_category, review_sentiment, inquiries_breakdown } = data;

  const totalViews = overview.total_profile_views + overview.total_product_views + overview.total_service_views + overview.total_portfolio_views;

  const orderStatusData = orders_breakdown.map(o => ({
    name: o.status,
    value: parseInt(o.count as unknown as string, 10)
  }));

  const salesCategoryData = sales_by_category.map(s => ({
    name: s.category || 'Uncategorized',
    value: parseFloat(s.revenue)
  }));

  const sentimentData = Object.entries(review_sentiment).map(([rating, count]) => ({
    name: `${rating} Star${rating === '1' ? '' : 's'}`,
    value: parseInt(count as unknown as string, 10)
  }));

  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      return (
        <div className="bg-white/95 backdrop-blur border border-ink-100 shadow-xl rounded-xl p-3 text-xs">
          <p className="font-bold text-ink-900 mb-2 border-b border-ink-50 pb-1">{label}</p>
          {payload.map((entry: any, index: number) => (
            <div key={index} className="flex justify-between items-center gap-4 py-0.5">
              <span style={{ color: entry.color }} className="font-semibold">{entry.name}</span>
              <span className="font-bold text-ink-900">{entry.value}</span>
            </div>
          ))}
        </div>
      );
    }
    return null;
  };

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-white/60 p-4 rounded-2xl border border-ink-100 shadow-sm backdrop-blur">
        <div>
          <h2 className="text-2xl font-bold font-display text-ink-900">Comprehensive Analytics</h2>
          <p className="text-ink-500 text-xs mt-0.5 font-medium">Deep insights into your performance & revenue.</p>
        </div>
        <div className="flex items-center gap-3">
          <select
            value={timeRange}
            onChange={(e) => setTimeRange(e.target.value as any)}
            className="rounded-full border border-ink-200 bg-white px-4 py-2 text-xs font-bold text-ink-700 shadow-sm focus:border-aura-500 focus:outline-none focus:ring-1 focus:ring-aura-500"
          >
            <option value="7d">Last 7 Days</option>
            <option value="30d">Last 30 Days</option>
            <option value="90d">Last 90 Days</option>
            <option value="ytd">Year to Date</option>
          </select>
          <button
            onClick={() => {
              if (data) {
                exportAnalyticsPDF({
                  overview: data.overview,
                  orders_breakdown: data.orders_breakdown,
                  inquiries_breakdown: data.inquiries_breakdown,
                  sales_by_category: data.sales_by_category,
                  review_sentiment: data.review_sentiment,
                  timeRange,
                });
              }
            }}
            className="rounded-full bg-ink-900 px-4 py-2 text-xs font-bold text-white hover:bg-ink-800 transition-colors shadow-sm"
          >
            Export PDF
          </button>
        </div>
      </div>

      <Tabs defaultValue="overview" className="w-full">
        <TabsList className="grid w-full grid-cols-4 rounded-xl bg-ink-50/50 p-1 border border-ink-100">
          <TabsTrigger value="overview" className="rounded-lg text-xs font-bold data-[state=active]:bg-white data-[state=active]:text-aura-600 data-[state=active]:shadow-sm">Overview</TabsTrigger>
          <TabsTrigger value="financials" className="rounded-lg text-xs font-bold data-[state=active]:bg-white data-[state=active]:text-emerald-600 data-[state=active]:shadow-sm">Financials</TabsTrigger>
          <TabsTrigger value="audience" className="rounded-lg text-xs font-bold data-[state=active]:bg-white data-[state=active]:text-blue-600 data-[state=active]:shadow-sm">Audience & Traffic</TabsTrigger>
          <TabsTrigger value="engagement" className="rounded-lg text-xs font-bold data-[state=active]:bg-white data-[state=active]:text-amber-600 data-[state=active]:shadow-sm">Engagement</TabsTrigger>
        </TabsList>

        {/* OVERVIEW TAB */}
        <TabsContent value="overview" className="space-y-6 mt-6">
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <Card className="bg-gradient-to-br from-white to-aura-50/30 border-ink-150 shadow-sm hover:border-aura-300 transition-colors">
              <CardHeader className="pb-2">
                <CardTitle className="text-[10px] font-bold text-ink-500 uppercase tracking-widest">Total Traffic</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-display font-bold text-ink-900">{totalViews.toLocaleString()}</div>
                <p className="text-[10px] text-aura-600 font-semibold mt-1">Across all assets</p>
              </CardContent>
            </Card>

            <Card className="bg-gradient-to-br from-white to-emerald-50/30 border-ink-150 shadow-sm hover:border-emerald-300 transition-colors">
              <CardHeader className="pb-2">
                <CardTitle className="text-[10px] font-bold text-ink-500 uppercase tracking-widest">GMV (Revenue)</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-display font-bold text-emerald-600">LKR {overview.total_revenue.toLocaleString()}</div>
                <p className="text-[10px] text-emerald-700 font-semibold mt-1">Cleared & Pending</p>
              </CardContent>
            </Card>

            <Card className="bg-gradient-to-br from-white to-blue-50/30 border-ink-150 shadow-sm hover:border-blue-300 transition-colors">
              <CardHeader className="pb-2">
                <CardTitle className="text-[10px] font-bold text-ink-500 uppercase tracking-widest">Completed Orders</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-display font-bold text-blue-600">{overview.total_orders}</div>
                <p className="text-[10px] text-blue-700 font-semibold mt-1">{overview.total_checkout_initiated} Checkouts Initiated</p>
              </CardContent>
            </Card>

            <Card className="bg-gradient-to-br from-white to-amber-50/30 border-ink-150 shadow-sm hover:border-amber-300 transition-colors">
              <CardHeader className="pb-2">
                <CardTitle className="text-[10px] font-bold text-ink-500 uppercase tracking-widest">Total Inquiries</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-display font-bold text-amber-600">{overview.total_inquiries}</div>
                <p className="text-[10px] text-amber-700 font-semibold mt-1">Direct Leads</p>
              </CardContent>
            </Card>
          </div>

          <Card className="border-ink-150 shadow-sm overflow-hidden">
            <CardHeader className="border-b border-ink-50 bg-white/50 pb-4">
              <CardTitle className="text-sm font-bold text-ink-900">Revenue & Traffic Velocity</CardTitle>
            </CardHeader>
            <CardContent className="pt-6">
              <div className="h-[350px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={chart_data} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                    <defs>
                      <linearGradient id="colorTraffic" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#8b5cf6" stopOpacity={0.3} />
                        <stop offset="95%" stopColor="#8b5cf6" stopOpacity={0} />
                      </linearGradient>
                      <linearGradient id="colorOrders" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#10b981" stopOpacity={0.3} />
                        <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                    <XAxis dataKey="date" tickFormatter={(val) => new Date(val).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })} axisLine={false} tickLine={false} tick={{ fill: '#64748b', fontSize: 10 }} dy={10} />
                    <YAxis axisLine={false} tickLine={false} tick={{ fill: '#64748b', fontSize: 10 }} />
                    <Tooltip content={<CustomTooltip />} />
                    <Legend iconType="circle" wrapperStyle={{ fontSize: '11px', paddingTop: '10px' }} />
                    <Area type="monotone" name="Traffic (Views)" dataKey={(d) => d.profile_view + d.product_view + d.service_view + d.portfolio_view} stroke="#8b5cf6" strokeWidth={3} fillOpacity={1} fill="url(#colorTraffic)" />
                    <Area type="monotone" name="Orders/Sales" dataKey="orders_count" stroke="#10b981" strokeWidth={3} fillOpacity={1} fill="url(#colorOrders)" />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* FINANCIALS TAB */}
        <TabsContent value="financials" className="space-y-6 mt-6">
          <div className="grid gap-4 sm:grid-cols-3">
            <Card className="border-ink-150 shadow-sm col-span-2">
              <CardHeader className="border-b border-ink-50 bg-white/50 pb-4">
                <CardTitle className="text-sm font-bold text-ink-900">Sales by Category</CardTitle>
              </CardHeader>
              <CardContent className="pt-6">
                <div className="h-[300px] w-full flex items-center justify-center">
                  {salesCategoryData.length > 0 ? (
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie data={salesCategoryData} cx="50%" cy="50%" innerRadius={70} outerRadius={100} paddingAngle={2} dataKey="value" label={({ name, percent }: any) => `${name} ${((percent ?? 0) * 100).toFixed(0)}%`} labelLine={false}>
                          {salesCategoryData.map((entry, index) => (
                            <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                          ))}
                        </Pie>
                        <Tooltip formatter={(value: any) => `LKR ${Number(value).toLocaleString()}`} />
                      </PieChart>
                    </ResponsiveContainer>
                  ) : (
                    <p className="text-xs text-ink-400 italic">No sales data available for this period.</p>
                  )}
                </div>
              </CardContent>
            </Card>

            <div className="space-y-4">
              <Card className="border-ink-150 shadow-sm bg-gradient-to-br from-emerald-50/50 to-white">
                <CardHeader className="pb-2">
                  <CardTitle className="text-[10px] font-bold text-emerald-700 uppercase tracking-widest">Average Order Value (AOV)</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-display font-bold text-emerald-600">LKR {overview.aov.toLocaleString(undefined, { maximumFractionDigits: 0 })}</div>
                </CardContent>
              </Card>

              <Card className="border-ink-150 shadow-sm flex-1">
                <CardHeader className="border-b border-ink-50 bg-white/50 pb-3">
                  <CardTitle className="text-xs font-bold text-ink-900">Order Status Breakdown</CardTitle>
                </CardHeader>
                <CardContent className="pt-4 space-y-3">
                  {orderStatusData.length > 0 ? orderStatusData.map((status, idx) => (
                    <div key={idx} className="flex justify-between items-center text-xs">
                      <span className="font-semibold text-ink-600">{status.name}</span>
                      <span className="font-bold text-ink-900 bg-ink-100 px-2 py-0.5 rounded-full">{status.value}</span>
                    </div>
                  )) : (
                    <p className="text-[10px] text-ink-400">No orders placed.</p>
                  )}
                </CardContent>
              </Card>
            </div>
          </div>
        </TabsContent>

        {/* AUDIENCE TAB */}
        <TabsContent value="audience" className="space-y-6 mt-6">
          <Card className="border-ink-150 shadow-sm">
            <CardHeader className="border-b border-ink-50 bg-white/50 pb-4">
              <CardTitle className="text-sm font-bold text-ink-900">Audience Discovery Over Time</CardTitle>
            </CardHeader>
            <CardContent className="pt-6">
              <div className="h-[300px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={chart_data} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                    <XAxis dataKey="date" tickFormatter={(val) => new Date(val).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })} axisLine={false} tickLine={false} tick={{ fill: '#64748b', fontSize: 10 }} dy={10} />
                    <YAxis axisLine={false} tickLine={false} tick={{ fill: '#64748b', fontSize: 10 }} />
                    <Tooltip content={<CustomTooltip />} />
                    <Legend iconType="circle" wrapperStyle={{ fontSize: '11px', paddingTop: '10px' }} />
                    <Area type="monotone" name="Product Views" dataKey="product_view" stackId="1" stroke="#3b82f6" fill="#3b82f6" />
                    <Area type="monotone" name="Service Views" dataKey="service_view" stackId="1" stroke="#8b5cf6" fill="#8b5cf6" />
                    <Area type="monotone" name="Profile Views" dataKey="profile_view" stackId="1" stroke="#f59e0b" fill="#f59e0b" />
                    <Area type="monotone" name="Portfolio Views" dataKey="portfolio_view" stackId="1" stroke="#10b981" fill="#10b981" />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ENGAGEMENT TAB */}
        <TabsContent value="engagement" className="space-y-6 mt-6">
          <div className="grid gap-6 lg:grid-cols-2">
            
            {/* Funnel */}
            <Card className="border-ink-150 shadow-sm">
              <CardHeader className="border-b border-ink-50 bg-white/50 pb-4">
                <CardTitle className="text-sm font-bold text-ink-900">Sales Conversion Funnel</CardTitle>
              </CardHeader>
              <CardContent className="pt-6 space-y-4">
                {[
                  { label: 'Total Views', value: totalViews, color: 'bg-blue-500' },
                  { label: 'Favorites', value: overview.total_favorites, color: 'bg-purple-500' },
                  { label: 'Added to Cart', value: overview.total_cart_adds, color: 'bg-amber-500' },
                  { label: 'Checkout Initiated', value: overview.total_checkout_initiated, color: 'bg-orange-500' },
                  { label: 'Orders Completed', value: overview.total_orders, color: 'bg-emerald-500' },
                ].map((step, idx, arr) => {
                  const maxVal = arr[0].value || 1;
                  const percentage = Math.max(2, (step.value / maxVal) * 100);
                  const dropOff = idx > 0 ? (arr[idx - 1].value > 0 ? Math.round((step.value / arr[idx - 1].value) * 100) : 0) : 100;
                  return (
                    <div key={step.label} className="relative pt-1">
                      <div className="flex justify-between items-end mb-1">
                        <span className="text-xs font-bold text-ink-700">{step.label}</span>
                        <div className="text-right">
                          <span className="text-xs font-bold text-ink-900">{step.value}</span>
                          {idx > 0 && <span className="text-[9px] text-ink-400 ml-2 font-semibold">({dropOff}% from prev)</span>}
                        </div>
                      </div>
                      <div className="overflow-hidden h-3 flex rounded-full bg-ink-100">
                        <div style={{ width: `${percentage}%` }} className={`shadow-none flex flex-col text-center whitespace-nowrap text-white justify-center ${step.color} transition-all duration-1000 ease-out`}></div>
                      </div>
                    </div>
                  );
                })}
              </CardContent>
            </Card>

            <div className="space-y-6">
              {/* Contact Interactions */}
              <Card className="border-ink-150 shadow-sm">
                <CardHeader className="border-b border-ink-50 bg-white/50 pb-3">
                  <CardTitle className="text-xs font-bold text-ink-900">Contact Interactions</CardTitle>
                </CardHeader>
                <CardContent className="pt-5 flex items-center justify-between">
                  <div>
                    <p className="text-[10px] font-bold text-ink-500 uppercase tracking-widest">Phone & Email Clicks</p>
                    <div className="text-3xl font-display font-bold text-aura-600 mt-1">{overview.total_contact_clicks}</div>
                  </div>
                  <div className="h-12 w-12 rounded-full bg-aura-100 flex items-center justify-center text-aura-600">
                    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" /></svg>
                  </div>
                </CardContent>
              </Card>

              {/* Review Sentiment */}
              <Card className="border-ink-150 shadow-sm">
                <CardHeader className="border-b border-ink-50 bg-white/50 pb-3">
                  <CardTitle className="text-xs font-bold text-ink-900">Review Sentiment</CardTitle>
                </CardHeader>
                <CardContent className="pt-4 space-y-3">
                  {sentimentData.length > 0 ? sentimentData.sort((a,b) => b.name.localeCompare(a.name)).map((s, idx) => (
                    <div key={idx} className="flex justify-between items-center text-xs">
                      <span className="font-semibold text-ink-600 flex items-center gap-1">
                        {s.name} <svg className="w-3 h-3 text-amber-400 fill-current" viewBox="0 0 20 20"><path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" /></svg>
                      </span>
                      <span className="font-bold text-ink-900 bg-amber-50 text-amber-700 px-2 py-0.5 rounded-full border border-amber-100">{s.value}</span>
                    </div>
                  )) : (
                    <p className="text-[10px] text-ink-400">No reviews received yet.</p>
                  )}
                </CardContent>
              </Card>
            </div>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
