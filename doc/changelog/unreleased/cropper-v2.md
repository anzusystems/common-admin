planned
===

### Added

- **A new image cropper, built on cropper.js v2.** It replaces `ACropperjs`, which is built on
  cropper.js 1.6.3 — a version with no release since, whose successor is a different library: v2
  ships a set of custom elements (`<cropper-canvas>`, `<cropper-image>`, `<cropper-selection>`, …)
  rather than one class that rewrites your `<img>` into a tree of divs.

  It is **not exported**, and it lives beside the one thing that uses it, under
  `components/damImage/uploadQueue/cropper/`. No application reaches for a cropper directly —
  `admin-dam` gets one through `DamAssetImageRoiSelect`, which it renders in four places, and
  `admin-blog`, `admin-forum`, `admin-inhouse`, `admin-ugc` and `admin-cms` have no cropper at all.
  Shaping it to that one need rather than to cropper.js v1's API is what keeps it small.

  What it takes: a `src`, an `aspectRatio`, a `containerStyle`, a `shadeColor`, and the crop itself
  as a `v-model`. What it says: `update:modelValue` as the crop changes, `commit` when the user
  finishes a gesture, `ready` when there is something to look at. There is no imperative surface —
  no `enable`, `disable`, `destroy`, `getData`, `setData` or `getImageData`.

  **The crop is carried as fractions of the picture, 0 to 1.** cropper.js v1 spoke in the pixels of
  whatever image it had loaded, so a region had to be converted into that unit on the way in and out
  of it. Those conversions cancelled: a detail rendition is a scaled copy of the original, and the
  scale appeared once on each side of every sum. In fractions the conversion is what it always
  really was — `pointX / width` one way, `x * width` the other.

  The elements are assembled in script rather than in the template, because a consumer of this
  library does not configure `isCustomElement` in their own build, and setting element properties
  directly avoids the coercion that an attribute round-trip imposes on `NaN`, booleans and
  fractional numbers.

  What the two croppers do differently, all of it deliberate:

  - **`shadeColor` replaces overriding `.cropper-modal`.** The wash over everything outside the crop
    now lives inside a shadow root, where a page-level selector cannot reach it, so the colour is a
    prop. The DAM passes `rgba(241, 244, 246, 0.5)`, which is what its
    `.cropper-modal { background-color: #f1f4f6 }` override resolved to.
  - **A source narrower than its container is no longer scaled up.** v1 measured its container
    through an inline `<img>`, so the font's descender made the container a few pixels taller than
    the picture and the picture was stretched to fill it — a 240px wide image came out at 247px. The
    frame still takes the full width and still centres the picture between two shaded margins.
  - **A tall picture is scaled to fit the frame instead of being cut off by it.** v1 sized its canvas
    from its own container's measured height, which covered a `max-height` on that container but not
    one on an ancestor: in a clipped ancestor the picture ran off the bottom, and the part of the
    crop down there could not be dragged back. The canvas now fits whatever height will actually be
    shown. An ancestor that *scrolls* is left alone — there the rest of the picture is a scroll away.
  - **Dragging out a brand new crop box uses the whole gesture.** v1 spent the first pointer move
    creating a minimum-sized box and only started sizing it from the second, so the box trailed the
    cursor by one move event.
  - **A new `src` rebuilds the cropper in place.** v1 ignored the prop, which is why hosts key the
    component to force a remount. Keying still works and the DAM still does it.
  - **The wheel is left to the page and pinch still zooms.** v1 had these as two options; the one
    caller turned the wheel off and left pinch on, so that is what happens. cropper.js v2's canvas
    calls `preventDefault()` on every wheel event it sees, which would otherwise stop a DAM user
    scrolling a dialog with the cursor over the picture.
  - **Rotation and flipping are gone.** The DAM rotates images server-side and reloads them, which is
    what `AssetFileRotate` already does.

  Everything else — the initial 80% crop, the rule-of-thirds guides, the centre marker, the eight
  resize grips, the blue outline and the faint band along it, aspect-ratio locking, clamping to the
  picture while dragging and resizing, re-fitting when the frame changes — is reproduced down to the
  colours from `cropper.css`. A shared suite runs the same assertions against both components.

### Changed

- **`regionToCrop` and `cropToRegion` no longer take a cropper.** They convert between a stored
  region and a crop rectangle using the source image's own dimensions, which is all they ever needed:

  ```ts
  regionToCrop(roi, originalWidth, originalHeight)          // was (cropper, roi, w, h)
  cropToRegion(crop, roi, originalWidth, originalHeight)    // was (cropper, roi, w, h)
  ```

### Fixed

- **A region saved flush against an edge could shrink by up to a tenth of the picture.**
  `cropToRegion` corrected a crop that overran the edge by subtracting a pixel count multiplied by a
  hundred from a fraction. A 0.6px rounding overshoot on a 600px image turned a stored
  `percentageHeight` of `0.401` into `0.301`. It fired whenever the crop sat on an edge and the
  fraction rounded up at the third decimal — about half the time. The correction is gone: the
  cropper already guarantees the crop is inside the picture, so there is nothing to correct.

### Deprecated

- **`ACropperjs`.** Still exported and still working, for now on cropper.js 1.6.3 installed beside
  v2 under an alias. It has no users in this organisation.

### Removed

- **`ACropperjsExposed`.** It described the deprecated component's exposed methods and nothing used
  it; `InstanceType<typeof ACropperjs>` says the same thing.
- **`ACropperjsV2.vue`**, an earlier attempt at this migration that never left the comment block it
  was written in.
