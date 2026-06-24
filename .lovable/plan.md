## What is most likely causing the distortion

The strongest suspect is not the oscillator synth itself or the browser audio method. It looks like a trigger-logic bug in the Wheel mode:

- Reverse-spinning rings appear to apply direction twice.
- That can make the crossing detector think a note crossed a trigger line almost every frame.
- The current refractory window is only 40ms, so a reverse ring can repeatedly fire dense bass/pad notes many times per second.
- Those long-release voices then stack into the reverb/delay bus and overload the output, which sounds like heavy distortion/crunch.

Secondary contributors:

- Dry + chorus + reverb are summed in parallel, so FX can raise level even when the voice peaks are lowered.
- Long bass/pad releases overlap heavily.
- Feedback-based delay/reverb can build up if many notes are accidentally triggered.
- MacBook speakers can make clipping/low-mid buildup sound especially harsh, but they are probably revealing a real app-side issue.

## Would switching sound storage/playback methods help?

Probably not. Using samples, buffers, or another playback method would not solve the core issue if the app is firing too many notes or summing FX too hot.

The native Web Audio oscillator approach is still the right fit for this app. If we ever want a different timbre, we could pre-render synth notes into `AudioBuffer`s, but that would be an optimization/tone choice, not the distortion fix.

## Fix plan

1. **Fix Wheel crossing math**
   - Treat ring phase as the actual signed world rotation.
   - Compute previous/current note world angles without applying direction a second time.
   - Determine crossing direction from the actual phase delta.

2. **Add a musical trigger guard**
   - Increase the per note-line refractory window from `40ms` to something more ambient-safe, likely `120–180ms`.
   - Prevent accidental rapid retriggers from frame jitter or line overlap.

3. **Add output safety at the voice layer**
   - Track active voices and cap simultaneous voices.
   - If too many voices are active, skip or shorten the quietest/oldest new triggers instead of letting them pile up.

4. **Tame FX summing**
   - Convert dry/wet/chorus levels to safer gain staging so enabling FX does not multiply loudness.
   - Add a gentle high-pass before the limiter to remove low-frequency buildup.

5. **Verify with a debug meter**
   - Temporarily add an internal peak meter/log counter while testing.
   - Confirm notes are firing only at true line intersections and output no longer slams the limiter.

Expected result: the current synth remains, but the distortion should disappear because we stop the accidental trigger storm and keep the FX bus within safe headroom.