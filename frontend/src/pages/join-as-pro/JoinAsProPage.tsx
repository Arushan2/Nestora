import { FormEvent, useState, type ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import * as Icons from 'lucide-react';
import { Button } from '../../components/ui/button';
import { HeaderBar } from '../../components/HeaderBar';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../../components/ui/card';
import { FileUpload } from '../../components/ui/file-upload';
import { Input } from '../../components/ui/input';
import { Label } from '../../components/ui/label';
import { Textarea } from '../../components/ui/textarea';
import type { ProApplicationPayload, User } from '../../types/session';
import { COUNTRY_CODES } from '../../utils/countryCodes';

const SRI_LANKAN_BANKS = [
  'Bank of Ceylon',
  "People's Bank",
  'Commercial Bank of Ceylon',
  'Hatton National Bank',
  'Sampath Bank',
  'Seylan Bank',
  'Nations Trust Bank',
  'DFCC Bank',
  'Union Bank of Colombo',
  'National Savings Bank',
  'Pan Asia Banking Corporation',
  'Cargills Bank',
  'Amana Bank',
];

const initialPayload: ProApplicationPayload = {
  applicationType: 'service_provider',
  businessName: '',
  businessEmail: '',
  businessPhone: '',
  businessAddress: '',
  businessCity: '',
  businessDescription: '',
  documentType: '',
  documentNumber: '',
  documentFile: '',
  selectedPlan: 'annual_trial',
  bankName: '',
  accountHolderName: '',
  accountNumber: '',
  branch: '',
};

export function JoinAsProPage({
  user,
  onSubmit,
  onLogout,
}: {
  user: User;
  onSubmit: (payload: FormData | ProApplicationPayload) => Promise<void>;
  onLogout: () => Promise<void>;
}) {
  const navigate = useNavigate();
  const [step, setStep] = useState(1);
  const [payload, setPayload] = useState(initialPayload);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [registrationFile, setRegistrationFile] = useState<File | null>(null);
  const [countryCode, setCountryCode] = useState('+94');
  const [localPhone, setLocalPhone] = useState('');
  const [termsAccepted, setTermsAccepted] = useState(false);

  const isPending = user?.application?.status === 'pending';
  const isApproved = user?.application?.status === 'approved';
  const isRejected = user?.application?.status === 'rejected';
  const hasCheckoutUrl = !!(user?.application as any)?.stripe_checkout_url;

  // When approved but Stripe not completed — show activation CTA
  const awaitingStripeSetup = isApproved && user?.role !== 'service_provider';

  const totalSteps = payload.applicationType === 'service_provider' ? 4 : 3;

  const EMAIL_REGEX = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;

  function validateEmail(email: string): boolean {
    return EMAIL_REGEX.test(email);
  }

  function validatePhone(code: string, number: string): string | null {
    const digits = number.replace(/\D/g, '');
    if (!digits) {
      return 'Business phone is required.';
    }
    if (code === '+94') {
      let cleaned = digits;
      if (cleaned.startsWith('0')) {
        cleaned = cleaned.substring(1);
      }
      if (cleaned.length !== 9) {
        return 'Sri Lankan phone number must be exactly 9 digits (e.g., 771234567).';
      }
    } else {
      if (digits.length < 7 || digits.length > 15) {
        return 'Phone number must be between 7 and 15 digits.';
      }
    }
    return null;
  }

  function update(field: keyof ProApplicationPayload, value: string) {
    setError('');
    setPayload((current) => ({ ...current, [field]: value }));
  }

  function handlePhoneChange(value: string) {
    setError('');
    setLocalPhone(value);
  }

  function handleCountryCodeChange(value: string) {
    setError('');
    setCountryCode(value);
  }

  async function handleFinish(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setError('');

    if (!registrationFile) {
      setError('Business registration document is required to complete the process.');
      setLoading(false);
      return;
    }

    if (payload.applicationType === 'service_provider' && !termsAccepted) {
      setError('Please accept the Free Trial terms and conditions to continue.');
      setLoading(false);
      return;
    }

    const emailErr = validateEmail(payload.businessEmail) ? null : 'Please enter a valid email address.';
    const phoneErr = validatePhone(countryCode, localPhone);
    if (emailErr || phoneErr) {
      setError(emailErr || phoneErr || '');
      setLoading(false);
      return;
    }

    let cleaned = localPhone.replace(/\D/g, '');
    if (countryCode === '+94' && cleaned.startsWith('0')) {
      cleaned = cleaned.substring(1);
    }
    const finalPhone = countryCode + cleaned;

    try {
      if (registrationFile) {
        const form = new FormData();
        form.append('applicationType', payload.applicationType);
        form.append('businessName', payload.businessName);
        form.append('businessEmail', payload.businessEmail);
        form.append('businessPhone', finalPhone);
        form.append('businessAddress', payload.businessAddress);
        form.append('businessCity', payload.businessCity);
        form.append('businessDescription', payload.businessDescription);
        form.append('documentType', payload.documentType);
        form.append('documentNumber', payload.documentNumber);
        form.append('business_registration_document', registrationFile, registrationFile.name);
        if (payload.applicationType === 'service_provider') {
          form.append('selectedPlan', 'annual_trial');
          form.append('termsAccepted', 'true');
        } else if (payload.applicationType === 'product_seller') {
          form.append('bankName', payload.bankName || '');
          form.append('accountHolderName', payload.accountHolderName || '');
          form.append('accountNumber', payload.accountNumber || '');
          form.append('branch', payload.branch || '');
        }

        await onSubmit(form);
      } else {
        await onSubmit({
          ...payload,
          businessPhone: finalPhone,
          selectedPlan: payload.applicationType === 'service_provider' ? 'annual_trial' : payload.selectedPlan,
          ...(payload.applicationType === 'service_provider' ? { termsAccepted: true } as any : {}),
        });
      }
      navigate('/', { replace: true });
    } catch (caughtError) {
      setError(caughtError instanceof Error ? caughtError.message : 'Unable to submit application.');
    } finally {
      setLoading(false);
    }
  }

  // Approved state: prompt to complete Stripe setup
  if (awaitingStripeSetup) {
    const checkoutUrl = (user?.application as any)?.stripe_checkout_url;
    return (
      <main className="mx-auto min-h-screen max-w-6xl px-4 py-6 md:px-8">
        <HeaderBar user={user} onLogout={onLogout} />
        <section className="mt-10 grid gap-8 lg:grid-cols-[0.7fr_1.3fr]">
          <div className="space-y-4">
            <p className="text-sm uppercase tracking-[0.2em] text-ink-500">Join as pro</p>
            <h1 className="font-display text-4xl font-semibold text-ink-900">One step left.</h1>
            <p className="text-base leading-7 text-ink-600">
              Your application has been approved. Activate your free trial to start listing your services.
            </p>
          </div>
          <Card className="border-0 bg-white/90 shadow-glow p-8 space-y-6">
            {/* Approved header */}
            <div className="flex items-start gap-4">
              <div className="flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-full bg-emerald-100">
                <Icons.CheckCircle2 className="h-6 w-6 text-emerald-600" />
              </div>
              <div>
                <h2 className="font-display text-xl font-bold text-ink-900">Application Approved!</h2>
                <p className="mt-1 text-sm text-ink-600">
                  Your Service Provider application for{' '}
                  <strong className="text-ink-900">{user.application?.business_name}</strong> has been approved.
                </p>
              </div>
            </div>

            {/* Trial summary card */}
            <div className="rounded-2xl border border-aura-200 bg-gradient-to-br from-aura-50 to-white p-6 space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <span className="inline-flex items-center rounded-full bg-emerald-100 px-2.5 py-1 text-xs font-semibold text-emerald-700">
                    $0 Due Today
                  </span>
                  <h3 className="mt-2 font-display text-lg font-bold text-ink-900">
                    Start Your 30-Day Free Trial
                  </h3>
                </div>
                <div className="text-right">
                  <p className="font-display text-2xl font-extrabold text-ink-900">$29.99</p>
                  <p className="text-xs text-ink-500">per year, after trial</p>
                </div>
              </div>
              <ul className="space-y-2 text-sm text-ink-700">
                {[
                  'Full Service Provider access during trial',
                  'Create unlimited service listings',
                  'Receive and reply to client inquiries',
                  'No charge for 30 days',
                  'Cancel any time to avoid annual charge',
                ].map((feat) => (
                  <li key={feat} className="flex items-center gap-2">
                    <span className="text-emerald-500">✓</span>
                    {feat}
                  </li>
                ))}
              </ul>
            </div>

            {/* Disclosure */}
            <p className="rounded-xl bg-ink-50 border border-ink-100 p-4 text-xs text-ink-600 leading-relaxed">
              By activating, you confirm that your saved payment method will automatically be charged{' '}
              <strong>$29.99 USD</strong> after the 30-day free trial for one year of Service Provider membership.
              You can cancel at any time before the trial ends.
            </p>

            {checkoutUrl ? (
              <a
                href={checkoutUrl}
                className="flex w-full items-center justify-center gap-2 rounded-2xl bg-aura-500 px-6 py-4 text-sm font-bold text-white shadow-md transition hover:bg-aura-600 focus:outline-none focus:ring-2 focus:ring-aura-500/30"
              >
                <Icons.Zap className="h-4 w-4" />
                Activate My Free Trial
              </a>
            ) : (
              <div className="rounded-xl bg-amber-50 border border-amber-200 p-4 text-sm text-amber-800">
                <Icons.Clock className="inline h-4 w-4 mr-1.5" />
                Your checkout link is being prepared. Check your email for the activation link.
              </div>
            )}

            <Button variant="outline" onClick={() => navigate('/')} className="w-full rounded-full">
              Return to Home Page
            </Button>
          </Card>
        </section>
      </main>
    );
  }

  return (
    <main className="mx-auto min-h-screen max-w-6xl px-4 py-6 md:px-8">
      <HeaderBar user={user} onLogout={onLogout} />

      <section className="mt-10 grid gap-8 lg:grid-cols-[0.7fr_1.3fr]">
        <div className="space-y-4">
          <p className="text-sm uppercase tracking-[0.2em] text-ink-500">Join as pro</p>
          <h1 className="font-display text-4xl font-semibold text-ink-900">Tell us what kind of pro you are.</h1>
          <p className="text-base leading-7 text-ink-600">
            Complete the application. First choose your role, then share business details, then upload your document.
          </p>
        </div>

        {isPending ? (
          <Card className="border-0 bg-white/90 shadow-glow p-8 text-center flex flex-col items-center justify-center space-y-4">
            <div className="inline-flex h-14 w-14 items-center justify-center rounded-full bg-amber-100 text-amber-700">
              <Icons.Clock className="h-7 w-7" />
            </div>
            <h2 className="font-display text-2xl font-bold text-ink-900">Application Under Review</h2>
            <p className="text-sm leading-relaxed text-ink-600 max-w-md">
              Your Pro application for <strong className="text-ink-900">{user.application?.business_name}</strong> is
              currently being reviewed by our administrative team.
            </p>
            <p className="text-xs text-ink-500">
              You cannot submit another Pro application while a request is pending review.
            </p>
            <div className="pt-3">
              <Button variant="outline" onClick={() => navigate('/')} className="rounded-full">
                Return to Home Page
              </Button>
            </div>
          </Card>
        ) : (
          <Card className="border-0 bg-white/90 shadow-glow">
            <CardHeader>
              <CardTitle>Application step {step} of {totalSteps}</CardTitle>
              <CardDescription>Submit one clean application for approval.</CardDescription>
            </CardHeader>
            <CardContent>
              {isRejected ? (
                <div className="rounded-2xl border border-red-200 bg-red-50 p-4 mb-6 space-y-2">
                  <div className="flex items-start gap-3">
                    <Icons.AlertTriangle className="h-5 w-5 text-red-600 flex-shrink-0 mt-0.5" />
                    <div>
                      <h4 className="text-sm font-bold text-red-900">Your Previous Application Was Rejected</h4>
                      <p className="mt-1 text-xs leading-relaxed text-red-800">
                        <strong>Reason:</strong> {user.application?.review_note || 'Requirements not met.'}
                      </p>
                      <p className="mt-2 text-xs text-red-700 font-medium">
                        Please update your information or upload a valid document to re-apply.
                      </p>
                    </div>
                  </div>
                </div>
              ) : null}

              <form className="space-y-4" onSubmit={handleFinish}>
              {step === 1 ? (
                <div className="space-y-4">
                  <ChoiceCard
                    selected={payload.applicationType === 'service_provider'}
                    title="Service provider"
                    description="For on-site services, bookings, and offers."
                    onClick={() => update('applicationType', 'service_provider')}
                  />
                  <ChoiceCard
                    selected={payload.applicationType === 'product_seller'}
                    title="Product seller"
                    description="For product listings, dispatch, and inventory."
                    onClick={() => update('applicationType', 'product_seller')}
                  />
                </div>
              ) : null}

              {step === 2 ? (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <Field label="Business Name" htmlFor="business-name">
                    <Input id="business-name" value={payload.businessName} onChange={(event) => update('businessName', event.target.value)} />
                  </Field>
                  <Field label="Business Email" htmlFor="business-email">
                    <Input id="business-email" type="email" value={payload.businessEmail} onChange={(event) => update('businessEmail', event.target.value)} />
                  </Field>
                  <Field label="Business Phone" htmlFor="business-phone">
                    <div className="flex gap-2">
                      <select
                        id="country-code"
                        value={countryCode}
                        onChange={(e) => handleCountryCodeChange(e.target.value)}
                        className="flex h-11 w-24 flex-shrink-0 rounded-2xl border border-ink-200 bg-white px-2.5 text-sm text-ink-900 shadow-sm outline-none transition focus:border-aura-500 focus:ring-2 focus:ring-aura-500/20"
                      >
                        {COUNTRY_CODES.map((c) => (
                          <option key={`${c.code}-${c.name}`} value={c.code}>
                            {c.flag} {c.code}
                          </option>
                        ))}
                      </select>
                      <Input
                        id="business-phone"
                        type="tel"
                        placeholder="77 123 4567"
                        value={localPhone}
                        onChange={(event) => handlePhoneChange(event.target.value)}
                        className="flex-1"
                      />
                    </div>
                  </Field>
                  <Field label="City" htmlFor="business-city">
                    <Input id="business-city" value={payload.businessCity} onChange={(event) => update('businessCity', event.target.value)} />
                  </Field>
                  <Field label="Business Address" htmlFor="business-address" className="md:col-span-2">
                    <Input id="business-address" value={payload.businessAddress} onChange={(event) => update('businessAddress', event.target.value)} />
                  </Field>
                  <Field label="Business Description" htmlFor="business-description" className="md:col-span-2">
                    <Textarea id="business-description" className="min-h-[70px] py-2" value={payload.businessDescription} onChange={(event) => update('businessDescription', event.target.value)} placeholder="Tell us more about your business..." />
                  </Field>

                  {payload.applicationType === 'product_seller' && (
                    <>
                      <div className="md:col-span-2 mt-4 border-t border-ink-100 pt-4">
                        <h3 className="font-display text-base font-bold text-ink-900">Bank Details for Payouts</h3>
                        <p className="text-xs text-ink-500">Total revenue will be released to this Sri Lankan bank account.</p>
                      </div>

                      <Field label="Bank Name" htmlFor="bank-name">
                        <select
                          id="bank-name"
                          value={payload.bankName || ''}
                          onChange={(event) => update('bankName', event.target.value)}
                          className="flex h-11 w-full rounded-2xl border border-ink-200 bg-white px-3.5 text-sm text-ink-900 shadow-sm outline-none transition focus:border-aura-500 focus:ring-2 focus:ring-aura-500/20"
                        >
                          <option value="">Select a Bank...</option>
                          {SRI_LANKAN_BANKS.map((b) => (
                            <option key={b} value={b}>{b}</option>
                          ))}
                        </select>
                      </Field>

                      <Field label="Account Holder Name" htmlFor="account-holder">
                        <Input
                          id="account-holder"
                          value={payload.accountHolderName || ''}
                          onChange={(event) => update('accountHolderName', event.target.value)}
                          placeholder="Name as it appears on passbook"
                        />
                      </Field>

                      <Field label="Account Number" htmlFor="account-number">
                        <Input
                          id="account-number"
                          value={payload.accountNumber || ''}
                          onChange={(event) => update('accountNumber', event.target.value)}
                          placeholder="Enter account number"
                        />
                      </Field>

                      <Field label="Branch Name" htmlFor="branch">
                        <Input
                          id="branch"
                          value={payload.branch || ''}
                          onChange={(event) => update('branch', event.target.value)}
                          placeholder="e.g. Colombo Fort"
                        />
                      </Field>
                    </>
                  )}
                </div>
              ) : null}

              {step === 3 ? (
                <div className="grid gap-4">
                  <FileUpload
                    id="registration-document"
                    label="Business Registration Document"
                    accept="image/*"
                    maxSize={10}
                    onChange={(file) => setRegistrationFile(file)}
                    onError={(error) => setError(error)}
                  />
                </div>
              ) : null}

              {/* Step 4: Free Trial Plan (Service Provider only) */}
              {step === 4 && payload.applicationType === 'service_provider' ? (
                <div className="space-y-5">
                  {/* Plan card */}
                  <div className="rounded-3xl border border-aura-200 bg-gradient-to-br from-aura-50 to-white p-6 space-y-5">
                    <div>
                      <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-100 px-3 py-1 text-xs font-semibold text-emerald-700">
                        <Icons.Zap className="h-3 w-3" />
                        $0 Due Today
                      </span>
                      <div className="mt-3 flex items-end justify-between">
                        <div>
                          <h3 className="font-display text-xl font-bold text-ink-900">Service Provider Annual Membership</h3>
                          <p className="mt-0.5 text-sm text-ink-500">
                            Start with <span className="font-semibold text-aura-700">30 days free</span>, then continue for $29.99/year
                          </p>
                        </div>
                        <div className="text-right flex-shrink-0 ml-4">
                          <p className="font-display text-3xl font-extrabold text-ink-900">$29.99</p>
                          <p className="text-xs text-ink-500">USD / year</p>
                          <p className="text-xs text-emerald-600 font-medium mt-0.5">after free trial</p>
                        </div>
                      </div>
                    </div>

                    {/* Feature list */}
                    <div className="border-t border-aura-100 pt-4">
                      <ul className="space-y-2.5 text-sm text-ink-700">
                        {[
                          'Full Service Provider access during 30-day trial',
                          'Create unlimited service listings',
                          'Receive and reply to client inquiries',
                          'Secure payments with escrow support',
                          'Access to professional portfolio builder',
                          'Annual membership renews automatically',
                        ].map((feat) => (
                          <li key={feat} className="flex items-center gap-2">
                            <span className="text-emerald-500 font-bold">✓</span>
                            {feat}
                          </li>
                        ))}
                      </ul>
                    </div>

                    {/* Billing timeline */}
                    <div className="rounded-2xl bg-white border border-ink-100 p-4 space-y-3">
                      <p className="text-xs font-semibold uppercase tracking-wider text-ink-500">Billing Timeline</p>
                      <div className="space-y-2">
                        <div className="flex items-center gap-3">
                          <div className="h-2 w-2 rounded-full bg-emerald-400 flex-shrink-0" />
                          <span className="text-sm text-ink-700"><strong>Today</strong> — $0.00 charged. Payment method saved.</span>
                        </div>
                        <div className="ml-1 h-5 w-px bg-ink-200" />
                        <div className="flex items-center gap-3">
                          <div className="h-2 w-2 rounded-full bg-aura-400 flex-shrink-0" />
                          <span className="text-sm text-ink-700"><strong>Day 1–30</strong> — Full access. No charge.</span>
                        </div>
                        <div className="ml-1 h-5 w-px bg-ink-200" />
                        <div className="flex items-center gap-3">
                          <div className="h-2 w-2 rounded-full bg-ink-400 flex-shrink-0" />
                          <span className="text-sm text-ink-700"><strong>Day 31</strong> — $29.99/year charged automatically.</span>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Disclosure + Terms checkbox */}
                  <div className="rounded-2xl bg-ink-50 border border-ink-100 p-4 space-y-3">
                    <p className="text-xs text-ink-600 leading-relaxed">
                      By continuing, you agree to start a 30-day free trial. Unless cancelled before the trial ends,
                      your saved payment method will automatically be charged{' '}
                      <strong className="text-ink-900">$29.99 USD</strong> for one year of Service Provider membership.
                    </p>
                    <label
                      htmlFor="terms-accept"
                      className="flex cursor-pointer items-start gap-3"
                    >
                      <input
                        id="terms-accept"
                        type="checkbox"
                        checked={termsAccepted}
                        onChange={(e) => {
                          setTermsAccepted(e.target.checked);
                          setError('');
                        }}
                        className="mt-0.5 h-4 w-4 flex-shrink-0 rounded border-ink-300 text-aura-600 focus:ring-aura-500"
                      />
                      <span className="text-xs font-medium text-ink-700 leading-relaxed">
                        I understand and agree to start a 30-day free trial. I accept that $29.99/year will be charged
                        automatically after the trial unless I cancel.
                      </span>
                    </label>
                  </div>
                </div>
              ) : null}

              <div className="flex items-center justify-between gap-3">
                <Button type="button" variant="outline" onClick={() => setStep((current) => Math.max(1, current - 1))} disabled={step === 1 || loading}>
                  Back
                </Button>

                {step < totalSteps ? (
                  <Button
                    key="btn-next"
                    type="button"
                    onClick={() => {
                      if (step === 1) {
                        setStep(2);
                        return;
                      }

                      if (step === 2) {
                        if (!payload.businessName.trim()) {
                          setError('Business name is required.');
                          return;
                        }
                        if (!payload.businessEmail.trim()) {
                          setError('Business email is required.');
                          return;
                        }
                        if (!validateEmail(payload.businessEmail)) {
                          setError('Please enter a valid email address.');
                          return;
                        }
                        const phoneErr = validatePhone(countryCode, localPhone);
                        if (phoneErr) {
                          setError(phoneErr);
                          return;
                        }
                        if (!payload.businessAddress.trim()) {
                          setError('Business address is required.');
                          return;
                        }
                        if (!payload.businessCity.trim()) {
                          setError('City is required.');
                          return;
                        }
                        if (!payload.businessDescription.trim()) {
                          setError('Business description is required.');
                          return;
                        }
                        if (payload.applicationType === 'product_seller') {
                          if (!payload.bankName?.trim()) {
                            setError('Bank name is required.');
                            return;
                          }
                          if (!payload.accountHolderName?.trim()) {
                            setError('Account holder name is required.');
                            return;
                          }
                          if (!payload.accountNumber?.trim()) {
                            setError('Account number is required.');
                            return;
                          }
                          if (!payload.branch?.trim()) {
                            setError('Branch name is required.');
                            return;
                          }
                        }
                      }

                      if (step === 3) {
                        if (!registrationFile) {
                          setError('Business registration document is required.');
                          return;
                        }
                      }

                      setError('');
                      setStep((current) => Math.min(totalSteps, current + 1));
                    }}
                  >
                    Next
                  </Button>
                ) : (
                  <Button
                    key="btn-submit"
                    type="submit"
                    disabled={loading || (payload.applicationType === 'service_provider' && !termsAccepted)}
                  >
                    {loading
                      ? 'Submitting...'
                      : payload.applicationType === 'service_provider'
                      ? 'Continue with 30-Day Free Trial'
                      : 'Finish and submit'}
                  </Button>
                )}
              </div>

              {error ? <p className="text-sm font-medium text-red-600">{error}</p> : null}
              <p className="text-sm text-ink-500">Signed in as {user.email}</p>
            </form>
          </CardContent>
        </Card>
        )}
      </section>
    </main>
  );
}

function ChoiceCard({
  title,
  description,
  selected,
  onClick,
}: {
  title: string;
  description: string;
  selected: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`w-full rounded-3xl border p-5 text-left transition-colors ${selected ? 'border-ink-900 bg-ink-900 text-white' : 'border-ink-200 bg-white text-ink-900 hover:bg-ink-50'}`}
    >
      <p className="font-display text-xl font-semibold">{title}</p>
      <p className={`mt-2 text-sm leading-6 ${selected ? 'text-white/80' : 'text-ink-600'}`}>{description}</p>
    </button>
  );
}

function Field({ label, htmlFor, children, className }: { label: string; htmlFor: string; children: ReactNode; className?: string }) {
  return (
    <div className={`space-y-1.5 ${className || ''}`}>
      <Label htmlFor={htmlFor}>{label}</Label>
      {children}
    </div>
  );
}
