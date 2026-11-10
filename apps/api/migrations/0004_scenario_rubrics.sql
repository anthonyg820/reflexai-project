-- Rubrics belong to scenarios now. NULL means "use the environment's default
-- rubric" (SCORING_RUBRIC). Expand-only: the previous release ignores the
-- column and keeps scoring with the environment's rubric.
ALTER TABLE scenarios ADD COLUMN IF NOT EXISTS rubric_id text;

UPDATE scenarios SET rubric_id = 'rubric-a'          WHERE id = '00000000-0000-4000-8000-000000000001' AND rubric_id IS NULL;
UPDATE scenarios SET rubric_id = 'de-escalation'     WHERE id = '00000000-0000-4000-8000-000000000002' AND rubric_id IS NULL;
UPDATE scenarios SET rubric_id = 'service-recovery'  WHERE id = '00000000-0000-4000-8000-000000000003' AND rubric_id IS NULL;
UPDATE scenarios SET rubric_id = 'clear-explanation' WHERE id = '00000000-0000-4000-8000-000000000004' AND rubric_id IS NULL;
UPDATE scenarios SET rubric_id = 'crisis-safety'     WHERE id = '00000000-0000-4000-8000-000000000005' AND rubric_id IS NULL;
UPDATE scenarios SET rubric_id = 'rubric-b'          WHERE id = '00000000-0000-4000-8000-000000000006' AND rubric_id IS NULL;
UPDATE scenarios SET rubric_id = 'rubric-b'          WHERE id = '00000000-0000-4000-8000-000000000007' AND rubric_id IS NULL;
UPDATE scenarios SET rubric_id = 'de-escalation'     WHERE id = '00000000-0000-4000-8000-000000000008' AND rubric_id IS NULL;
UPDATE scenarios SET rubric_id = 'service-recovery'  WHERE id = '00000000-0000-4000-8000-000000000009' AND rubric_id IS NULL;

-- Five scenarios per organization.
INSERT INTO scenarios (id, tenant_id, title, persona, description, persona_lines, difficulty, channel, skills, minutes, rubric_id) VALUES
('00000000-0000-4000-8000-000000000010', 'northwind-health', 'Discouraged after surgery',
 'Linda, 72', 'Linda''s hip recovery is slower than she hoped and she''s starting to give up on her exercises. Help her see the progress she''s made.',
 '["Six weeks and I still can''t do the stairs. I don''t think this is working.", "My neighbor was walking the dog after a month.", "The exercises hurt and I don''t see the point.", "I did walk to the mailbox yesterday, I suppose.", "Alright. I''ll try the exercises again tomorrow."]',
 'core', 'Phone · follow-up call', '["Encouragement", "Motivation"]', 10, 'optimism'),
('00000000-0000-4000-8000-000000000011', 'northwind-health', 'Anxious parent in the waiting room',
 'Kevin, 38', 'Kevin''s daughter has been in the ER for three hours and nobody has told him anything. He''s loud and scared.',
 '["Three hours! Nobody has told me ANYTHING about my daughter!", "Don''t tell me to sit down. I want to know what''s happening.", "She''s seven. She was having trouble breathing.", "Okay... can you at least find out if she''s stable?", "Thank you. Sorry for yelling."]',
 'advanced', 'In person · emergency department', '["De-escalation", "Validation"]', 10, 'de-escalation'),
('00000000-0000-4000-8000-000000000012', 'northwind-health', 'Explaining a new diagnosis',
 'Rosa, 51', 'Rosa was just told she has type 2 diabetes. Explain what it means and what changes, in plain language.',
 '["The doctor said diabetes. Does that mean insulin shots for the rest of my life?", "What''s an A1C? She said mine was 7.8.", "So what do I actually have to change?", "That''s a lot. Can you say the most important part again?", "Okay. Food, walking, the pill, and the check-up in three months."]',
 'intro', 'In person · clinic', '["Plain language", "Teach-back"]', 8, 'clear-explanation'),
('00000000-0000-4000-8000-000000000013', 'harbor-bank', 'Customer closing their account',
 'Grace, 62', 'Grace wants to move her savings to another bank for a better rate. Find out what she needs and make a case to stay.',
 '["I''d like to close my savings account, please.", "The bank down the street is paying almost twice the interest.", "I''ve been with you twenty years, but that''s a lot of money to leave on the table.", "I suppose I could look at it. What would I need to do?", "Fine. Send me the details and call me Thursday."]',
 'core', 'Phone · retention', '["Discovery", "Objection handling"]', 10, 'sales-persistence'),
('00000000-0000-4000-8000-000000000014', 'harbor-bank', 'Small business owner exploring credit',
 'Tomás, 44', 'Tomás runs a bakery and is curious about a line of credit but wary of debt. Understand his business and propose a next step.',
 '["I saw your flyer about business credit. I''m just looking.", "We had a slow winter and I had to dip into savings.", "I don''t like owing money. My father lost a shop that way.", "What would it cost me if I never actually used it?", "Okay, I could do a meeting next week."]',
 'core', 'In person · branch', '["Discovery", "Next steps"]', 12, 'sales-persistence'),
('00000000-0000-4000-8000-000000000015', 'harbor-bank', 'First-time homebuyer overwhelmed',
 'Jamie, 31', 'Jamie is buying a first home and is lost in mortgage terms. Explain the options clearly and check understanding.',
 '["I''m pre-approved but I don''t understand half the words in this letter.", "What''s the difference between fixed and adjustable?", "And what are points? Why would I pay for points?", "Okay, so which one would you pick if you were me?", "That actually makes sense. Thank you."]',
 'intro', 'Video call · mortgage', '["Plain language", "Teach-back"]', 10, 'clear-explanation')
ON CONFLICT (id) DO NOTHING;
