/**
 * testimonials/index.js — Public barrel for the testimonials feature slice.
 * External code MUST import from here — no deep imports.
 */
export { default as TestimonialsPage } from './components/TestimonialsPage';
export { default as CoachTestimonialsPage } from './components/CoachTestimonialsPage';
export { useTestimonial } from './hooks/useTestimonial';
export { submitTestimonial, editTestimonial, getMyTestimonial, verifyTestimonialOtp, listForCoach } from './services/testimonialApi';
