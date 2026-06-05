import { useEffect, useState } from 'react';
import { Button } from '../../../components/ui/button';
import { Input } from '../../../components/ui/input';
import { Label } from '../../../components/ui/label';
import { requestForm, requestJson } from '../../../lib/api';
import type { User, Profile } from '../../../types/session';
import districts from '../../../lib/districts.json';

interface EditProfilePageProps {
  user: User;
}

export function EditProfilePage({ user }: EditProfilePageProps) {
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState('');
  const [successMsg, setSuccessMsg] = useState('');
  const [saving, setSaving] = useState(false);

  // Form states
  const [businessName, setBusinessName] = useState('');
  const [businessPhone, setBusinessPhone] = useState('');
  const [businessEmail, setBusinessEmail] = useState('');
  const [businessAddress, setBusinessAddress] = useState('');
  const [businessCity, setBusinessCity] = useState('');
  const [businessDescription, setBusinessDescription] = useState('');
  
  // File states
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [bannerFile, setBannerFile] = useState<File | null>(null);

  // Preview states
  const [logoPreview, setLogoPreview] = useState<string | null>(null);
  const [bannerPreview, setBannerPreview] = useState<string | null>(null);

  useEffect(() => {
    async function loadProfile() {
      setLoading(true);
      setErrorMsg('');
      try {
        const response = (await requestJson<unknown>(`/api/profiles/${user.id}`)) as {
          profile: Profile;
        };
        if (response.profile) {
          const p = response.profile;
          setProfile(p);
          setBusinessName(p.business_name || '');
          setBusinessPhone(p.business_phone || '');
          setBusinessEmail(p.business_email || '');
          setBusinessAddress(p.business_address || '');
          setBusinessCity(p.business_city || districts[0]);
          setBusinessDescription(p.business_description || '');
          setLogoPreview(p.logo_url || null);
          setBannerPreview(p.banner_url || null);
        }
      } catch (err) {
        setErrorMsg(err instanceof Error ? err.message : 'Failed to load profile details.');
      } finally {
        setLoading(false);
      }
    }
    void loadProfile();
  }, [user.id]);

  function handleLogoChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (file) {
      setLogoFile(file);
      setLogoPreview(URL.createObjectURL(file));
    }
  }

  function handleBannerChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (file) {
      setBannerFile(file);
      setBannerPreview(URL.createObjectURL(file));
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setErrorMsg('');
    setSuccessMsg('');

    if (!businessName.trim() || !businessPhone.trim() || !businessEmail.trim() || !businessAddress.trim() || !businessCity.trim() || !businessDescription.trim()) {
      setErrorMsg('All business details are required.');
      setSaving(false);
      return;
    }

    try {
      const form = new FormData();
      form.append('business_name', businessName);
      form.append('business_phone', businessPhone);
      form.append('business_email', businessEmail);
      form.append('business_address', businessAddress);
      form.append('business_city', businessCity);
      form.append('business_description', businessDescription);

      if (logoFile) {
        form.append('logo_file', logoFile, logoFile.name);
      }
      if (bannerFile) {
        form.append('banner_file', bannerFile, bannerFile.name);
      }

      await requestForm('/api/profile/update', form);
      setSuccessMsg('Profile updated successfully!');
      
      // Reload profile to refresh server URLs
      const response = (await requestJson<unknown>(`/api/profiles/${user.id}`)) as {
        profile: Profile;
      };
      if (response.profile) {
        const p = response.profile;
        setLogoPreview(p.logo_url || null);
        setBannerPreview(p.banner_url || null);
        setLogoFile(null);
        setBannerFile(null);
      }
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Unable to update profile.');
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <div className="flex py-12 justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-ink-200 border-t-ink-900" />
      </div>
    );
  }

  return (
    <div className="max-w-3xl rounded-3xl border border-white/70 bg-white/80 p-6 md:p-8 shadow-sm backdrop-blur">
      <form onSubmit={handleSubmit} className="space-y-6">
        <div>
          <h3 className="font-display text-lg font-bold text-ink-900">Edit Business Profile</h3>
          <p className="text-xs text-ink-500 mt-1">
            Update your public listing page. Make sure contact and office details are correct.
          </p>
        </div>

        {errorMsg && (
          <p className="text-sm font-semibold text-red-600 animate-pulse bg-red-50/50 p-3 rounded-xl border border-red-100">{errorMsg}</p>
        )}
        {successMsg && (
          <p className="text-sm font-semibold text-emerald-700 bg-emerald-50/50 p-3 rounded-xl border border-emerald-100">{successMsg}</p>
        )}

        {/* Cover Photo / Banner Preview & Edit */}
        <div className="space-y-2">
          <Label>Cover Banner Photo</Label>
          <div className="relative h-44 w-full rounded-2xl bg-ink-50 border border-ink-200 overflow-hidden flex items-center justify-center">
            {bannerPreview ? (
              <img src={bannerPreview} alt="Cover Banner" className="h-full w-full object-cover" />
            ) : (
              <div className="h-full w-full bg-gradient-to-r from-ink-900 to-ink-800 flex items-center justify-center text-xs font-medium text-white/50">
                No cover banner uploaded
              </div>
            )}
            
            <label className="absolute bottom-4 right-4 rounded-full bg-ink-900/80 px-4 py-2 text-xs font-semibold text-white backdrop-blur cursor-pointer hover:bg-ink-900 hover:scale-105 transition-all">
              Choose Banner
              <input type="file" accept="image/*" className="hidden" onChange={handleBannerChange} />
            </label>
          </div>
        </div>

        {/* Logo Avatar Upload & Preview */}
        <div className="space-y-2">
          <Label>Company Logo / Avatar</Label>
          <div className="flex items-center gap-4">
            <div className="h-20 w-20 rounded-2xl border border-ink-200 bg-ink-50 overflow-hidden flex items-center justify-center shrink-0">
              {logoPreview ? (
                <img src={logoPreview} alt="Logo" className="h-full w-full object-cover" />
              ) : (
                <span className="text-xs font-semibold text-ink-400">No Logo</span>
              )}
            </div>
            <div>
              <label className="rounded-full border border-ink-200 bg-white px-4 py-2.5 text-xs font-semibold text-ink-700 hover:bg-ink-50 cursor-pointer shadow-sm">
                Choose Logo
                <input type="file" accept="image/*" className="hidden" onChange={handleLogoChange} />
              </label>
              <p className="text-[10px] text-ink-400 mt-2">Recommended: Square format (PNG/JPG).</p>
            </div>
          </div>
        </div>

        {/* Form Inputs */}
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="business-name">Business / Contractor Name</Label>
            <Input
              id="business-name"
              placeholder="e.g. Perera Contractors Ltd"
              value={businessName}
              onChange={(e) => setBusinessName(e.target.value)}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="business-phone">Contact Phone</Label>
            <Input
              id="business-phone"
              placeholder="e.g. +94 77 123 4567"
              value={businessPhone}
              onChange={(e) => setBusinessPhone(e.target.value)}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="business-email">Business Email</Label>
            <Input
              id="business-email"
              type="email"
              placeholder="e.g. contact@perera.lk"
              value={businessEmail}
              onChange={(e) => setBusinessEmail(e.target.value)}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="business-city">Base District / City</Label>
            <select
              id="business-city"
              className="flex h-11 w-full rounded-2xl border border-ink-200 bg-white px-3 py-2 text-sm text-ink-900 focus:outline-none focus:ring-2 focus:ring-ink-950"
              value={businessCity}
              onChange={(e) => setBusinessCity(e.target.value)}
            >
              {districts.map((d) => (
                <option key={d} value={d}>
                  {d}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="space-y-2">
          <Label htmlFor="business-address">Head Office Physical Address</Label>
          <Input
            id="business-address"
            placeholder="e.g. 123 Galle Road, Colombo 03"
            value={businessAddress}
            onChange={(e) => setBusinessAddress(e.target.value)}
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="business-desc">Business Description / About Us</Label>
          <textarea
            id="business-desc"
            rows={5}
            placeholder="Introduce your business, specialization, years of experience, and values to attract potential clients..."
            className="flex w-full rounded-2xl border border-ink-200 bg-white px-3 py-2 text-sm text-ink-900 focus:outline-none focus:ring-2 focus:ring-ink-950"
            value={businessDescription}
            onChange={(e) => setBusinessDescription(e.target.value)}
          />
        </div>

        <div className="flex justify-end gap-3 pt-4 border-t border-ink-100">
          <Button
            type="submit"
            disabled={saving}
            className="rounded-full bg-ink-900 text-white hover:bg-ink-800 px-6 py-2.5"
          >
            {saving ? 'Saving Changes...' : 'Save Changes'}
          </Button>
        </div>
      </form>
    </div>
  );
}
