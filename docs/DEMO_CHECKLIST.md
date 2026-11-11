# Hackathon demo checklist

- [ ] Start with `cd backend && npm start` and open `http://localhost:3000`
- [ ] Create a new citizen account in the UI (do not use real credentials)
- [ ] Submit a complaint and show the generated ID
- [ ] Open complaint tracking and dashboard
- [ ] Select a waste category manually; save a scan
- [ ] Confirm scan count and demo points update
- [ ] Optional: supply a real waste-trained Teachable Machine model and test image classification (internet required)
- [ ] Optional: configure an admin using environment variables, restart, log in as admin, and change complaint status
- [ ] Run `cd backend && npm test` before presenting

**Judge disclosure:** image recognition is experimental; this app does not contact any municipality or implement real reward payouts.
