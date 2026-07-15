filepath = r'd:\Easy2Work\wellness-pwa\frontend\src\features\testimonials\components\CoachTestimonialsPage.jsx'

with open(filepath, 'r', encoding='utf-8') as f:
    content = f.read()

# ─── 3. Replace Before pencil button ─────────────────────────────────────────
old3 = """              {editable && onEditBefore && (
                <button
                  type="button"
                  onClick={onEditBefore}
                  className="mt-1 inline-flex items-center gap-1 mx-auto px-2.5 py-1 rounded-full border border-gray-200 bg-white text-[10px] font-bold text-gray-600 hover:border-green-400 hover:text-green-700 transition-colors"
                >
                  <Pencil className="h-3 w-3" /> {testimonial?.beforeImageUrl ? 'Edit' : 'Add'}
                </button>
              )}"""

new3 = """              {editable && (
                <button
                  type="button"
                  onClick={() => toggleSlot('before')}
                  className={`mt-1 inline-flex items-center gap-1 mx-auto px-2.5 py-1 rounded-full border bg-white text-[10px] font-bold transition-colors ${expandedSlots.has('before') ? 'border-green-500 text-green-700 bg-green-50' : 'border-gray-200 text-gray-600 hover:border-green-400 hover:text-green-700'}`}
                >
                  <Pencil className="h-3 w-3" /> {testimonial?.beforeImageUrl ? 'Edit' : 'Add'}
                </button>
              )}"""

if old3 in content:
    content = content.replace(old3, new3)
    print('Step 3: Before pencil button updated')
else:
    print('Step 3 FAILED')

# ─── 4. Replace After pencil button ──────────────────────────────────────────
old4 = """              {editable && onEditAfter && (
                <button
                  type="button"
                  onClick={onEditAfter}
                  className="mt-1 inline-flex items-center gap-1 mx-auto px-2.5 py-1 rounded-full border border-gray-200 bg-white text-[10px] font-bold text-gray-600 hover:border-purple-400 hover:text-purple-700 transition-colors"
                >
                  <Pencil className="h-3 w-3" /> {hasAfter && testimonial?.afterImageUrl ? 'Edit' : 'Add'}
                </button>"""

new4 = """              {editable && (
                <button
                  type="button"
                  onClick={() => toggleSlot('after')}
                  className={`mt-1 inline-flex items-center gap-1 mx-auto px-2.5 py-1 rounded-full border bg-white text-[10px] font-bold transition-colors ${expandedSlots.has('after') ? 'border-purple-500 text-purple-700 bg-purple-50' : 'border-gray-200 text-gray-600 hover:border-purple-400 hover:text-purple-700'}`}
                >
                  <Pencil className="h-3 w-3" /> {hasAfter && testimonial?.afterImageUrl ? 'Edit' : 'Add'}
                </button>"""

if old4 in content:
    content = content.replace(old4, new4)
    print('Step 4: After pencil button updated')
else:
    print('Step 4 FAILED')

# ─── 5. Replace the inline photo OTP block with unified OTP + inline edit panels ──
old5 = """      {/* Photo OTP — directly under Before/After images (Mine, when pending) */}
      {editable && testimonial?.status === 'pending' && testimonial?.id && (
        <OtpInline
          testimonialId={testimonial.id}
          type="photo"
          onVerified={onOtpVerified}
        />
      )}"""

new5 = """      {/* Before inline edit panel */}
      {editable && expandedSlots.has('before') && (
        <div className="bg-gray-50 border border-green-200 rounded-2xl p-3 space-y-3">
          <p className="text-xs font-bold text-green-800 uppercase tracking-wide">Edit Before Photo</p>
          <div className="text-center space-y-2">
            <img
              src={draftBefore?.previewUrl || testimonial?.beforeImageUrl || undefined}
              alt="Before preview"
              className="w-28 h-36 object-cover rounded-xl mx-auto border border-gray-200"
              style={{ display: (draftBefore?.previewUrl || testimonial?.beforeImageUrl) ? 'block' : 'none' }}
            />
            <div className="flex gap-2">
              <button type="button" onClick={() => beforeCamRef.current?.click()}
                className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-xl bg-green-600 text-white text-[11px] font-bold">
                <Camera className="h-3.5 w-3.5" /> Camera
              </button>
              <button type="button" onClick={() => beforeGalRef.current?.click()}
                className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-xl border border-gray-300 text-gray-700 text-[11px] font-bold">
                <Images className="h-3.5 w-3.5" /> Gallery
              </button>
            </div>
            <input ref={beforeCamRef} type="file" accept="image/*" capture="environment" className="hidden"
              onChange={(e) => e.target.files?.[0] && handleImageFile('before', e.target.files[0])} />
            <input ref={beforeGalRef} type="file" accept="image/*" className="hidden"
              onChange={(e) => e.target.files?.[0] && handleImageFile('before', e.target.files[0])} />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="block text-[10px] font-bold text-gray-500 mb-1">Before Weight (kg)</label>
              <input type="number" step="0.1" min="1" max="500" placeholder={testimonial?.beforeWeightKg || ''}
                value={draftBefore?.weightKg ?? ''}
                onChange={(e) => setDraftBefore(prev => ({ ...(prev || {}), weightKg: parseFloat(e.target.value) || undefined }))}
                className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-400" />
            </div>
            <div>
              <label className="block text-[10px] font-bold text-gray-500 mb-1">Goal</label>
              <select value={draftBefore?.goalType || testimonial?.goalType || 'loss'}
                onChange={(e) => setDraftBefore(prev => ({ ...(prev || {}), goalType: e.target.value }))}
                className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-400">
                <option value="loss">Weight Loss</option>
                <option value="gain">Weight Gain</option>
              </select>
            </div>
          </div>
          <div>
            <label className="block text-[10px] font-bold text-gray-500 mb-1">Duration (e.g. "3 months")</label>
            <input type="text" placeholder={testimonial?.durationText || 'e.g. 3 months'}
              value={draftBefore?.durationText ?? ''}
              onChange={(e) => setDraftBefore(prev => ({ ...(prev || {}), durationText: e.target.value }))}
              className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-400" />
          </div>
        </div>
      )}

      {/* After inline edit panel */}
      {editable && expandedSlots.has('after') && (
        <div className="bg-gray-50 border border-purple-200 rounded-2xl p-3 space-y-3">
          <p className="text-xs font-bold text-purple-800 uppercase tracking-wide">Edit After Photo</p>
          <div className="text-center space-y-2">
            <img
              src={draftAfter?.previewUrl || (hasAfter ? testimonial?.afterImageUrl : undefined) || undefined}
              alt="After preview"
              className="w-28 h-36 object-cover rounded-xl mx-auto border border-gray-200"
              style={{ display: (draftAfter?.previewUrl || (hasAfter && testimonial?.afterImageUrl)) ? 'block' : 'none' }}
            />
            <div className="flex gap-2">
              <button type="button" onClick={() => afterCamRef.current?.click()}
                className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-xl bg-purple-600 text-white text-[11px] font-bold">
                <Camera className="h-3.5 w-3.5" /> Camera
              </button>
              <button type="button" onClick={() => afterGalRef.current?.click()}
                className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-xl border border-gray-300 text-gray-700 text-[11px] font-bold">
                <Images className="h-3.5 w-3.5" /> Gallery
              </button>
            </div>
            <input ref={afterCamRef} type="file" accept="image/*" capture="environment" className="hidden"
              onChange={(e) => e.target.files?.[0] && handleImageFile('after', e.target.files[0])} />
            <input ref={afterGalRef} type="file" accept="image/*" className="hidden"
              onChange={(e) => e.target.files?.[0] && handleImageFile('after', e.target.files[0])} />
          </div>
          <div>
            <label className="block text-[10px] font-bold text-gray-500 mb-1">After Weight (kg)</label>
            <input type="number" step="0.1" min="1" max="500" placeholder={hasAfter ? testimonial?.afterWeightKg : ''}
              value={draftAfter?.weightKg ?? ''}
              onChange={(e) => setDraftAfter(prev => ({ ...(prev || {}), weightKg: parseFloat(e.target.value) || undefined }))}
              className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-purple-400" />
          </div>
        </div>
      )}

      {/* Unified OTP — after submitting all edits */}
      {editable && submitDone && (
        <UnifiedOtpInline userId={userId} onVerified={handleUnifiedOtpVerified} />
      )}

      {/* Existing pending OTP (from old per-slot flow) — only show if not yet in new submit flow */}
      {editable && !submitDone && testimonial?.status === 'pending' && testimonial?.id && (
        <OtpInline
          testimonialId={testimonial.id}
          type="photo"
          onVerified={onOtpVerified}
        />
      )}"""

if old5 in content:
    content = content.replace(old5, new5)
    print('Step 5: Photo OTP + inline panels added')
else:
    print('Step 5 FAILED')

# ─── 6. Replace VideoThumbnailBtn usage with VideoThumbnailCard ───────────────
old6a = """              <VideoThumbnailBtn
                url={testimonial?.healthVideoUrl ?? null}
                label="Health Results"
                iconColor="text-green-600"
              />
              {editable && onEditHealth && (
                <button
                  type="button"
                  onClick={onEditHealth}
                  className="inline-flex items-center gap-1 px-2 py-1 rounded-full border border-gray-200 bg-white text-[10px] font-bold text-gray-600 hover:border-green-400 hover:text-green-700 transition-colors"
                >
                  <Pencil className="h-3 w-3" /> {testimonial?.healthVideoUrl ? 'Edit' : 'Add'}
                </button>
              )}"""

new6a = """              <VideoThumbnailCard
                url={testimonial?.healthVideoUrl ?? null}
                localPreviewUrl={draftHealthPreview}
                label="Health Results"
                accentColor="bg-green-600"
                compact={true}
              />
              {editable && (
                <button
                  type="button"
                  onClick={() => toggleSlot('health')}
                  className={`inline-flex items-center gap-1 px-2 py-1 rounded-full border bg-white text-[10px] font-bold transition-colors ${expandedSlots.has('health') ? 'border-green-500 text-green-700 bg-green-50' : 'border-gray-200 text-gray-600 hover:border-green-400 hover:text-green-700'}`}
                >
                  <Pencil className="h-3 w-3" /> {testimonial?.healthVideoUrl ? 'Edit' : 'Add'}
                </button>
              )}"""

if old6a in content:
    content = content.replace(old6a, new6a)
    print('Step 6a: Health video replaced')
else:
    print('Step 6a FAILED')

old6b = """              <VideoThumbnailBtn
                url={testimonial?.businessVideoUrl ?? null}
                label="Business Results"
                iconColor="text-blue-600"
              />
              {editable && onEditBusiness && (
                <button
                  type="button"
                  onClick={onEditBusiness}
                  className="inline-flex items-center gap-1 px-2 py-1 rounded-full border border-gray-200 bg-white text-[10px] font-bold text-gray-600 hover:border-blue-400 hover:text-blue-700 transition-colors"
                >
                  <Pencil className="h-3 w-3" /> {testimonial?.businessVideoUrl ? 'Edit' : 'Add'}
                </button>
              )}"""

new6b = """              <VideoThumbnailCard
                url={testimonial?.businessVideoUrl ?? null}
                localPreviewUrl={draftBusinessPreview}
                label="Business Results"
                accentColor="bg-blue-600"
                compact={true}
              />
              {editable && (
                <button
                  type="button"
                  onClick={() => toggleSlot('business')}
                  className={`inline-flex items-center gap-1 px-2 py-1 rounded-full border bg-white text-[10px] font-bold transition-colors ${expandedSlots.has('business') ? 'border-blue-500 text-blue-700 bg-blue-50' : 'border-gray-200 text-gray-600 hover:border-blue-400 hover:text-blue-700'}`}
                >
                  <Pencil className="h-3 w-3" /> {testimonial?.businessVideoUrl ? 'Edit' : 'Add'}
                </button>
              )}"""

if old6b in content:
    content = content.replace(old6b, new6b)
    print('Step 6b: Business video replaced')
else:
    print('Step 6b FAILED')

# ─── 7. Replace video OTP block with inline video edit panels + unified OTP ──
old7 = """          {/* Video OTP under Result Videos (Mine) — same block as Verify Your Videos */}
          {editable && testimonial?.videoStatus === 'pending' && testimonial?.id && (
            <div className="bg-white rounded-2xl border border-amber-200 shadow-sm px-4 py-4 space-y-1 mt-1">
              <p className="text-xs font-bold text-amber-700 uppercase tracking-wide flex items-center gap-1.5">
                <ShieldCheck className="h-3.5 w-3.5" /> Verify Your Videos
              </p>
              <p className="text-xs text-gray-500 pb-1">
                One OTP covers both uploaded videos. Ask your coach for the code they received by email.
              </p>
              <OtpInline
                testimonialId={testimonial.id}
                type="video"
                onVerified={onOtpVerified}
              />
            </div>
          )}"""

new7 = """          {/* Health video inline edit panel */}
          {editable && expandedSlots.has('health') && (
            <div className="bg-gray-50 border border-green-200 rounded-2xl p-3 space-y-2">
              <p className="text-xs font-bold text-green-800 uppercase tracking-wide">Edit Health Results Video</p>
              {draftHealthPreview && (
                <VideoThumbnailCard url={null} localPreviewUrl={draftHealthPreview} label="Health Results" accentColor="bg-green-600" className="h-28" />
              )}
              {!draftHealthPreview && testimonial?.healthVideoUrl && (
                <VideoThumbnailCard url={testimonial.healthVideoUrl} label="Current Health Video" accentColor="bg-green-600" className="h-28" />
              )}
              {uploadingHealth ? (
                <div className="flex items-center justify-center gap-2 py-3 text-green-700 text-xs font-semibold">
                  <Upload className="h-3.5 w-3.5 animate-bounce" /> Uploading video…
                </div>
              ) : (
                <button type="button" onClick={() => healthVidRef.current?.click()}
                  className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl bg-green-600 text-white text-xs font-bold">
                  <Video className="h-3.5 w-3.5" /> {testimonial?.healthVideoUrl ? 'Replace video' : 'Select video'}
                </button>
              )}
              <input ref={healthVidRef} type="file" accept="video/*" className="hidden"
                onChange={(e) => e.target.files?.[0] && handleVideoFile('health', e.target.files[0])} />
              <p className="text-[10px] text-gray-400 text-center">Max 1 minute · MP4 recommended</p>
            </div>
          )}

          {/* Business video inline edit panel */}
          {editable && expandedSlots.has('business') && (
            <div className="bg-gray-50 border border-blue-200 rounded-2xl p-3 space-y-2">
              <p className="text-xs font-bold text-blue-800 uppercase tracking-wide">Edit Business Results Video</p>
              {draftBusinessPreview && (
                <VideoThumbnailCard url={null} localPreviewUrl={draftBusinessPreview} label="Business Results" accentColor="bg-blue-600" className="h-28" />
              )}
              {!draftBusinessPreview && testimonial?.businessVideoUrl && (
                <VideoThumbnailCard url={testimonial.businessVideoUrl} label="Current Business Video" accentColor="bg-blue-600" className="h-28" />
              )}
              {uploadingBusiness ? (
                <div className="flex items-center justify-center gap-2 py-3 text-blue-700 text-xs font-semibold">
                  <Upload className="h-3.5 w-3.5 animate-bounce" /> Uploading video…
                </div>
              ) : (
                <button type="button" onClick={() => businessVidRef.current?.click()}
                  className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl bg-blue-600 text-white text-xs font-bold">
                  <Video className="h-3.5 w-3.5" /> {testimonial?.businessVideoUrl ? 'Replace video' : 'Select video'}
                </button>
              )}
              <input ref={businessVidRef} type="file" accept="video/*" className="hidden"
                onChange={(e) => e.target.files?.[0] && handleVideoFile('business', e.target.files[0])} />
              <p className="text-[10px] text-gray-400 text-center">Max 2 minutes · MP4 recommended</p>
            </div>
          )}

          {/* Existing video OTP (old per-slot flow, not yet migrated) */}
          {editable && !submitDone && testimonial?.videoStatus === 'pending' && testimonial?.id && (
            <div className="bg-white rounded-2xl border border-amber-200 shadow-sm px-4 py-4 space-y-1 mt-1">
              <p className="text-xs font-bold text-amber-700 uppercase tracking-wide flex items-center gap-1.5">
                <ShieldCheck className="h-3.5 w-3.5" /> Verify Your Videos
              </p>
              <p className="text-xs text-gray-500 pb-1">
                Ask your coach for the OTP they received by email.
              </p>
              <OtpInline
                testimonialId={testimonial.id}
                type="video"
                onVerified={onOtpVerified}
              />
            </div>
          )}"""

if old7 in content:
    content = content.replace(old7, new7)
    print('Step 7: Video OTP replaced with inline panels')
else:
    print('Step 7 FAILED')

# ─── 8. Replace Issues pencil button ─────────────────────────────────────────
old8 = """            {editable && onEditIssues && (
              <button
                type="button"
                onClick={onEditIssues}
                className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full border border-gray-200 bg-white text-[10px] font-bold text-gray-600 hover:border-rose-400 hover:text-rose-700 transition-colors shrink-0"
              >
                <Pencil className="h-3 w-3" /> {issues.length > 0 ? 'Edit' : 'Add'}
              </button>
            )}"""

new8 = """            {editable && (
              <button
                type="button"
                onClick={() => toggleSlot('issues')}
                className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full border bg-white text-[10px] font-bold transition-colors shrink-0 ${expandedSlots.has('issues') ? 'border-rose-400 text-rose-700 bg-rose-50' : 'border-gray-200 text-gray-600 hover:border-rose-400 hover:text-rose-700'}`}
              >
                <Pencil className="h-3 w-3" /> {issues.length > 0 ? 'Edit' : 'Add'}
              </button>
            )}"""

if old8 in content:
    content = content.replace(old8, new8)
    print('Step 8: Issues pencil button updated')
else:
    print('Step 8 FAILED')

# ─── 9. Add issues inline edit panel after the issues display ────────────────
old9 = """          {issues.length > 0 ? (
            <div className="flex flex-wrap gap-1">
              {issues.map((issue) => (
                <span key={issue} className="inline-flex items-center max-w-full px-2 py-0.5 bg-rose-50 border border-rose-200 rounded-full text-[10px] sm:text-[11px] font-medium text-rose-800">
                  <span className="truncate">{issue}</span>
                </span>
              ))}
            </div>
          ) : (
            <p className="text-[11px] text-gray-400 italic">Not added yet</p>
          )}
        </div>
      )}"""

new9 = """          {issues.length > 0 ? (
            <div className="flex flex-wrap gap-1">
              {issues.map((issue) => (
                <span key={issue} className="inline-flex items-center max-w-full px-2 py-0.5 bg-rose-50 border border-rose-200 rounded-full text-[10px] sm:text-[11px] font-medium text-rose-800">
                  <span className="truncate">{issue}</span>
                </span>
              ))}
            </div>
          ) : (
            <p className="text-[11px] text-gray-400 italic">Not added yet</p>
          )}

          {/* Issues inline edit panel */}
          {editable && expandedSlots.has('issues') && (
            <div className="bg-gray-50 border border-rose-200 rounded-2xl p-3 space-y-2 mt-1">
              <p className="text-xs font-bold text-rose-800 uppercase tracking-wide">Edit Health Issues</p>
              <DiseaseMultiSelect
                value={draftIssues ?? issues}
                onChange={(val) => setDraftIssues(val)}
              />
            </div>
          )}
        </div>
      )}

      {/* ── Submit for Approval button (Mine, when any slot has draft changes) ── */}
      {editable && hasDirtySlots && !submitDone && (
        <div className="space-y-2 pt-1">
          {submitError && (
            <p className="text-xs text-red-600 text-center bg-red-50 rounded-xl px-3 py-2">{submitError}</p>
          )}
          <button
            type="button"
            onClick={handleSubmitAll}
            disabled={isSubmitting || anyVideoUploading}
            className="w-full flex items-center justify-center gap-2 py-3 rounded-2xl bg-green-600 hover:bg-green-700 text-white text-sm font-bold shadow-sm disabled:opacity-60 transition-colors"
          >
            {isSubmitting
              ? <><div className="h-4 w-4 rounded-full border-2 border-white/40 border-t-white animate-spin" /> Submitting…</>
              : anyVideoUploading
              ? <><Upload className="h-4 w-4 animate-bounce" /> Uploading video…</>
              : <><Save className="h-4 w-4" /> Submit for Approval</>
            }
          </button>
          <p className="text-[10px] text-gray-400 text-center">
            {dirtySlots.length} item{dirtySlots.length > 1 ? 's' : ''} changed — your coach will receive one verification email
          </p>
        </div>
      )}"""

if old9 in content:
    content = content.replace(old9, new9)
    print('Step 9: Issues panel + Submit button added')
else:
    print('Step 9 FAILED')

with open(filepath, 'w', encoding='utf-8') as f:
    f.write(content)
print('File written successfully.')
