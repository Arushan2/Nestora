import { useEffect, useState } from 'react';
import { requestJson } from '../../../lib/api';
import type { User } from '../../../types/session';
import {
  Wallet,
  Landmark,
  ShieldCheck,
  Clock,
  CheckCircle2,
  AlertCircle,
  FileText,
  Edit3,
  X,
  ExternalLink,
  Percent,
  Receipt
} from 'lucide-react';
import { Dialog, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '../../../components/ui/dialog';
import { Button } from '../../../components/ui/button';
import { Input } from '../../../components/ui/input';
import { Label } from '../../../components/ui/label';

type BankDetails = {
  bank_name: string;
  account_holder_name: string;
  account_number: string;
  branch: string;
  business_name: string;
};

type PendingItem = {
  item_id: number;
  order_id: string;
  product_id: number;
  title: string;
  price: number;
  quantity: number;
  gross_amount: number;
  commission: number;
  net_amount: number;
  order_date: string;
  shipped_at: string | null;
  is_reviewed: boolean;
  shipped_7d_ago: boolean;
  is_eligible: boolean;
  eligibility_status: string;
};

type SettledItem = {
  item_id: number;
  order_id: string;
  title: string;
  price: number;
  quantity: number;
  gross_amount: number;
};

type SettlementRecord = {
  id: number;
  gross_amount: number;
  commission_amount: number;
  net_amount: number;
  receipt_url: string;
  created_at: string;
  items: SettledItem[];
};

type PaymentsSummary = {
  total_pending_gross: number;
  total_pending_commission: number;
  total_pending_net: number;
  total_paid_gross: number;
  total_paid_commission: number;
  total_paid_net: number;
};

type SellerPaymentsApiResponse = {
  bank_details: BankDetails;
  pending_items: PendingItem[];
  settlements: SettlementRecord[];
  summary: PaymentsSummary;
};

export function SellerPaymentsPage({ user: _user }: { user: User }) {
  const [bankDetails, setBankDetails] = useState<BankDetails>({
    bank_name: '',
    account_holder_name: '',
    account_number: '',
    branch: '',
    business_name: ''
  });
  const [pendingItems, setPendingItems] = useState<PendingItem[]>([]);
  const [settlements, setSettlements] = useState<SettlementRecord[]>([]);
  const [summary, setSummary] = useState<PaymentsSummary>({
    total_pending_gross: 0,
    total_pending_commission: 0,
    total_pending_net: 0,
    total_paid_gross: 0,
    total_paid_commission: 0,
    total_paid_net: 0,
  });

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // Bank Edit Modal State
  const [isBankModalOpen, setIsBankModalOpen] = useState(false);
  const [editBankForm, setEditBankForm] = useState<BankDetails>({
    bank_name: '',
    account_holder_name: '',
    account_number: '',
    branch: '',
    business_name: ''
  });
  const [updatingBank, setUpdatingBank] = useState(false);
  const [bankError, setBankError] = useState('');

  // Receipt Modal State
  const [selectedReceiptUrl, setSelectedReceiptUrl] = useState<string | null>(null);

  async function loadPaymentsData() {
    setLoading(true);
    setError('');
    try {
      const res = (await requestJson<SellerPaymentsApiResponse>('/api/seller/payments')) as unknown as SellerPaymentsApiResponse;

      setBankDetails(res.bank_details);
      setPendingItems(res.pending_items);
      setSettlements(res.settlements);
      setSummary(res.summary);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load payments data.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadPaymentsData();
  }, []);

  const handleOpenBankModal = () => {
    setEditBankForm({ ...bankDetails });
    setBankError('');
    setIsBankModalOpen(true);
  };

  const handleSaveBankDetails = async (e: React.FormEvent) => {
    e.preventDefault();
    if (
      !editBankForm.bank_name.trim() ||
      !editBankForm.account_holder_name.trim() ||
      !editBankForm.account_number.trim() ||
      !editBankForm.branch.trim()
    ) {
      setBankError('Please fill in all banking fields.');
      return;
    }

    setUpdatingBank(true);
    setBankError('');

    try {
      await requestJson('/api/seller/bank-details', {
        bank_name: editBankForm.bank_name.trim(),
        account_holder_name: editBankForm.account_holder_name.trim(),
        account_number: editBankForm.account_number.trim(),
        branch: editBankForm.branch.trim(),
      });

      setBankDetails({ ...editBankForm });
      setIsBankModalOpen(false);
    } catch (err) {
      setBankError(err instanceof Error ? err.message : 'Failed to update bank details.');
    } finally {
      setUpdatingBank(false);
    }
  };

  const hasBankDetails = Boolean(
    bankDetails.bank_name && bankDetails.account_number && bankDetails.account_holder_name
  );

  return (
    <div className="space-y-8 animate-in fade-in duration-300">
      {/* Top Banner */}
      <div className="relative overflow-hidden rounded-3xl bg-gradient-to-r from-ink-900 via-aura-950 to-purple-950 p-6 sm:p-8 text-white shadow-xl">
        <div className="absolute right-0 top-0 -mr-12 -mt-12 h-64 w-64 rounded-full bg-aura-500/10 blur-3xl" />
        <div className="relative z-10 flex flex-col md:flex-row md:items-center md:justify-between gap-6">
          <div>
            <div className="inline-flex items-center gap-2 rounded-full bg-white/10 px-3 py-1 text-xs font-semibold text-aura-300 backdrop-blur-md">
              <Wallet className="h-3.5 w-3.5" />
              <span>Product Seller Payouts</span>
            </div>
            <h1 className="mt-3 font-display text-2xl sm:text-3xl font-bold tracking-tight">Earnings & Settlements</h1>
            <p className="mt-1 max-w-xl text-sm text-ink-300">
              Track your pending order earnings, view paid settlement receipts, and manage your bank transfer account details.
            </p>
          </div>

          <div className="flex flex-col sm:flex-row gap-3">
            <button
              onClick={handleOpenBankModal}
              className="inline-flex items-center justify-center gap-2 rounded-2xl bg-white px-4 py-2.5 text-sm font-bold text-ink-900 shadow-md hover:bg-aura-50 transition-all"
            >
              <Landmark className="h-4 w-4 text-aura-600" />
              <span>{hasBankDetails ? 'Update Banking Details' : 'Add Bank Account'}</span>
            </button>
          </div>
        </div>
      </div>

      {loading ? (
        <div className="flex h-64 items-center justify-center">
          <div className="flex flex-col items-center gap-3">
            <div className="h-8 w-8 animate-spin rounded-full border-4 border-aura-200 border-t-aura-600" />
            <p className="text-sm font-semibold text-ink-500">Loading payout records...</p>
          </div>
        </div>
      ) : error ? (
        <div className="rounded-3xl border border-red-200 bg-red-50 p-6 text-red-700">
          <p className="font-semibold">{error}</p>
          <button
            onClick={() => void loadPaymentsData()}
            className="mt-3 inline-flex items-center text-sm font-bold underline"
          >
            Try Again
          </button>
        </div>
      ) : (
        <>
          {/* Financial Summary Cards */}
          <div className="grid gap-4 sm:grid-cols-3 lg:grid-cols-3">
            <div className="rounded-3xl border border-ink-200 bg-white p-5 shadow-sm hover:shadow-md transition">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold uppercase tracking-wider text-ink-400">Net Pending Payback</span>
                <div className="rounded-2xl bg-emerald-50 p-2.5 text-emerald-600">
                  <ShieldCheck className="h-5 w-5" />
                </div>
              </div>
              <p className="mt-3 font-display text-2xl font-bold text-ink-900">
                LKR {summary.total_pending_net.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </p>
              <p className="mt-1 text-xs text-emerald-600 font-medium">
                (10% platform fee deducted: LKR {summary.total_pending_commission.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })})
              </p>
            </div>

            <div className="rounded-3xl border border-ink-200 bg-white p-5 shadow-sm hover:shadow-md transition">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold uppercase tracking-wider text-ink-400">Total Settled Earnings</span>
                <div className="rounded-2xl bg-blue-50 p-2.5 text-blue-600">
                  <CheckCircle2 className="h-5 w-5" />
                </div>
              </div>
              <p className="mt-3 font-display text-2xl font-bold text-ink-900">
                LKR {summary.total_paid_net.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </p>
              <p className="mt-1 text-xs text-ink-500">
                Gross: LKR {summary.total_paid_gross.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </p>
            </div>

            <div className="rounded-3xl border border-ink-200 bg-white p-5 shadow-sm hover:shadow-md transition">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold uppercase tracking-wider text-ink-400">Platform Commission (-10%)</span>
                <div className="rounded-2xl bg-purple-50 p-2.5 text-purple-600">
                  <Percent className="h-5 w-5" />
                </div>
              </div>
              <p className="mt-3 font-display text-2xl font-bold text-ink-900">
                LKR {summary.total_paid_commission.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </p>
              <p className="mt-1 text-xs text-purple-600 font-medium">Platform service fee</p>
            </div>
          </div>


          {/* Bank Account Info Card */}
          {/* <div className="rounded-3xl border border-ink-200 bg-white p-6 shadow-sm">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-ink-100 pb-4">
              <div className="flex items-center gap-3">
                <div className="rounded-2xl bg-aura-50 p-3 text-aura-600">
                  <Landmark className="h-6 w-6" />
                </div>
                <div>
                  <h2 className="font-display text-lg font-bold text-ink-900">Payout Banking Details</h2>
                  <p className="text-xs text-ink-500">Your earnings will be transferred by Admin to this bank account.</p>
                </div>
              </div>
              <Button
                variant="outline"
                onClick={handleOpenBankModal}
                className="rounded-2xl border-ink-200 hover:bg-ink-50 self-start sm:self-auto"
              >
                <Edit3 className="mr-2 h-4 w-4" />
                {hasBankDetails ? 'Edit Bank Account' : 'Configure Bank Account'}
              </Button>
            </div>

            {hasBankDetails ? (
              <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                <div className="rounded-2xl bg-ink-50/70 p-4">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-ink-400">Bank Name</span>
                  <p className="mt-1 font-bold text-ink-900">{bankDetails.bank_name}</p>
                </div>
                <div className="rounded-2xl bg-ink-50/70 p-4">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-ink-400">Account Holder</span>
                  <p className="mt-1 font-bold text-ink-900">{bankDetails.account_holder_name}</p>
                </div>
                <div className="rounded-2xl bg-ink-50/70 p-4">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-ink-400">Account Number</span>
                  <p className="mt-1 font-bold text-ink-900">{bankDetails.account_number}</p>
                </div>
                <div className="rounded-2xl bg-ink-50/70 p-4">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-ink-400">Branch</span>
                  <p className="mt-1 font-bold text-ink-900">{bankDetails.branch}</p>
                </div>
              </div>
            ) : (
              <div className="mt-6 rounded-2xl border border-dashed border-ink-200 bg-ink-50/50 p-6 text-center">
                <p className="text-sm font-semibold text-ink-600">No bank details recorded.</p>
                <p className="mt-1 text-xs text-ink-400">Please provide your bank details to enable automatic payouts.</p>
              </div>
            )}
          </div> */}

          {/* Pending Order Payouts Section */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="font-display text-xl font-bold text-ink-900 flex items-center gap-2">
                  <Clock className="h-5 w-5 text-aura-600" />
                  Pending Order Paybacks ({pendingItems.length})
                </h2>
                <p className="text-xs text-ink-500">
                  Products reviewed by customers or shipped 7+ days ago are eligible for settlement by Admin. All payouts include a 10% platform commission deduction.
                </p>
              </div>
            </div>

            <div className="rounded-3xl border border-ink-200 bg-white overflow-hidden shadow-sm">
              {pendingItems.length === 0 ? (
                <div className="p-12 text-center">
                  <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-emerald-50 text-emerald-600">
                    <CheckCircle2 className="h-6 w-6" />
                  </div>
                  <h3 className="font-display text-base font-bold text-ink-900">No Pending Payouts</h3>
                  <p className="mt-1 text-xs text-ink-500 max-w-sm mx-auto">
                    All your eligible shipped orders have been settled by Admin. New customer orders will appear here once shipped.
                  </p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-sm text-ink-600">
                    <thead className="bg-ink-50/80 text-[11px] font-bold uppercase tracking-wider text-ink-400 border-b border-ink-100">
                      <tr>
                        <th className="px-6 py-4">Order / Product</th>
                        <th className="px-6 py-4">Date</th>
                        <th className="px-6 py-4">Status / Eligibility</th>
                        <th className="px-6 py-4 text-right">Gross Price</th>
                        <th className="px-6 py-4 text-right text-purple-600">10% Platform Fee</th>
                        <th className="px-6 py-4 text-right text-emerald-700 font-bold">Net Payout</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-ink-100">
                      {pendingItems.map((item) => (
                        <tr key={item.item_id} className="hover:bg-ink-50/50 transition">
                          <td className="px-6 py-4">
                            <div className="font-bold text-ink-900">{item.title}</div>
                            <div className="text-xs font-mono text-ink-400 mt-0.5">Order {item.order_id} • Qty: {item.quantity}</div>
                          </td>
                          <td className="px-6 py-4 text-xs text-ink-500 whitespace-nowrap">
                            {new Date(item.order_date).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            {item.is_reviewed ? (
                              <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-3 py-1 text-xs font-bold text-emerald-700 border border-emerald-200">
                                <CheckCircle2 className="h-3.5 w-3.5" />
                                Reviewed by Customer
                              </span>
                            ) : item.shipped_7d_ago ? (
                              <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-50 px-3 py-1 text-xs font-bold text-amber-700 border border-amber-200">
                                <Clock className="h-3.5 w-3.5" />
                                Shipped &gt; 7 Days Ago
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1.5 rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-600 border border-slate-200">
                                <Clock className="h-3.5 w-3.5 text-slate-400" />
                                Locked (Pending 7 Days)
                              </span>
                            )}
                          </td>
                          <td className="px-6 py-4 text-right font-medium text-ink-900 whitespace-nowrap">
                            LKR {item.gross_amount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                          </td>
                          <td className="px-6 py-4 text-right text-xs font-semibold text-purple-600 whitespace-nowrap">
                            - LKR {item.commission.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                          </td>
                          <td className="px-6 py-4 text-right font-bold text-emerald-600 whitespace-nowrap">
                            LKR {item.net_amount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>

          {/* Paid Settlements History Section */}
          <div className="space-y-4">
            <h2 className="font-display text-xl font-bold text-ink-900 flex items-center gap-2">
              <Receipt className="h-5 w-5 text-aura-600" />
              Paid Settlement History ({settlements.length})
            </h2>

            <div className="rounded-3xl border border-ink-200 bg-white overflow-hidden shadow-sm">
              {settlements.length === 0 ? (
                <div className="p-12 text-center text-ink-400 text-sm">
                  No completed bank settlement payouts yet.
                </div>
              ) : (
                <div className="divide-y divide-ink-100">
                  {settlements.map((set) => (
                    <div key={set.id} className="p-6 hover:bg-ink-50/50 transition space-y-3">
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="font-display font-bold text-ink-900">Settlement #{set.id}</span>
                            <span className="rounded-full bg-emerald-100 px-2.5 py-0.5 text-[11px] font-bold text-emerald-800">
                              Paid & Settled
                            </span>
                          </div>
                          <p className="mt-1 text-xs text-ink-400">
                            Processed on {new Date(set.created_at).toLocaleString()} • {set.items.length} items settled
                          </p>
                        </div>

                        <div className="flex items-center gap-4">
                          <div className="text-right">
                            <span className="text-[10px] font-bold uppercase tracking-wider text-ink-400">Net Amount Paid</span>
                            <p className="font-display text-lg font-bold text-emerald-600">
                              LKR {set.net_amount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                            </p>
                            <p className="text-[11px] text-ink-400">
                              Gross: LKR {set.gross_amount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} | Fee: -LKR {set.commission_amount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                            </p>
                          </div>

                          <Button
                            variant="outline"
                            onClick={() => setSelectedReceiptUrl(set.receipt_url)}
                            className="rounded-xl border-ink-200 hover:bg-aura-50 text-aura-700"
                          >
                            <FileText className="mr-1.5 h-4 w-4" />
                            View Receipt
                          </Button>
                        </div>
                      </div>

                      {/* Items details collapse/preview */}
                      {set.items.length > 0 && (
                        <div className="rounded-2xl bg-ink-50/80 p-3.5 text-xs text-ink-600 space-y-1.5">
                          <span className="font-bold text-ink-700 text-[11px] uppercase tracking-wider">Settled Products:</span>
                          <div className="grid gap-1.5 sm:grid-cols-2 lg:grid-cols-3">
                            {set.items.map((si) => (
                              <div key={si.item_id} className="flex items-center justify-between rounded-lg bg-white p-2 border border-ink-100">
                                <span className="font-medium text-ink-900 truncate max-w-[180px]">{si.title}</span>
                                <span className="font-semibold text-ink-600 whitespace-nowrap">LKR {si.gross_amount.toLocaleString()}</span>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </>
      )}

      {/* Edit Bank Details Modal */}
      <Dialog isOpen={isBankModalOpen} onClose={() => setIsBankModalOpen(false)}>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Landmark className="h-5 w-5 text-aura-600" />
            <span>Update Payout Banking Details</span>
          </DialogTitle>
          <DialogDescription>
            Enter your correct bank account credentials. Admin will transfer your 90% net product payout directly to this bank account.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSaveBankDetails} className="space-y-4 py-2">
          {bankError && (
            <div className="rounded-xl bg-red-50 p-3 text-xs font-semibold text-red-600">
              {bankError}
            </div>
          )}

          <div className="space-y-1">
            <Label htmlFor="bank_name">Bank Name</Label>
            <Input
              id="bank_name"
              placeholder="e.g. Commercial Bank of Ceylon / Bank of Ceylon"
              value={editBankForm.bank_name}
              onChange={(e) => setEditBankForm({ ...editBankForm, bank_name: e.target.value })}
              required
            />
          </div>

          <div className="space-y-1">
            <Label htmlFor="account_holder_name">Account Holder Name</Label>
            <Input
              id="account_holder_name"
              placeholder="Full name as appeared in bank book"
              value={editBankForm.account_holder_name}
              onChange={(e) => setEditBankForm({ ...editBankForm, account_holder_name: e.target.value })}
              required
            />
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1">
              <Label htmlFor="account_number">Account Number</Label>
              <Input
                id="account_number"
                placeholder="e.g. 8001234567"
                value={editBankForm.account_number}
                onChange={(e) => setEditBankForm({ ...editBankForm, account_number: e.target.value })}
                required
              />
            </div>

            <div className="space-y-1">
              <Label htmlFor="branch">Branch Name</Label>
              <Input
                id="branch"
                placeholder="e.g. Colombo Fort / Kandy"
                value={editBankForm.branch}
                onChange={(e) => setEditBankForm({ ...editBankForm, branch: e.target.value })}
                required
              />
            </div>
          </div>

          <DialogFooter className="mt-6">
            <Button
              type="button"
              variant="outline"
              onClick={() => setIsBankModalOpen(false)}
              disabled={updatingBank}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={updatingBank} className="bg-aura-600 text-white hover:bg-aura-700">
              {updatingBank ? 'Saving...' : 'Save Bank Details'}
            </Button>
          </DialogFooter>
        </form>
      </Dialog>

      {/* Receipt Preview Modal */}
      {selectedReceiptUrl && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in duration-200">
          <div className="relative max-w-2xl w-full rounded-3xl bg-white p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-ink-100 pb-3">
              <h3 className="font-display font-bold text-lg text-ink-900 flex items-center gap-2">
                <FileText className="h-5 w-5 text-aura-600" />
                Bank Transfer Receipt
              </h3>
              <button
                onClick={() => setSelectedReceiptUrl(null)}
                className="rounded-full p-1.5 text-ink-400 hover:bg-ink-100 hover:text-ink-900 transition"
              >
                <X className="h-5 w-5" />
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
                <ExternalLink className="h-3.5 w-3.5" />
                Open Full Size
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
