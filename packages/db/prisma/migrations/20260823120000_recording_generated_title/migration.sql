-- Model-written recording name (application-intelligence slice 1) — additive, nullable, no data
-- touched. Existing recordings gain one on their next re-process; until then Studio falls back to
-- the founder's title or the app URL, exactly as before.
ALTER TABLE "RecSession" ADD COLUMN "generatedTitle" TEXT;
