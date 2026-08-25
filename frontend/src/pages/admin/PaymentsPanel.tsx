import { useEffect, useState } from 'react';
import * as Icons from 'lucide-react';
import { Button } from '../../components/ui/button';
import { Dialog, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '../../components/ui/dialog';
import { FileUpload } from '../../components/ui/file-upload';
import { requestJson, requestForm } from '../../lib/api';

type SellerPayment = {
  seller_id: number;
  name: string;
  email: string;
  business_name: string;
  bank_name: string | null;
  account_holder_name: string | null;
  account_number: string | null;
  branch: string | null;
  pending_eligible_gross: number;
  pending_commission: number;
  pending_eligible_net: number;
  eligible_items_count: number;
  holdings_gross: number;
  holdings_count: number;
  total_settled_gross: number;
  total_commission_paid: number;
  total_settled_net: number;
  available_balance: number;
};

type SettlementLog = {
  id: number;
  seller_id: number;
  gross_amount: number;
  commission_amount: number;
  net_amount: number;
  receipt_url: string;
  created_at: string;
  seller_name: string;
  seller_business_name: string | null;
  items_count: number;
};

type EligibleItem = {
  item_id: number;
  order_id: string;
  product_id: number;
  title: string;
  price: number;
  quantity: number;
  gross_total: number;
  commission: number;
  net_total: number;
  order_date: string;
  shipped_at: string | null;
  is_reviewed: boolean;
  shipped_7d_ago: boolean;
  is_eligible: boolean;
  can_remove: boolean;
  eligibility_type: 'reviewed' | 'shipped_7d' | 'locked';
};

type AdminPaymentsApiResponse = {
  sellers: SellerPayment[];
  settlements: SettlementLog[];
};

type AdminSellerItemsApiResponse = {
  items: EligibleItem[];
};

export function PaymentsPanel({ searchQuery }: { searchQuery: string }) {
  const [sellers, setSellers] = useState<SellerPayment[]>([]);
  const [settlements, setSettlements] = useState<SettlementLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // Default Filter state: 'pending' (Show pending settlements by default as requested!)
  const [statusFilter, setStatusFilter] = useState<'pending' | 'completed' | 'all'>('pending');

  // Settlement Workspace Modal State
  const [settleTarget, setSettleTarget] = useState<SellerPayment | null>(null);
  const [targetItems, setTargetItems] = useState<EligibleItem[]>([]);
  const [selectedItemIds, setSelectedItemIds] = useState<number[]>([]);
  const [loadingItems, setLoadingItems] = useState(false);
  const [receiptFile, setReceiptFile] = useState<File | null>(null);
  const [settleLoading, setSettleLoading] = useState(false);
  const [settleError, setSettleError] = useState('');

  // Receipt Viewer State
  const [selectedReceiptUrl, setSelectedReceiptUrl] = useState<string | null>(null);

  async function loadData() {
    setLoading(true);
    setError('');
    try {
      const response = (await requestJson<AdminPaymentsApiResponse>('/api/admin/payments')) as unknown as AdminPaymentsApiResponse;
      setSellers(response.sellers ?? []);
      setSettlements(response.settlements ?? []);
    } catch (caughtError) {
      setError(caughtError instanceof Error ? caughtError.message : 'Unable to load payment details.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadData();
  }, []);

  // Filter sellers based on tab filter & search query
  const filteredSellers = sellers.filter((s) => {
    // Search Filter
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      const matchSearch =
        s.business_name?.toLowerCase().includes(query) ||
        s.name.toLowerCase().includes(query) ||
        s.email.toLowerCase().includes(query) ||
        s.bank_name?.toLowerCase().includes(query);
      if (!matchSearch) return false;
    }

    // Status Tab Filter
    if (statusFilter === 'pending') {
      return s.eligible_items_count > 0 || s.pending_eligible_net > 0;
    }
    if (statusFilter === 'completed') {
      return s.total_settled_net > 0;
    }

    return true; // 'all'
  });

  // Calculate overview totals
  const totalPendingGrossAll = sellers.reduce((acc, s) => acc + s.pending_eligible_gross, 0);
  const totalPendingCommissionAll = sellers.reduce((acc, s) => acc + s.pending_commission, 0);
  const totalPendingNetAll = sellers.reduce((acc, s) => acc + s.pending_eligible_net, 0);
  const totalSettledNetAll = sellers.reduce((acc, s) => acc + s.total_settled_net, 0);
  const totalCommissionPaidAll = sellers.reduce((acc, s) => acc + s.total_commission_paid, 0);
  const totalHoldingsAll = sellers.reduce((acc, s) => acc + s.holdings_gross, 0);

  const openSettleModal = async (seller: SellerPayment) => {
    setSettleTarget(seller);
    setReceiptFile(null);
    setSettleError('');
    setLoadingItems(true);
    setTargetItems([]);
    setSelectedItemIds([]);

    try {
      const res = (await requestJson<AdminSellerItemsApiResponse>(`/api/admin/payments/seller-items?seller_id=${seller.seller_id}`)) as unknown as AdminSellerItemsApiResponse;
      const items = res.items ?? [];
      setTargetItems(items);

      // By default, select all eligible items (reviewed or shipped 7+ days ago)
      const initialSelected = items.filter((i) => i.is_eligible).map((i) => i.item_id);
      setSelectedItemIds(initialSelected);
    } catch (err) {
      setSettleError(err instanceof Error ? err.message : 'Failed to fetch seller eligible items.');
    } finally {
      setLoadingItems(false);
    }
  };

  const handleToggleItem = (itemId: number) => {
    setSelectedItemIds((prev) =>
      prev.includes(itemId) ? prev.filter((id) => id !== itemId) : [...prev, itemId]
    );
  };

  // Selected calculation
  const selectedItems = targetItems.filter((i) => selectedItemIds.includes(i.item_id));
  const selectedGross = selectedItems.reduce((sum: number, i: EligibleItem) => sum + i.gross_total, 0);
  const selectedCommission = Math.round(selectedGross * 0.10 * 100) / 100;
  const selectedNet = selectedGross - selectedCommission;

  const handleSettleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!settleTarget) return;

    setSettleError('');
    if (selectedItemIds.length === 0 || selectedNet <= 0) {
      setSettleError('Please select at least one eligible product item for settlement.');
      return;
    }
    if (!receiptFile) {
      setSettleError('Bank transfer receipt image is required.');
      return;
    }

    setSettleLoading(true);
    try {
      const form = new FormData();
      form.append('seller_id', settleTarget.seller_id.toString());
      form.append('item_ids', JSON.stringify(selectedItemIds));
      form.append('receipt', receiptFile);

      await requestForm('/api/admin/payments/settle', form);
      setSettleTarget(null);
      await loadData();
    } catch (caughtError) {
      setSettleError(caughtError instanceof Error ? caughtError.message : 'Failed to settle payment.');
    } finally {
      setSettleLoading(false);
    }
  };

  return (
    <div className="space-y-8 animate-in fade-in duration-300">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-aura-600">Admin Control Panel</p>
          <h1 className="mt-2 font-display text-3xl font-bold text-ink-900 md:text-4xl">Sellers Payout Settlements</h1>
          <p className="mt-1 text-sm text-ink-600">
            Process payback settlements for product sellers. Products reviewed by customers or shipped 7+ days ago are eligible. All payouts deduct 10% platform commission.
          </p>
        </div>

        {/* Tab Filters */}
        <div className="flex items-center gap-1.5 rounded-2xl bg-ink-100 p-1.5 self-start md:self-auto">
          <button
            onClick={() => setStatusFilter('pending')}
            className={`flex items-center gap-2 rounded-xl px-4 py-2 text-xs font-bold transition-all ${
              statusFilter === 'pending'
                ? 'bg-white text-ink-900 shadow-sm'
                : 'text-ink-600 hover:text-ink-900 hover:bg-white/50'
            }`}
          >
            <Icons.Clock className="h-3.5 w-3.5 text-amber-600" />
            <span>Pending Payments</span>
            {sellers.filter((s) => s.eligible_items_count > 0).length > 0 && (
              <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-extrabold text-amber-800">
                {sellers.filter((s) => s.eligible_items_count > 0).length}
              </span>
            )}
          </button>

          <button
            onClick={() => setStatusFilter('completed')}
            className={`flex items-center gap-2 rounded-xl px-4 py-2 text-xs font-bold transition-all ${
              statusFilter === 'completed'
                ? 'bg-white text-ink-900 shadow-sm'
                : 'text-ink-600 hover:text-ink-900 hover:bg-white/50'
            }`}
          >
            <Icons.CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" />
            <span>Completed History</span>
          </button>

          <button
            onClick={() => setStatusFilter('all')}
            className={`flex items-center gap-2 rounded-xl px-4 py-2 text-xs font-bold transition-all ${
              statusFilter === 'all'
                ? 'bg-white text-ink-900 shadow-sm'
                : 'text-ink-600 hover:text-ink-900 hover:bg-white/50'
            }`}
          >
            <Icons.Users className="h-3.5 w-3.5 text-indigo-600" />
            <span>All Sellers</span>
          </button>
        </div>
      </div>

      {/* Financial Overview Cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div className="rounded-3xl border border-ink-200 bg-white p-5 shadow-sm">
          <div className="flex items-center gap-3">
            <div className="rounded-2xl bg-amber-50 p-2.5 text-amber-600">
              <Icons.Clock3 className="h-5 w-5" />
            </div>
            <div>
              <span className="text-[10px] font-bold uppercase tracking-wider text-ink-400">Total Pending Net Payback</span>
              <p className="font-display text-lg font-bold text-ink-900">
                LKR {totalPendingNetAll.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </p>
              <p className="text-[11px] text-amber-700 font-medium">Gross: LKR {totalPendingGrossAll.toLocaleString()}</p>
            </div>
          </div>
        </div>

        <div className="rounded-3xl border border-ink-200 bg-white p-5 shadow-sm">
          <div className="flex items-center gap-3">
            <div className="rounded-2xl bg-purple-50 p-2.5 text-purple-600">
              <Icons.Percent className="h-5 w-5" />
            </div>
            <div>
              <span className="text-[10px] font-bold uppercase tracking-wider text-ink-400">Platform Commission (10%)</span>
              <p className="font-display text-lg font-bold text-purple-900">
                LKR {totalCommissionPaidAll.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </p>
              <p className="text-[11px] text-purple-600 font-medium">Pending 10%: LKR {totalPendingCommissionAll.toLocaleString()}</p>
            </div>
          </div>
        </div>

        <div className="rounded-3xl border border-ink-200 bg-white p-5 shadow-sm">
          <div className="flex items-center gap-3">
            <div className="rounded-2xl bg-emerald-50 p-2.5 text-emerald-600">
              <Icons.ShieldCheck className="h-5 w-5" />
            </div>
            <div>
              <span className="text-[10px] font-bold uppercase tracking-wider text-ink-400">Total Paid Out to Sellers</span>
              <p className="font-display text-lg font-bold text-emerald-900">
                LKR {totalSettledNetAll.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </p>
            </div>
          </div>
        </div>

        <div className="rounded-3xl border border-ink-200 bg-white p-5 shadow-sm">
          <div className="flex items-center gap-3">
            <div className="rounded-2xl bg-indigo-50 p-2.5 text-indigo-600">
              <Icons.Lock className="h-5 w-5" />
            </div>
            <div>
              <span className="text-[10px] font-bold uppercase tracking-wider text-ink-400">Holdings (Locked &lt; 7 Days)</span>
              <p className="font-display text-lg font-bold text-ink-900">
                LKR {totalHoldingsAll.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content Layout */}
      <div className="grid gap-6 lg:grid-cols-[1.6fr_0.8fr]">
        
        {/* Left column: Sellers Table */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="font-display text-lg font-bold text-ink-900 flex items-center gap-2">
              <Icons.Users className="h-4 w-4 text-ink-500" />
              {statusFilter === 'pending' ? 'Sellers with Pending Settlements' : statusFilter === 'completed' ? 'Sellers with Completed Settlements' : 'All Product Sellers'} ({filteredSellers.length})
            </h2>
          </div>

          {loading ? (
            <div className="flex h-48 items-center justify-center rounded-3xl border border-ink-200 bg-white p-8">
              <div className="flex flex-col items-center gap-3">
                <div className="h-7 w-7 animate-spin rounded-full border-4 border-aura-200 border-t-aura-600" />
                <p className="text-xs font-semibold text-ink-500">Loading seller balances...</p>
              </div>
            </div>
          ) : error ? (
            <div className="rounded-3xl border border-red-200 bg-red-50 p-6 text-red-700">
              <p className="text-sm font-semibold">{error}</p>
            </div>
          ) : filteredSellers.length === 0 ? (
            <div className="rounded-3xl border border-dashed border-ink-200 bg-white p-12 text-center text-ink-400">
              <Icons.CheckCircle2 className="mx-auto h-10 w-10 text-emerald-500 mb-2" />
              <p className="font-display font-bold text-ink-900">No sellers match the current filter.</p>
              <p className="text-xs text-ink-500 mt-1">Try switching tabs or clearing your search filter.</p>
            </div>
          ) : (
            <div className="space-y-4">
              {filteredSellers.map((seller) => {
                const hasEligible = seller.eligible_items_count > 0 && seller.pending_eligible_net > 0;
                const hasBankDetails = Boolean(seller.bank_name && seller.account_number);

                return (
                  <div
                    key={seller.seller_id}
                    className="rounded-3xl border border-ink-200 bg-white p-6 shadow-sm hover:shadow-md transition space-y-4"
                  >
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-ink-100 pb-4">
                      <div>
                        <div className="flex items-center gap-2">
                          <h3 className="font-display text-lg font-bold text-ink-900">{seller.business_name || seller.name}</h3>
                          <span className="text-xs font-normal text-ink-400">({seller.name})</span>
                        </div>
                        <p className="text-xs text-ink-500">{seller.email}</p>
                      </div>

                      <div className="flex items-center gap-3">
                        <Button
                          disabled={!hasEligible}
                          onClick={() => openSettleModal(seller)}
                          className={`rounded-2xl shadow-sm transition font-bold ${
                            hasEligible
                              ? 'bg-emerald-600 text-white hover:bg-emerald-700'
                              : 'bg-ink-100 text-ink-400 cursor-not-allowed'
                          }`}
                        >
                          <Icons.Coins className="mr-2 h-4 w-4" />
                          {hasEligible ? 'Settle Payment' : 'No Eligible Items'}
                        </Button>
                      </div>
                    </div>

                    {/* Financial stats row */}
                    <div className="grid gap-3 grid-cols-2 sm:grid-cols-4">
                      <div className="rounded-2xl bg-amber-50/70 p-3.5">
                        <span className="text-[10px] font-bold uppercase tracking-wider text-amber-700">Eligible Net Payout</span>
                        <p className="mt-0.5 font-display text-base font-bold text-amber-900">
                          LKR {seller.pending_eligible_net.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </p>
                        <p className="text-[10px] text-amber-700 font-medium">({seller.eligible_items_count} items eligible)</p>
                      </div>

                      <div className="rounded-2xl bg-purple-50/70 p-3.5">
                        <span className="text-[10px] font-bold uppercase tracking-wider text-purple-700">10% Platform Fee</span>
                        <p className="mt-0.5 font-display text-base font-bold text-purple-900">
                          - LKR {seller.pending_commission.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </p>
                        <p className="text-[10px] text-purple-600">Deducted at payout</p>
                      </div>

                      <div className="rounded-2xl bg-slate-50 p-3.5">
                        <span className="text-[10px] font-bold uppercase tracking-wider text-ink-400">Holdings (&lt; 7 Days)</span>
                        <p className="mt-0.5 font-display text-base font-bold text-ink-900">
                          LKR {seller.holdings_gross.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </p>
                        <p className="text-[10px] text-ink-400">({seller.holdings_count} unreviewed items)</p>
                      </div>

                      <div className="rounded-2xl bg-emerald-50/70 p-3.5">
                        <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-700">Total Net Paid Out</span>
                        <p className="mt-0.5 font-display text-base font-bold text-emerald-900">
                          LKR {seller.total_settled_net.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </p>
                      </div>
                    </div>

                    {/* Bank Info summary */}
                    <div className="flex items-center gap-2 rounded-2xl bg-ink-50 p-3 text-xs text-ink-600">
                      <Icons.Landmark className="h-4 w-4 text-ink-400 shrink-0" />
                      {hasBankDetails ? (
                        <span>
                          <strong className="text-ink-900">{seller.bank_name}</strong> | A/C: <strong>{seller.account_number}</strong> ({seller.account_holder_name} - Branch: {seller.branch})
                        </span>
                      ) : (
                        <span className="text-amber-600 font-semibold flex items-center gap-1">
                          <Icons.AlertTriangle className="h-3.5 w-3.5" />
                          No bank details registered by seller yet.
                        </span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Right column: Recent Settlement Log */}
        <div className="space-y-4">
          <h2 className="font-display text-lg font-bold text-ink-900 flex items-center gap-2">
            <Icons.Receipt className="h-4 w-4 text-ink-500" />
            Recent Settlement Logs
          </h2>

          <div className="rounded-3xl border border-ink-200 bg-white p-5 shadow-sm">
            {settlements.length === 0 ? (
              <p className="py-8 text-center text-xs text-ink-400">No payout settlements recorded yet.</p>
            ) : (
              <div className="space-y-4 max-h-[650px] overflow-y-auto pr-1">
                {settlements.map((log) => (
                  <div key={log.id} className="rounded-2xl border border-ink-100 bg-ink-50/50 p-4 space-y-2">
                    <div className="flex items-start justify-between">
                      <div>
                        <p className="font-bold text-sm text-ink-900">{log.seller_business_name || log.seller_name}</p>
                        <p className="text-[11px] text-ink-400">{new Date(log.created_at).toLocaleString()}</p>
                      </div>
                      <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-bold text-emerald-800">
                        Paid
                      </span>
                    </div>

                    <div className="flex items-center justify-between border-t border-ink-100/80 pt-2 text-xs">
                      <div>
                        <span className="text-[10px] uppercase font-bold text-ink-400 block">Net Paid</span>
                        <span className="font-bold text-emerald-600 font-display">LKR {log.net_amount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                      </div>
                      <div className="text-right">
                        <span className="text-[10px] uppercase font-bold text-purple-600 block">10% Fee</span>
                        <span className="font-medium text-purple-700">LKR {log.commission_amount.toLocaleString()}</span>
                      </div>
                    </div>

                    <button
                      onClick={() => setSelectedReceiptUrl(log.receipt_url)}
                      className="mt-1 w-full inline-flex items-center justify-center gap-1 rounded-xl bg-white border border-ink-200 py-1.5 text-xs font-semibold text-aura-700 hover:bg-aura-50 transition"
                    >
                      <Icons.FileText className="h-3.5 w-3.5" />
                      View Bank Receipt
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

      </div>

      {/* Settle Payment Modal Workspace */}
      <Dialog isOpen={Boolean(settleTarget)} onClose={() => setSettleTarget(null)}>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Icons.Coins className="h-5 w-5 text-emerald-600" />
            <span>Settle Payment for {settleTarget?.business_name || settleTarget?.name}</span>
          </DialogTitle>
          <DialogDescription>
            Review eligible order items, customize item selection, inspect 10% commission calculations, and upload the bank transfer receipt.
          </DialogDescription>
        </DialogHeader>

        {settleTarget && (
          <form onSubmit={handleSettleSubmit} className="space-y-4 py-2 overflow-y-auto max-h-[70vh] pr-1">
            {/* Notice / Rules Alert */}
            <div className="rounded-2xl border border-amber-200 bg-amber-50/80 p-4 text-xs text-amber-900 space-y-1">
              <p className="font-bold flex items-center gap-1.5 text-amber-950">
                <Icons.AlertCircle className="h-4 w-4 text-amber-700" />
                Payback Settlement & Optional Product Selection:
              </p>
              <p className="leading-relaxed">
                • <strong>All products below are optional</strong>. You can mark or unmark any reviewed product or non-reviewed product (shipped 7+ days ago).<br />
                • Unmarked products will remain pending for future settlement payouts.<br />
                • All settlements deduct a <strong>10% platform commission</strong>.
              </p>
            </div>

            {settleError && (
              <div className="rounded-2xl bg-red-50 p-3 text-xs font-semibold text-red-600">
                {settleError}
              </div>
            )}

            {/* Bank Account Summary */}
            <div className="rounded-2xl border border-ink-200 bg-ink-50 p-4 space-y-1.5">
              <span className="text-[10px] font-bold uppercase tracking-wider text-ink-400 block">Destination Bank Account:</span>
              {settleTarget.bank_name ? (
                <div className="grid gap-2 sm:grid-cols-2 text-xs">
                  <div><strong className="text-ink-900">Bank:</strong> {settleTarget.bank_name}</div>
                  <div><strong className="text-ink-900">Holder:</strong> {settleTarget.account_holder_name}</div>
                  <div><strong className="text-ink-900">Account:</strong> {settleTarget.account_number}</div>
                  <div><strong className="text-ink-900">Branch:</strong> {settleTarget.branch}</div>
                </div>
              ) : (
                <p className="text-xs font-bold text-red-600">Warning: Seller has not provided bank details yet.</p>
              )}
            </div>

            {/* Eligible Items Selection Table */}
            <div className="space-y-2">
              <div className="flex items-center justify-between text-xs font-bold text-ink-900">
                <span>Select Products to Settle ({selectedItemIds.length} / {targetItems.length} selected)</span>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setSelectedItemIds(targetItems.filter((i) => i.is_eligible).map((i) => i.item_id))}
                    className="text-[11px] font-semibold text-aura-600 hover:underline"
                  >
                    Select All
                  </button>
                  <span className="text-ink-300">|</span>
                  <button
                    type="button"
                    onClick={() => setSelectedItemIds([])}
                    className="text-[11px] font-semibold text-ink-500 hover:underline"
                  >
                    Unselect All
                  </button>
                </div>
              </div>

              {loadingItems ? (
                <div className="flex h-32 items-center justify-center rounded-2xl border border-ink-200 bg-white">
                  <div className="flex items-center gap-2 text-xs font-semibold text-ink-500">
                    <Icons.Loader2 className="h-4 w-4 animate-spin" />
                    <span>Loading order items...</span>
                  </div>
                </div>
              ) : targetItems.length === 0 ? (
                <div className="rounded-2xl border border-dashed border-ink-200 p-6 text-center text-xs text-ink-400">
                  No pending order items available for this seller.
                </div>
              ) : (
                <div className="max-h-52 overflow-y-auto rounded-2xl border border-ink-200 bg-white divide-y divide-ink-100">
                  {targetItems.map((item) => {
                    const isSelected = selectedItemIds.includes(item.item_id);

                    return (
                      <div
                        key={item.item_id}
                        onClick={() => handleToggleItem(item.item_id)}
                        className={`flex items-center justify-between p-3 cursor-pointer text-xs transition select-none ${
                          isSelected ? 'bg-emerald-50/50 font-medium' : 'hover:bg-ink-50/60 opacity-60'
                        }`}
                      >
                        <div className="flex items-center gap-3">
                          <input
                            type="checkbox"
                            checked={isSelected}
                            onChange={() => {}}
                            className="h-4 w-4 rounded border-ink-300 text-emerald-600 focus:ring-emerald-500 cursor-pointer pointer-events-none"
                          />
                          <div>
                            <p className="font-bold text-ink-900">{item.title}</p>
                            <p className="text-[11px] text-ink-400 font-mono">
                              Order {item.order_id} • Qty: {item.quantity} • Date: {new Date(item.order_date).toLocaleDateString()}
                            </p>
                          </div>
                        </div>


                        <div className="flex items-center gap-3">
                          {item.is_reviewed ? (
                            <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-bold text-emerald-800">
                              Reviewed
                            </span>
                          ) : item.shipped_7d_ago ? (
                            <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-bold text-amber-800">
                              Shipped &gt; 7d (Unreviewed)
                            </span>
                          ) : (
                            <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-semibold text-slate-600">
                              Locked (&lt; 7d)
                            </span>
                          )}

                          <div className="text-right">
                            <p className="font-bold text-ink-900">LKR {item.gross_total.toLocaleString()}</p>
                            <p className="text-[10px] text-emerald-600 font-semibold">Net: LKR {item.net_total.toLocaleString()}</p>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Financial Math Summary Box */}
            <div className="rounded-2xl border border-emerald-200 bg-emerald-50/60 p-4 space-y-2">
              <div className="flex justify-between text-xs text-ink-600">
                <span>Gross Product Total ({selectedItemIds.length} items):</span>
                <span className="font-bold text-ink-900">LKR {selectedGross.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
              </div>
              <div className="flex justify-between text-xs text-purple-700 font-medium">
                <span>Platform Commission Deduction (10%):</span>
                <span>- LKR {selectedCommission.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
              </div>
              <div className="border-t border-emerald-200 pt-2 flex justify-between text-sm font-bold text-emerald-900">
                <span>Net Amount to Transfer to Seller Bank:</span>
                <span className="font-display text-base text-emerald-600">
                  LKR {selectedNet.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </span>
              </div>
            </div>

            {/* Receipt File Uploader */}
            <div className="space-y-1">
              <label className="text-xs font-bold text-ink-900 block">Bank Transfer Receipt Image *</label>
              <FileUpload
                id="receipt-file-input"
                label="Bank Receipt"
                accept="image/*"
                maxSize={5}
                onChange={setReceiptFile}
              />
              <p className="text-[11px] text-ink-400">Upload screenshot or PDF proof of the bank transfer payment.</p>
            </div>

            <DialogFooter className="mt-4 pt-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => setSettleTarget(null)}
                disabled={settleLoading}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={settleLoading || selectedItemIds.length === 0 || !receiptFile}
                className="bg-emerald-600 text-white hover:bg-emerald-700 font-bold"
              >
                {settleLoading ? 'Processing Settlement...' : `Confirm & Pay LKR ${selectedNet.toLocaleString()}`}
              </Button>
            </DialogFooter>
          </form>
        )}

      </Dialog>

      {/* Receipt Preview Modal */}
      {selectedReceiptUrl && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in duration-200">
          <div className="relative max-w-2xl w-full rounded-3xl bg-white p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-ink-100 pb-3">
              <h3 className="font-display font-bold text-lg text-ink-900 flex items-center gap-2">
                <Icons.FileText className="h-5 w-5 text-aura-600" />
                Bank Transfer Receipt Proof
              </h3>
              <button
                onClick={() => setSelectedReceiptUrl(null)}
                className="rounded-full p-1.5 text-ink-400 hover:bg-ink-100 hover:text-ink-900 transition"
              >
                <Icons.X className="h-5 w-5" />
              </button>
            </div>

            <div className="max-h-[70vh] overflow-auto rounded-2xl bg-ink-50 p-2 flex items-center justify-center">
              <img
                src={selectedReceiptUrl}
                alt="Bank Receipt"
                className="max-h-[65vh] w-auto object-contain rounded-xl shadow-md"
              />
            </div>

            <div className="flex justify-end gap-3 pt-2">
              <a
                href={selectedReceiptUrl}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1.5 rounded-xl bg-ink-100 px-4 py-2 text-xs font-bold text-ink-800 hover:bg-ink-200 transition"
              >
                <Icons.ExternalLink className="h-3.5 w-3.5" />
                Open Full Image
              </a>
              <Button onClick={() => setSelectedReceiptUrl(null)} className="rounded-xl">
                Close
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
