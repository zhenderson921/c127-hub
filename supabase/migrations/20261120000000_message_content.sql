-- Keep the words that were sent. When a contact log entry is an email or a
-- text someone sent, the subject and the message itself are saved with it, so
-- the next person can see what was said and not only that something was.
alter table public.interactions
  add column subject text,
  add column body text;
