import { useEffect, useState } from 'react';
import * as Icons from 'lucide-react';
import { Button } from '../../components/ui/button';
import { Dialog, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '../../components/ui/dialog';
import { FileUpload } from '../../components/ui/file-upload';
import { Input } from '../../components/ui/input';
import { Label } from '../../components/ui/label';
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
  total_revenue: number;
  holdings: number;
  releaseable: number;
  total_settled: number;
  available_balance: number;
};

type SettlementLog = {
  id: number;
  seller_id: number;
  amount: number;
  receipt_url: string;
  created_at: string;
  seller_name: string;
  seller_business_name: string | null;
};

export function PaymentsPanel({ searchQuery }: { searchQuery: string }) {
  const [sellers, setSellers] = useState<SellerPayment[]>([]);
  const [settlements, setSettlements] = useState<SettlementLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // Settlement Form Modal State
  const [settleTarget, setSettleTarget] = useState<SellerPayment | null>(null);
  const [settleAmount, setSettleAmount] = useState('');
  const [receiptFile, setReceiptFile] = useState<File | null>(null);
  const [settleLoading, setSettleLoading] = useState(false);
  const [settleError, setSettleError] = useState('');

  async function loadData() {
    setLoading(true);
    setError('');
    try {
      const response = await requestJson<{ sellers: SellerPayment[]; settlements: SettlementLog[] }>('/api/admin/payments');
      setSellers((response as any).sellers ?? []);
      setSettlements((response as any).settlements ?? []);
    } catch (caughtError) {
      setError(caughtError instanceof Error ? caughtError.message : 'Unable to load payment details.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadData();
  }, []);

  // Filter sellers by search query
  const filteredSellers = sellers.filter((s) => {
    if (!searchQuery) return true;
    const query = searchQuery.toLowerCase();
    return (
      s.business_name?.toLowerCase().includes(query) ||
      s.name.toLowerCase().includes(query) ||
      s.email.toLowerCase().includes(query) ||
      s.bank_name?.toLowerCase().includes(query)
    );
  });

  // Calculate overview totals
  const totalRevenueAll = sellers.reduce((acc, s) => acc + s.total_revenue, 0);
  const totalHoldingsAll = sellers.reduce((acc, s) => acc + s.holdings, 0);
  const totalReleaseableAll = sellers.reduce((acc, s) => acc + s.releaseable, 0);
  const totalSettledAll = sellers.reduce((acc, s) => acc + s.total_settled, 0);
  const totalAvailableAll = sellers.reduce((acc, s) => acc + s.available_balance, 0);

  const openSettleModal = (seller: SellerPayment) => {
    setSettleTarget(seller);
    setSettleAmount(seller.available_balance.toFixed(2));
    setReceiptFile(null);
    setSettleError('');
    setSettleLoading(false);
  };

  const handleSettleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!settleTarget) return;

    setSettleError('');
    const amt = parseFloat(settleAmount);
    if (isNaN(amt) || amt <= 0) {
      setSettleError('Please enter a valid amount.');
      return;
    }
    if (amt > settleTarget.available_balance) {
      setSettleError(`Amount cannot exceed the available releaseable balance of LKR ${settleTarget.available_balance.toLocaleString()}`);
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
      form.append('amount', amt.toString());
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
      <div>
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-aura-600">Admin Panel</p>
        <h1 className="mt-2 font-display text-3xl font-bold text-ink-900 md:text-4xl">Sellers Payout Settlements</h1>
        <p className="mt-1 text-sm text-ink-600">
          Verify shipped orders, manage locked holdings (7 days), and settle available revenues with bank transfer receipts.
        </p>
      </div>

      {/* Financial Overview Cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div className="rounded-3xl border border-ink-200 bg-white p-5 shadow-sm">
          <div className="flex items-center gap-3">
            <div className="rounded-2xl bg-indigo-50 p-2.5 text-indigo-600">
              <Icons.Coins className="h-5 w-5" />
            </div>
            <div>
              <span className="text-[10px] font-bold uppercase tracking-wider text-ink-400">Total Revenue (GMV)</span>
              <p className="font-display text-lg font-bold text-ink-900">LKR {totalRevenueAll.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p>
            </div>
          </div>
        </div>

        <div className="rounded-3xl border border-ink-200 bg-white p-5 shadow-sm">
          <div className="flex items-center gap-3">
            <div className="rounded-2xl bg-amber-50 p-2.5 text-amber-600">
              <Icons.Clock3 className="h-5 w-5" />
            </div>
            <div>
              <span className="text-[10px] font-bold uppercase tracking-wider text-ink-400">Holdings (Locked)</span>
              <p className="font-display text-lg font-bold text-ink-900">LKR {totalHoldingsAll.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p>
            </div>
          </div>
        </div>

        <div className="rounded-3xl border border-ink-200 bg-white p-5 shadow-sm">
          <div className="flex items-center gap-3">
            <div className="rounded-2xl bg-emerald-50 p-2.5 text-emerald-600">
              <Icons.ShieldCheck className="h-5 w-5" />
            </div>
            <div>
              <span className="text-[10px] font-bold uppercase tracking-wider text-ink-400">Available to Settle</span>
              <p className="font-display text-lg font-bold text-ink-900">LKR {totalAvailableAll.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p>
            </div>
          </div>
        </div>

        <div className="rounded-3xl border border-ink-200 bg-white p-5 shadow-sm">
          <div className="flex items-center gap-3">
            <div className="rounded-2xl bg-blue-50 p-2.5 text-blue-600">
              <Icons.CheckCircle2 className="h-5 w-5" />
            </div>
            <div>
              <span className="text-[10px] font-bold uppercase tracking-wider text-ink-400">Total Paid Out</span>
              <p className="font-display text-lg font-bold text-ink-900">LKR {totalSettledAll.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Main Grid */}
      <div className="grid gap-6 lg:grid-cols-[1.6fr_0.8fr]">
        
        {/* Left column: Sellers List */}
        <div className="space-y-4">
          <h2 className="font-display text-lg font-bold text-ink-900 flex items-center gap-2">
            <Icons.Users className="h-4 w-4 text-ink-500" />
            Product Seller Accounts ({filteredSellers.length})
          </h2>

          {loading && (
            <div className="flex items-center gap-3 text-sm text-ink-600 p-4">
              <div className="h-4 w-4 animate-spin rounded-full border-2 border-ink-200 border-t-ink-600" />
              Loading seller profiles...
            </div>
          )}

          {error && <p className="text-sm font-medium text-red-600">{error}</p>}

          {!loading && filteredSellers.length === 0 && (
            <div className="rounded-3xl border border-dashed border-ink-200 bg-white p-8 text-center text-sm text-ink-500">
              No matching product sellers found.
            </div>
          )}

          {filteredSellers.map((s) => (
            <div key={s.seller_id} className="rounded-3xl border border-ink-200 bg-white p-6 shadow-sm flex flex-col md:flex-row justify-between gap-6 transition hover:shadow-md">
              
              {/* Left Side: Seller Identity & Bank details */}
              <div className="space-y-4 flex-1">
                <div>
                  <h3 className="font-display text-base font-bold text-ink-900">{s.business_name || s.name}</h3>
                  <p className="text-xs text-ink-500">{s.name} · {s.email}</p>
                </div>

                <div className="rounded-2xl bg-ink-50 p-4 border border-ink-100 space-y-2">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-ink-400 block border-b border-ink-200 pb-1">Sri Lankan Bank Account Details</span>
                  {s.bank_name ? (
                    <div className="grid grid-cols-2 gap-2 text-xs text-ink-800">
                      <div><strong className="text-ink-500 block">Bank</strong>{s.bank_name}</div>
                      <div><strong className="text-ink-500 block">Holder</strong>{s.account_holder_name}</div>
                      <div><strong className="text-ink-500 block">Account No</strong>{s.account_number}</div>
                      <div><strong className="text-ink-500 block">Branch</strong>{s.branch}</div>
                    </div>
                  ) : (
                    <p className="text-xs italic text-ink-500">No bank details registered.</p>
                  )}
                </div>
              </div>

              {/* Right Side: Ledger Balance and Actions */}
              <div className="w-full md:w-64 flex flex-col justify-between items-stretch border-t md:border-t-0 md:border-l border-ink-100 pt-4 md:pt-0 md:pl-6 shrink-0">
                <div className="space-y-1.5 text-xs text-ink-700">
                  <div className="flex justify-between">
                    <span>Total Revenue:</span>
                    <strong className="text-ink-900">LKR {s.total_revenue.toLocaleString()}</strong>
                  </div>
                  <div className="flex justify-between text-amber-600 font-medium">
                    <span className="flex items-center gap-1">
                      Holdings Locked: 
                      <span className="cursor-help text-[10px] border border-amber-300 rounded-full px-1 hover:bg-amber-100" title="Locked for 7 days since shipment date.">?</span>
                    </span>
                    <span>LKR {s.holdings.toLocaleString()}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Total Settled:</span>
                    <span>LKR {s.total_settled.toLocaleString()}</span>
                  </div>
                  <div className="border-t border-dashed border-ink-200 my-2 pt-1.5 flex justify-between text-sm">
                    <span className="font-semibold text-ink-800">Available:</span>
                    <strong className="text-emerald-600 font-display">LKR {s.available_balance.toLocaleString()}</strong>
                  </div>
                </div>

                <div className="mt-4">
                  {s.available_balance > 0 ? (
                    <Button
                      onClick={() => openSettleModal(s)}
                      className="w-full rounded-2xl text-xs bg-emerald-600 text-white hover:bg-emerald-700 shadow-sm"
                    >
                      <Icons.Landmark className="mr-1.5 h-3.5 w-3.5" />
                      Settle Balance
                    </Button>
                  ) : (
                    <div className="w-full text-center py-2.5 rounded-2xl bg-ink-50 border border-ink-100 text-xs font-semibold text-ink-400 italic">
                      Fully Settled
                    </div>
                  )}
                </div>
              </div>

            </div>
          ))}
        </div>

        {/* Right column: Recent Settlements Log */}
        <div className="space-y-4">
          <h2 className="font-display text-lg font-bold text-ink-900 flex items-center gap-2">
            <Icons.History className="h-4 w-4 text-ink-500" />
            Payout History
          </h2>

          <div className="rounded-3xl border border-ink-200 bg-white p-5 shadow-sm space-y-4 max-h-[70vh] overflow-y-auto pr-1">
            {settlements.length === 0 && (
              <p className="text-xs text-ink-500 text-center py-6">No payouts settled yet.</p>
            )}

            {settlements.map((log) => (
              <div key={log.id} className="border-b border-ink-100 last:border-0 pb-3 last:pb-0 text-xs space-y-1">
                <div className="flex justify-between items-start">
                  <div>
                    <h4 className="font-bold text-ink-900">{log.seller_business_name || log.seller_name}</h4>
                    <p className="text-[10px] text-ink-400">{new Date(log.created_at).toLocaleString()}</p>
                  </div>
                  <strong className="text-emerald-700 font-semibold font-display">LKR {log.amount.toLocaleString()}</strong>
                </div>
                <div className="flex justify-between items-center pt-1.5">
                  <span className="text-[10px] text-ink-500 italic">Settled via transfer</span>
                  <a
                    href={log.receipt_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 text-[10px] font-bold text-indigo-600 hover:text-indigo-800"
                  >
                    View Receipt
                    <Icons.ExternalLink className="h-3 w-3" />
                  </a>
                </div>
              </div>
            ))}
          </div>
        </div>

      </div>

      {/* Settle Modal Dialog */}
      <Dialog isOpen={!!settleTarget} onClose={() => setSettleTarget(null)}>
        {settleTarget ? (
          <form onSubmit={handleSettleSubmit}>
            <DialogHeader>
              <div className="mb-2 flex h-12 w-12 items-center justify-center rounded-2xl bg-emerald-100 text-emerald-600">
                <Icons.Landmark className="h-6 w-6" />
              </div>
              <DialogTitle>Settle Balance Payout</DialogTitle>
              <DialogDescription>
                Transfer funds to the seller's bank account, then upload the receipt screenshot below to record the settlement.
              </DialogDescription>
            </DialogHeader>

            <div className="mt-4 space-y-4">
              
              {/* Bank Details Card */}
              <div className="rounded-2xl border border-ink-200 bg-ink-50/50 p-4 text-xs space-y-1.5">
                <span className="font-bold text-ink-900 block border-b border-ink-200 pb-1 mb-2 uppercase tracking-wide">Destination Bank Account</span>
                <div className="grid grid-cols-2 gap-2 text-ink-800">
                  <div><strong className="text-ink-500 block">Bank Name:</strong>{settleTarget.bank_name}</div>
                  <div><strong className="text-ink-500 block">Holder Name:</strong>{settleTarget.account_holder_name}</div>
                  <div><strong className="text-ink-500 block">Account Number:</strong>{settleTarget.account_number}</div>
                  <div><strong className="text-ink-500 block">Branch Name:</strong>{settleTarget.branch}</div>
                </div>
              </div>

              {/* Amount input */}
              <div className="space-y-1.5">
                <Label htmlFor="settle-amount">Settlement Amount (LKR)</Label>
                <Input
                  id="settle-amount"
                  type="number"
                  step="0.01"
                  min="0.01"
                  max={settleTarget.available_balance}
                  value={settleAmount}
                  onChange={(e) => setSettleAmount(e.target.value)}
                  required
                />
                <p className="text-[10px] text-ink-500">
                  Available releaseable balance: <strong>LKR {settleTarget.available_balance.toLocaleString()}</strong>
                </p>
              </div>

              {/* Bank Receipt File Upload */}
              <div className="space-y-1.5">
                <FileUpload
                  id="bank-receipt"
                  label="Bank Transfer Receipt Screenshot (Image)"
                  accept="image/*"
                  onChange={(file) => setReceiptFile(file)}
                  onError={(err) => setSettleError(err)}
                />
              </div>

              {settleError && (
                <p className="text-xs font-semibold text-red-600">{settleError}</p>
              )}
            </div>

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setSettleTarget(null)} disabled={settleLoading}>
                Cancel
              </Button>
              <Button type="submit" className="bg-emerald-600 text-white hover:bg-emerald-700" disabled={settleLoading || !receiptFile}>
                {settleLoading ? 'Processing Settle...' : 'Confirm Settle'}
              </Button>
            </DialogFooter>
          </form>
        ) : null}
      </Dialog>

    </div>
  );
}
