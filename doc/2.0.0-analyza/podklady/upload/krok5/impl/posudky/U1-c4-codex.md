1. **New assertions:** No finding. They require each tooltip to open and show the exact text; the checks do not depend on mount order or the repeated tooltip IDs.
2. **Chip isolation:** No finding. The helper reads `contentEl` from each chip’s own tooltip, so another chip’s bubble cannot satisfy it.
3. **Cycle 3 findings:** No finding; both reported test gaps are addressed.
4. **Outside the change:** No new finding. Read-only review; tests were not run.