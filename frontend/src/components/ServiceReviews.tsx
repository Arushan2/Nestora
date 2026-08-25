import { useState, useEffect } from 'react';
import { Star, MessageSquare, Plus, CheckCircle, AlertCircle, Loader2 } from 'lucide-react';
import { requestJson } from '../lib/api';
import type { User } from '../types/session';
import { Button } from './ui/button';
import { Dialog, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from './ui/dialog';

export interface ServiceReviewItem {
  id: number;
  service_id: number;
  user_id: number;
  rating: number;
  comment: string;
  created_at: string;
  reviewer_name: string;
}

export interface ServiceReviewsSummary {
  total_reviews: number;
  avg_rating: number;
  rating_counts: { [key: number]: number };
}

export function ServiceReviews({
  serviceId,
  serviceTitle,
  user,
  onReviewSubmitted,
}: {
  serviceId: number;
  serviceTitle?: string;
  user: User | null;
  onReviewSubmitted?: () => void;
}) {
  const [reviews, setReviews] = useState<ServiceReviewItem[]>([]);
  const [summary, setSummary] = useState<ServiceReviewsSummary>({
    total_reviews: 0,
    avg_rating: 0,
    rating_counts: { 5: 0, 4: 0, 3: 0, 2: 0, 1: 0 },
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // Write Review Modal
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [rating, setRating] = useState(5);
  const [hoverRating, setHoverRating] = useState(0);
  const [comment, setComment] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState('');
  const [submitSuccess, setSubmitSuccess] = useState('');

  const fetchReviews = async () => {
    try {
      setLoading(true);
      setError('');
      const data = (await requestJson<unknown>(
        `/api/service-listings/${serviceId}/reviews`
      )) as {
        reviews: ServiceReviewItem[];
        summary: ServiceReviewsSummary;
      };

      setReviews(data.reviews || []);
      setSummary(
        data.summary || {
          total_reviews: 0,
          avg_rating: 0,
          rating_counts: { 5: 0, 4: 0, 3: 0, 2: 0, 1: 0 },
        }
      );

    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load service reviews.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (serviceId) {
      void fetchReviews();
    }
  }, [serviceId]);

  const handleSubmitReview = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!comment.trim()) {
      setSubmitError('Please write a comment describing your experience.');
      return;
    }

    setSubmitting(true);
    setSubmitError('');
    setSubmitSuccess('');

    try {
      await requestJson(`/api/service-listings/${serviceId}/reviews`, {
        rating,
        comment: comment.trim(),
      });

      setSubmitSuccess('Thank you! Your service review has been submitted.');
      setComment('');
      setRating(5);
      await fetchReviews();
      if (onReviewSubmitted) onReviewSubmitted();
      setTimeout(() => {
        setIsModalOpen(false);
        setSubmitSuccess('');
      }, 1500);
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : 'Unable to submit service review.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-8">
      {/* Header & Rating Summary */}
      <div className="rounded-3xl border border-white/70 bg-white/80 p-6 md:p-8 shadow-sm backdrop-blur">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 pb-6 border-b border-ink-100">
          <div>
            <h2 className="font-display text-2xl font-bold text-ink-900 flex items-center gap-2">
              <Star className="h-6 w-6 text-amber-400 fill-amber-400" />
              Customer Reviews & Ratings
            </h2>
            <p className="mt-1 text-xs text-ink-500">
              Verified feedback from clients who hired {serviceTitle || 'this service'}.
            </p>
          </div>

          {user && (
            <Button
              onClick={() => {
                setSubmitError('');
                setSubmitSuccess('');
                setIsModalOpen(true);
              }}
              className="rounded-2xl bg-aura-600 hover:bg-aura-700 text-white font-bold gap-2 self-start md:self-auto shadow-md"
            >
              <Plus className="h-4 w-4" />
              <span>Write a Review</span>
            </Button>
          )}
        </div>

        {loading ? (
          <div className="flex h-32 items-center justify-center">
            <Loader2 className="h-6 w-6 animate-spin text-aura-600" />
          </div>
        ) : error ? (
          <div className="p-4 text-xs font-semibold text-red-600 bg-red-50 rounded-2xl mt-4">
            {error}
          </div>
        ) : (
          <div className="grid gap-6 md:grid-cols-12 mt-6 items-center">
            {/* Average Rating Block */}
            <div className="md:col-span-4 flex flex-col items-center justify-center p-6 rounded-2xl bg-amber-50/50 border border-amber-100 text-center">
              <span className="font-display text-5xl font-extrabold text-ink-900">
                {summary.avg_rating.toFixed(1)}
              </span>
              <div className="flex items-center gap-1 my-2">
                {[1, 2, 3, 4, 5].map((star) => (
                  <Star
                    key={star}
                    className={`h-5 w-5 ${
                      star <= Math.round(summary.avg_rating)
                        ? 'text-amber-400 fill-amber-400'
                        : 'text-ink-200'
                    }`}
                  />
                ))}
              </div>
              <span className="text-xs font-semibold text-ink-500">
                Based on {summary.total_reviews} review{summary.total_reviews === 1 ? '' : 's'}
              </span>
            </div>

            {/* Star Distribution Progress Bars */}
            <div className="md:col-span-8 space-y-2">
              {[5, 4, 3, 2, 1].map((star) => {
                const count = summary.rating_counts[star] || 0;
                const percentage =
                  summary.total_reviews > 0 ? (count / summary.total_reviews) * 100 : 0;

                return (
                  <div key={star} className="flex items-center gap-3 text-xs">
                    <div className="flex items-center gap-1 w-12 text-ink-600 font-bold">
                      <span>{star}</span>
                      <Star className="h-3.5 w-3.5 text-amber-400 fill-amber-400" />
                    </div>
                    <div className="flex-1 h-2.5 rounded-full bg-ink-100 overflow-hidden">
                      <div
                        className="h-full bg-amber-400 rounded-full transition-all duration-500"
                        style={{ width: `${percentage}%` }}
                      />
                    </div>
                    <span className="w-8 text-right font-semibold text-ink-400">{count}</span>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {/* Reviews List */}
      <div className="space-y-4">
        {reviews.length === 0 && !loading ? (
          <div className="rounded-3xl border border-dashed border-ink-200 bg-white/70 p-8 text-center backdrop-blur">
            <MessageSquare className="mx-auto h-8 w-8 text-ink-300 mb-2" />
            <p className="text-sm font-semibold text-ink-600">No reviews yet.</p>
            <p className="text-xs text-ink-400 mt-1">
              Be the first client to submit a review for this service listing!
            </p>
          </div>
        ) : (
          reviews.map((rev) => (
            <div
              key={rev.id}
              className="rounded-3xl border border-white/70 bg-white/80 p-6 shadow-sm backdrop-blur space-y-3"
            >
              <div className="flex items-center justify-between">
                <div>
                  <h4 className="font-bold text-ink-900 text-sm">{rev.reviewer_name}</h4>
                  <p className="text-[11px] text-ink-400">
                    {new Date(rev.created_at).toLocaleDateString(undefined, {
                      year: 'numeric',
                      month: 'short',
                      day: 'numeric',
                    })}
                  </p>
                </div>
                <div className="flex items-center gap-1 bg-amber-50 px-2.5 py-1 rounded-full border border-amber-200">
                  {[1, 2, 3, 4, 5].map((star) => (
                    <Star
                      key={star}
                      className={`h-3.5 w-3.5 ${
                        star <= rev.rating ? 'text-amber-400 fill-amber-400' : 'text-ink-200'
                      }`}
                    />
                  ))}
                  <span className="ml-1 text-xs font-bold text-amber-900">{rev.rating}.0</span>
                </div>
              </div>
              <p className="text-xs text-ink-700 leading-relaxed">{rev.comment}</p>
            </div>
          ))
        )}
      </div>

      {/* Submit Review Modal */}
      <Dialog isOpen={isModalOpen} onClose={() => setIsModalOpen(false)}>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Star className="h-5 w-5 text-amber-400 fill-amber-400" />
            <span>Review Service: {serviceTitle || 'Service'}</span>
          </DialogTitle>
          <DialogDescription>
            Share your rating and feedback to help others find quality pro services.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmitReview} className="space-y-4 py-2">
          {submitError && (
            <div className="rounded-2xl bg-red-50 p-3 text-xs font-semibold text-red-600 flex items-center gap-2">
              <AlertCircle className="h-4 w-4 shrink-0" />
              <span>{submitError}</span>
            </div>
          )}

          {submitSuccess && (
            <div className="rounded-2xl bg-emerald-50 p-3 text-xs font-semibold text-emerald-700 flex items-center gap-2">
              <CheckCircle className="h-4 w-4 shrink-0" />
              <span>{submitSuccess}</span>
            </div>
          )}

          {/* Star Rating Picker */}
          <div className="space-y-1.5 text-center py-2">
            <label className="text-xs font-bold text-ink-900 block">Your Overall Rating</label>
            <div className="flex justify-center gap-2">
              {[1, 2, 3, 4, 5].map((star) => {
                const activeStar = hoverRating > 0 ? star <= hoverRating : star <= rating;

                return (
                  <button
                    key={star}
                    type="button"
                    onClick={() => setRating(star)}
                    onMouseEnter={() => setHoverRating(star)}
                    onMouseLeave={() => setHoverRating(0)}
                    className="p-1 transition-transform hover:scale-125 focus:outline-none"
                  >
                    <Star
                      className={`h-8 w-8 ${
                        activeStar ? 'text-amber-400 fill-amber-400' : 'text-ink-200'
                      }`}
                    />
                  </button>
                );
              })}
            </div>
            <p className="text-xs font-semibold text-amber-700">
              {rating === 5 && 'Excellent Service!'}
              {rating === 4 && 'Very Good Service!'}
              {rating === 3 && 'Average Experience'}
              {rating === 2 && 'Below Expectations'}
              {rating === 1 && 'Poor Experience'}
            </p>
          </div>

          {/* Comment Field */}
          <div className="space-y-1">
            <label className="text-xs font-bold text-ink-900 block">Your Review Comment *</label>
            <textarea
              rows={4}
              required
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              placeholder="Describe the quality of work, professionalism, timeliness, and communication..."
              className="w-full rounded-2xl border border-ink-200 p-3 text-xs focus:border-aura-600 focus:outline-none focus:ring-2 focus:ring-aura-600/20"
            />
          </div>

          <DialogFooter className="mt-4 pt-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => setIsModalOpen(false)}
              disabled={submitting}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={submitting || !comment.trim()}
              className="bg-aura-600 hover:bg-aura-700 text-white font-bold"
            >
              {submitting ? 'Submitting...' : 'Submit Review'}
            </Button>
          </DialogFooter>
        </form>
      </Dialog>
    </div>
  );
}
