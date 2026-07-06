/**
 * TestimonialForm.jsx
 * Form for uploading before/after transformation photos.
 *
 * Supports partial submission:
 *   - Before photo only â†’ saved as 'incomplete' (come back for after)
 *   - Both photos       â†’ complete, OTP email sent to coach
 *
 * Each image picker offers two options: take a fresh photo OR pick from gallery.
 */
import React, { useRef } from 'react';
import { Camera, Images, CheckCircle, Plus } from 'lucide-react';
import TouchFeedbackButton from '../../../shared/components/TouchFeedbackButton';

/**
 * Single image picker with two tap targets: Camera and Gallery.
