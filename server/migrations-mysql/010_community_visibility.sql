-- Community visibility.
--   'private': join only by scanning the community's QR code (the default, and how existing communities stay)
--   'public':  also listed in the app's Community -> Discover tab, where anyone can join it
ALTER TABLE communities ADD COLUMN visibility VARCHAR(16) NOT NULL DEFAULT 'private';
