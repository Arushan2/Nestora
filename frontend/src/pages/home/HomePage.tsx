import { useEffect, useState, useRef } from 'react';
import { ArrowDown } from 'lucide-react';
import { Link } from 'react-router-dom';
import { Button } from '../../components/ui/button';
import { HeaderBar } from '../../components/HeaderBar';
import { Dialog, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '../../components/ui/dialog';
import { requestJson } from '../../lib/api';
import type { User, ServiceListing, ProductListing } from '../../types/session';
import { ServiceCard } from '../../components/ServiceCard';
import { ProductCard } from '../../components/ProductCard';

const categories = [
  'Masonry & Brickwork',
  'Woodwork & Carpentry',
  'Painting & Wall Finishing',
  'Tiling & Flooring',
  'Electrical & Wiring',
  'Plumbing & Sanitary Works',
  'Roofing & Suspended Ceilings',
  'Steel & Metal Fabrication',
  'Structural & Concrete Works',
  'Architectural & Designing',
];

const pricingFormats = [
  { value: 'daily_labor', label: 'Daily Labor Wage' },
  { value: 'sqft', label: 'Square Foot (Sqft)' },
  { value: 'per_point', label: 'Per Point Wiring/Plumbing' },
  { value: 'linear_ft', label: 'Per Linear Foot (Lft)' },
];

function SkeletonCard() {
  return (
    <div className="rounded-3xl border border-ink-100 bg-white p-6 space-y-4 animate-pulse">
      <div className="relative h-48 rounded-2xl bg-ink-100/70" />
      <div className="space-y-3">
        <div className="h-5 w-2/3 rounded bg-ink-200" />
        <div className="h-3 w-full rounded bg-ink-100" />
        <div className="h-3 w-5/6 rounded bg-ink-100" />
      </div>
      <div className="pt-2 border-t border-ink-100/50 space-y-2">
        <div className="h-2 w-1/4 rounded bg-ink-100" />
        <div className="h-5 w-1/2 rounded bg-ink-200" />
      </div>
      <div className="pt-3 border-t border-ink-100/50 flex justify-between items-center">
        <div className="space-y-1">
          <div className="h-2 w-12 rounded bg-ink-100" />
          <div className="h-4 w-24 rounded bg-ink-200" />
        </div>
        <div className="h-8 w-24 rounded-full bg-ink-900/10" />
      </div>
    </div>
  );
}

export function HomePage({
  user,
  notice,
  onLogout,
}: {
  user: User | null;
  notice: string;
  onLogout: () => Promise<void>;
}) {
  const isPro = user?.role === 'service_provider' || user?.role === 'product_seller';
  const isAdmin = user?.role === 'admin';
  const isPending = user?.application?.status === 'pending' && user?.role === 'user';
  const actionLabel = isAdmin ? 'Admin' : isPro ? 'Dashboard' : isPending ? 'Pending review' : 'Join as Pro';
  const actionTo = isAdmin ? '/admin' : isPro ? '/dashboard' : isPending ? '/' : '/join-as-pro';

  // Data States
  const [services, setServices] = useState<ServiceListing[]>([]);
  const [products, setProducts] = useState<ProductListing[]>([]);
  const [loadingServices, setLoadingServices] = useState(false);
  const [loadingProducts, setLoadingProducts] = useState(false);

  // Lazy Load States
  const [hasScrolledToServices, setHasScrolledToServices] = useState(false);
  const [hasScrolledToProducts, setHasScrolledToProducts] = useState(false);

  // Scroll Snap State & Ref
  const snappedRef = useRef(false);

  // 1. Detect when user scrolls to services section
  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && !hasScrolledToServices) {
          setHasScrolledToServices(true);
        }
      },
      { threshold: 0.1 }
    );

    const target = document.getElementById('latest-services');
    if (target) observer.observe(target);
    return () => { if (target) observer.unobserve(target); };
  }, [hasScrolledToServices]);

  // 1.5 Fetch latest services when scrolled
  useEffect(() => {
    if (!hasScrolledToServices) return;
    async function fetchServices() {
      setLoadingServices(true);
      try {
        const response = await requestJson<{ listings: ServiceListing[] }>('/api/service-listings?limit=6');
        setServices((response.listings as ServiceListing[]) ?? []);
      } catch (err) {
        console.error('Failed to load latest services', err);
      } finally {
        setLoadingServices(false);
      }
    }
    void fetchServices();
  }, [hasScrolledToServices]);

  // 2. Detect when user scrolls to products section
  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && !hasScrolledToProducts) {
          setHasScrolledToProducts(true);
        }
      },
      { threshold: 0.1 }
    );

    const target = document.getElementById('latest-products');
    if (target) observer.observe(target);
    return () => { if (target) observer.unobserve(target); };
  }, [hasScrolledToProducts]);

  // 2.5 Fetch latest products when scrolled
  useEffect(() => {
    if (!hasScrolledToProducts) return;
    async function fetchProducts() {
      setLoadingProducts(true);
      try {
        const response = await requestJson<{ listings: ProductListing[] }>('/api/product-listings?limit=6');
        setProducts((response.listings as ProductListing[]) ?? []);
      } catch (err) {
        console.error('Failed to load latest products', err);
      } finally {
        setLoadingProducts(false);
      }
    }
    void fetchProducts();
  }, [hasScrolledToProducts]);

  // 3. Snap scroll from hero to services section when scrolling down
  useEffect(() => {
    const handleWheel = (e: WheelEvent) => {
      if (window.scrollY < window.innerHeight * 0.5 && e.deltaY > 10) {
        if (!snappedRef.current) {
          e.preventDefault();
          snappedRef.current = true;
          document.getElementById('latest-services')?.scrollIntoView({ behavior: 'smooth' });
          setTimeout(() => {
            snappedRef.current = false;
          }, 1500);
        }
      }
    };

    let touchStartY = 0;
    const handleTouchStart = (e: TouchEvent) => {
      touchStartY = e.touches[0].clientY;
    };

    const handleTouchMove = (e: TouchEvent) => {
      const touchEndY = e.touches[0].clientY;
      if (window.scrollY < window.innerHeight * 0.5 && touchStartY - touchEndY > 30) {
        if (!snappedRef.current) {
          e.preventDefault();
          snappedRef.current = true;
          document.getElementById('latest-services')?.scrollIntoView({ behavior: 'smooth' });
          setTimeout(() => {
            snappedRef.current = false;
          }, 1500);
        }
      }
    };

    window.addEventListener('wheel', handleWheel, { passive: false });
    window.addEventListener('touchstart', handleTouchStart);
    window.addEventListener('touchmove', handleTouchMove, { passive: false });

    return () => {
      window.removeEventListener('wheel', handleWheel);
      window.removeEventListener('touchstart', handleTouchStart);
      window.removeEventListener('touchmove', handleTouchMove);
    };
  }, []);

  return (
    <>
      <div className="bg-ink-50/50 flex flex-col min-h-[85vh] relative overflow-hidden">
        {/* Background Decorative Blobs */}
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full max-w-[1000px] h-full pointer-events-none opacity-40">
          <div className="absolute -top-[20%] -left-[10%] w-[500px] h-[500px] rounded-full bg-aura-300 blur-[100px]" />
          <div className="absolute top-[20%] -right-[10%] w-[400px] h-[400px] rounded-full bg-ember-200 blur-[100px]" />
        </div>

        <div className="mx-auto max-w-7xl px-4 py-6 md:px-8 lg:px-10 w-full z-10">
          <HeaderBar user={user} onLogout={onLogout} />
        </div>

        <div className="flex-1 flex flex-col justify-center items-center text-center px-4 py-12 pb-20 z-10 max-w-5xl mx-auto w-full">
          <div className="inline-flex items-center gap-2 rounded-full border border-aura-200 bg-white/60 backdrop-blur px-4 py-2 text-sm font-medium text-aura-800 mb-8 shadow-sm">
            <span className="h-2 w-2 rounded-full bg-aura-500 animate-pulse" />
            Home for verified construction professionals
          </div>

          <h1 className="font-display text-5xl font-bold tracking-tight text-ink-900 md:text-6xl lg:text-7xl leading-[1.1]">
            Build, book, and grow your service business with{' '}
            <span className="bg-gradient-to-r from-aura-500 to-ember-500 bg-clip-text text-transparent">Nestora</span>.
          </h1>

          <p className="max-w-2xl text-base leading-7 text-ink-600 md:text-xl md:leading-8 mt-6">
            Nestora connects Sri Lankan homebuilders and renovation clients with verified masonry, tiling, electrical, and carpentry experts.
          </p>

          <div className="flex flex-wrap justify-center gap-3 mt-10">
            {isPending ? (
              <span className="rounded-full bg-amber-100 border border-amber-200 px-6 py-3.5 text-sm font-semibold text-amber-800">Pending review</span>
            ) : (
              <Link to={actionTo} className="rounded-full bg-gradient-to-r from-aura-500 to-aura-600 px-8 py-4 text-sm font-semibold text-white transition-all hover:shadow-lg hover:shadow-aura-500/30 hover:scale-105 shadow-md">
                {actionLabel}
              </Link>
            )}
            {!user ? (
              <Link to="/auth" className="rounded-full border border-ink-200 bg-white px-8 py-4 text-sm font-semibold text-ink-900 transition-all hover:bg-ink-50 shadow-sm">
                Sign in
              </Link>
            ) : null}
          </div>
        </div>

        {/* Scroll Hint */}
        <div
          className="absolute bottom-6 left-1/2 -translate-x-1/2 flex flex-col items-center gap-2 cursor-pointer z-10"
          onClick={() => {
            document.getElementById('latest-services')?.scrollIntoView({ behavior: 'smooth' });
          }}
        >
          <span className="text-xs uppercase tracking-widest text-ink-400 font-semibold">Scroll to Explore</span>
          <ArrowDown className="w-5 h-5 text-ink-400 animate-bounce" strokeWidth={2} />
        </div>
      </div>

      {/* Latest Services Section */}
      <section id="latest-services" className="mx-auto max-w-7xl px-4 md:px-8 lg:px-10 mt-10">
        <div className="rounded-3xl border border-white/70 bg-white/85 p-6 shadow-glow backdrop-blur md:p-8">
          <div className="border-b border-ink-100 pb-5 mb-8 flex justify-between items-end">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-aura-600">Marketplace</p>
              <h2 className="mt-2 font-display text-3xl font-bold text-ink-900">Latest Construction Services</h2>
            </div>
            <Link to="/services" className="text-sm font-semibold text-aura-600 hover:text-aura-700">View All &rarr;</Link>
          </div>

          {loadingServices ? (
            <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
              <SkeletonCard />
              <SkeletonCard />
              <SkeletonCard />
            </div>
          ) : services.length === 0 && hasScrolledToServices ? (
            <div className="text-center py-10"><p className="text-ink-600">No services found.</p></div>
          ) : (
            <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
              {services.map((service) => (
                <ServiceCard key={service.id} listing={service} />
              ))}
            </div>
          )}
        </div>
      </section>

      {/* Latest Products Section */}
      <section id="latest-products" className="mx-auto max-w-7xl px-4 md:px-8 lg:px-10 mt-6">
        <div className="rounded-3xl border border-white/70 bg-white/85 p-6 shadow-glow backdrop-blur md:p-8">
          <div className="border-b border-ink-100 pb-5 mb-8 flex justify-between items-end">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-aura-600">Inventory</p>
              <h2 className="mt-2 font-display text-3xl font-bold text-ink-900">Latest Construction Materials</h2>
            </div>
            <Link to="/products" className="text-sm font-semibold text-aura-600 hover:text-aura-700">View All &rarr;</Link>
          </div>

          {loadingProducts ? (
            <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
              <SkeletonCard />
              <SkeletonCard />
              <SkeletonCard />
            </div>
          ) : products.length === 0 && hasScrolledToProducts ? (
            <div className="text-center py-10"><p className="text-ink-600">No products found.</p></div>
          ) : (
            <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
              {products.map((product) => (
                <ProductCard key={product.id} product={product} />
              ))}
            </div>
          )}
        </div>
      </section>
    </>
  );
}

function InfoCard({ title, text }: { title: string; text: string }) {
  return (
    <div className="rounded-3xl border border-white/70 bg-white/90 p-5 shadow-sm">
      <h3 className="font-display text-lg font-semibold text-ink-900">{title}</h3>
      <p className="mt-2 text-sm leading-6 text-ink-600">{text}</p>
    </div>
  );
}

function StatusCard({ title, value, subtitle }: { title: string; value: string; subtitle: string }) {
  return (
    <div className="rounded-3xl border border-white/70 bg-white/80 p-5 shadow-sm backdrop-blur">
      <p className="text-sm font-medium uppercase tracking-[0.2em] text-ink-500">{title}</p>
      <p className="mt-2 font-display text-xl font-bold text-ink-900">{value}</p>
      <p className="mt-1 text-xs leading-5 text-ink-600">{subtitle}</p>
    </div>
  );
}
