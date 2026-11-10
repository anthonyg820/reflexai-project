-- Scenario details for the scenario library (difficulty, channel, skills, length)
-- plus more demo content and a third tenant. Expand-only: new columns have
-- defaults, so the previous release keeps working against this schema.
ALTER TABLE scenarios ADD COLUMN IF NOT EXISTS difficulty text NOT NULL DEFAULT 'core';
ALTER TABLE scenarios ADD COLUMN IF NOT EXISTS channel text NOT NULL DEFAULT '';
ALTER TABLE scenarios ADD COLUMN IF NOT EXISTS skills jsonb NOT NULL DEFAULT '[]'::jsonb;
ALTER TABLE scenarios ADD COLUMN IF NOT EXISTS minutes integer NOT NULL DEFAULT 10;
DO $$ BEGIN
  ALTER TABLE scenarios ADD CONSTRAINT scenarios_difficulty_check CHECK (difficulty IN ('intro', 'core', 'advanced'));
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

UPDATE scenarios SET difficulty = 'intro', channel = 'Chat · first contact', skills = '["Rapport", "Open questions"]', minutes = 8
  WHERE id = '00000000-0000-4000-8000-000000000001';
UPDATE scenarios SET difficulty = 'core', channel = 'Phone · returning caller', skills = '["De-escalation", "Validation"]', minutes = 10
  WHERE id = '00000000-0000-4000-8000-000000000002';
UPDATE scenarios SET difficulty = 'core', channel = 'Phone · billing', skills = '["Problem solving", "Validation"]', minutes = 10
  WHERE id = '00000000-0000-4000-8000-000000000003';
UPDATE scenarios SET difficulty = 'intro', channel = 'In person · clinic', skills = '["Clarity", "Teach-back"]', minutes = 8
  WHERE id = '00000000-0000-4000-8000-000000000004';

INSERT INTO scenarios (id, tenant_id, title, persona, description, persona_lines, difficulty, channel, skills, minutes) VALUES
('00000000-0000-4000-8000-000000000005', 'acme-crisis-line', 'Caller in acute crisis',
 'Riley, 19', 'Riley''s messages suggest immediate risk. Practice calm, direct questions about safety and a plan for tonight.',
 '["i don''t really know why i''m texting. i just can''t do this anymore.", "everything feels pointless. i keep thinking everyone would be better off.", "i''m in my room. my roommate is out until late.", "i guess i could text my brother. he usually picks up.", "okay. i''ll stay on here while i message him."]',
 'advanced', 'Text · urgent', '["Risk assessment", "Safety planning"]', 15),
('00000000-0000-4000-8000-000000000006', 'acme-crisis-line', 'Third-party caller worried about a friend',
 'Dana, 33', 'Dana is calling about a friend who has gone quiet. Support Dana while helping them decide what to do next.',
 '["Hi, this isn''t about me exactly. I''m worried about my friend.", "She stopped answering texts a week ago, and her last post was really dark.", "I don''t want to overstep. What if she gets angry at me?", "I could go by her place after work. I have a spare key.", "Thank you. I feel less like I''m overreacting now."]',
 'core', 'Phone · third party', '["Validation", "Next steps"]', 10),
('00000000-0000-4000-8000-000000000007', 'acme-crisis-line', 'Caller who wants to end the call early',
 'Chris, 56', 'Chris keeps saying he''s fine and tries to hang up. Stay patient and leave the door open without pushing.',
 '["Look, I''m fine. My daughter made me call.", "I don''t really see the point of talking about it.", "My wife passed in the spring. People keep asking if I''m okay.", "Maybe. I don''t know. I should go.", "Alright. Maybe I''ll call back."]',
 'core', 'Phone · reluctant caller', '["Patience", "Rapport"]', 10),
('00000000-0000-4000-8000-000000000008', 'harbor-bank', 'Suspected account fraud',
 'Elena, 45', 'Elena thinks her account was emptied. Stay calm, verify identity and set expectations honestly.',
 '["My checking account shows zero! Someone took everything!", "I didn''t make any of these payments. Last night, three of them.", "My rent is due Friday. What am I supposed to do?", "How long does the investigation take?", "Okay. Please send me the case number in writing."]',
 'advanced', 'Phone · fraud line', '["Expectation setting", "Compliance"]', 12),
('00000000-0000-4000-8000-000000000009', 'harbor-bank', 'Card declined at checkout',
 'Omar, 29', 'Omar''s card was declined in front of a line of people. Recover the relationship and explain what happened.',
 '["My card just got declined at the grocery store. In front of everyone.", "There''s plenty of money in that account. What''s going on?", "A fraud hold? Nobody told me anything.", "Can you at least make sure it works for the rest of the week?", "Fine. Thanks for actually explaining it."]',
 'intro', 'Chat · in app', '["Service recovery", "Clarity"]', 8)
ON CONFLICT (id) DO NOTHING;
