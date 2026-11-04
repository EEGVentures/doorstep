# Venue close-off profile: Tramshed, Cardiff

Status: TEST TEMPLATE. Approved by Nathan on 4 November 2026 as the first close-off venue. It uses the standard Doorstep close-off format in `docs/08` section 5a; there is no Tramshed-specific file layout or scanner adapter.

## Recipient

| Field | Value |
| --- | --- |
| Close-off recipient | nathan@ernestpromotions.com (internal test recipient) |
| Real venue box-office contact | Not yet supplied. Do not add one until Nathan provides it. |
| Delivery mode | Fixture and rehearsal only. Live sending stays off until Nathan separately approves activation for a real event. |

Reports go straight to this recipient as the scheduled job's direct delivery. This tests the real delivery path without involving the venue. It is not the old "email an admin to forward" workflow.

## Venue details

| Field | Value |
| --- | --- |
| Venue | Tramshed, Cardiff |
| Timezone | Europe/London (handle GMT/BST changes) |
| File format | Standard Doorstep close-off CSV (`docs/08` section 5a) |
| Barcode symbology | QR (standard) |

## Proposed schedule (relative to doors; per-event settings can override)

| Step | When | Notes |
| --- | --- | --- |
| Preview report v1 | Doors minus 48 hours | Same moment as the buyer reveal |
| Final close-off report | Doors minus 4 hours | Sales snapshot taken at this time |
| Late-sales revision reports | Every 30 minutes after the final report, until doors minus 30 minutes | Only if barcodes were added or revoked; versioned |
| Import acknowledgement due | Doors minus 2 hours | Missed acknowledgement raises an alert in the operations dashboard |

These timings are PROPOSED defaults. Nathan can change them; Claude must not hard-code them.

## Acceptance for this template

- A fixture Tramshed event produces v1, final and revision reports at the right local times, including across a clock change.
- Every file matches the standard CSV header exactly.
- A duplicate trigger does not create a duplicate version.
- A sold-out fixture event still gets its reports.
- A refunded ticket appears as a `revoked` row in the next revision, and its code never reappears.
- Delivery to the test recipient is recorded separately from acknowledgement.
