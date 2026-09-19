# Ready to Chat scroll reminders

## Build
- Keep the existing Ready to Chat card at the top of Discover as the single source for starting, confirming, and cancelling alerts.
- Add a compact Ready to Chat banner between profile cards at regular intervals as more profiles load.
- After sustained Discover scrolling, show a dismissible Ready to Chat prompt with a clear action.
- Make both reminders open the existing Text / Video / Both chooser, so all current eligibility, confirmation, loading, and server rules remain unchanged.
- Prevent repeated popups during the same Discover visit and hide reminders while an alert is active.

## Technical details
- Add a controlled open signal and active-state callback to the existing Ready to Chat card.
- Insert full-width reminder rows into the responsive profile grid at a fixed card interval.
- Trigger the popup from scroll depth, with session-only dismissal for the current page visit.
- Verify the responsive Discover flow and current build diagnostics.
