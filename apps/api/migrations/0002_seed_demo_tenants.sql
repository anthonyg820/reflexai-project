-- Demo content for the two hard-coded tenants. Idempotent.
INSERT INTO scenarios (id, tenant_id, title, persona, description, persona_lines) VALUES
('00000000-0000-4000-8000-000000000001', 'acme-crisis-line', 'First-time caller, high anxiety',
 'Jordan, 24', 'A caller who has never contacted a crisis line before and is unsure whether they should be calling.',
 '["Hi... I''m not even sure I should be calling. Is this the right number?", "I''ve just been feeling really overwhelmed lately. Work, my family, all of it.", "I guess I haven''t been sleeping. Maybe three hours a night?", "My sister used to be the person I''d talk to, but she moved away.", "I don''t know. It helps a little to just say it out loud."]'),
('00000000-0000-4000-8000-000000000002', 'acme-crisis-line', 'Returning caller, frustrated',
 'Sam, 41', 'A caller who has reached out before and feels the last conversation didn''t help.',
 '["I called last week and honestly it didn''t help at all.", "The person just kept reading from a script.", "I need someone to actually listen, not tell me to breathe.", "Okay. That''s... actually the first time someone said that back to me."]'),
('00000000-0000-4000-8000-000000000003', 'northwind-health', 'Billing dispute, upset patient',
 'Priya, 58', 'A patient who received an unexpected bill after a procedure they were told was covered.',
 '["I just got a bill for $2,400 and I was told this was covered!", "I spent an hour on hold yesterday and got disconnected.", "I''m on a fixed income. I can''t pay this.", "If you can actually look into it, I''d appreciate that."]'),
('00000000-0000-4000-8000-000000000004', 'northwind-health', 'Delivering a care plan change',
 'Marcus, 67', 'A patient learning that their medication will change, who is worried about side effects.',
 '["The doctor''s office said my prescription is changing. Why?", "The last time they changed it I felt dizzy for weeks.", "Who do I call if it happens again?", "Alright. Thanks for walking me through it."]')
ON CONFLICT (id) DO NOTHING;
