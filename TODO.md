# TODO

## Booking availability fix
- [x] Locate where booking throws 409 "Selected room type is fully booked".
- [x] Verify availability logic reads `roomInventory[roomType].total/available`.
- [x] Plan and confirm migration alignment with legacy fields `total/available`.
- [x] Create one-time MongoDB migration script for existing rooms only.
- [x] Add verification query to confirm all existing rooms updated.



