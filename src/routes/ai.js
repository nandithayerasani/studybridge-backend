const express = require('express');
const { authRequired } = require('../middleware/auth');
const { chatCompletion, hasOpenAIKey } = require('../lib/openai');

const router = express.Router();

// AI endpoint that returns a study plan recommendation (LLM-enhanced when available)
router.post('/study-plan', authRequired, async (req, res) => {
  const { subjects = [], hoursPerWeek = 4, preferredDays = [], examDate, difficulty = 'medium', notes } = req.body || {};
  const primarySubject = subjects[0] || 'General Study';

  const today = new Date();
  const startDate = today.toISOString().slice(0, 10);
  const defaultDurationDays = 28;
  const end = new Date(today.getTime() + defaultDurationDays * 24 * 60 * 60 * 1000);
  const endDate = end.toISOString().slice(0, 10);

  const basePlan = {
    title: `${primarySubject} Study Plan`,
    description: `Auto-generated plan focusing on ${primarySubject}. Difficulty: ${difficulty}.`,
    subject: primarySubject,
    startDate,
    endDate,
    status: 'active',
  };

  // Simple fallback tasks in case LLM is unavailable or fails
  let tasks = [
    {
      title: `Concept review for ${primarySubject}`,
      description: 'Review key concepts and definitions.',
      dueDate: startDate,
      priority: 'medium',
      subject: primarySubject,
      estimatedHours: Math.max(1, Math.round(hoursPerWeek / 2)),
    },
    {
      title: `Practice problems for ${primarySubject}`,
      description: 'Solve practice questions and note mistakes.',
      dueDate: endDate,
      priority: 'high',
      subject: primarySubject,
      estimatedHours: Math.max(1, Math.round(hoursPerWeek / 2)),
    },
  ];

  let plan = { ...basePlan };

  if (hasOpenAIKey) {
    try {
      const content = await chatCompletion([
        {
          role: 'system',
          content:
            `You are a helpful study planning assistant. Propose a short term study plan. Respond ONLY with valid JSON in this shape: {"title": string, "description": string, "durationDays": number, "tasks": [{"title": string, "description": string, "dueInDays": number}]}.`,
        },
        {
          role: 'user',
          content: `Create a 3-4 week study plan for a student.
Primary subject: ${primarySubject}.
Other subjects (if any): ${subjects.slice(1).join(', ') || 'none'}.
Difficulty: ${difficulty}.
Hours per week: ${hoursPerWeek}.
Preferred days: ${preferredDays && preferredDays.length ? preferredDays.join(', ') : 'not specified'}.
Exam date: ${examDate || 'not specified'}.
Extra notes from the student: ${notes || 'none'}.

Keep the description under 80 words, clear and encouraging.
Distribute tasks across the weeks leading up to the exam, with "dueInDays" as an integer offset from today (0 = today).`,
        },
      ], { maxTokens: 600 });

      if (content) {
        try {
          const parsed = JSON.parse(content);

          if (parsed.title) {
            plan.title = parsed.title;
          }
          if (parsed.description) {
            plan.description = parsed.description;
          }
          if (parsed.durationDays && Number.isFinite(parsed.durationDays)) {
            const d = new Date(today.getTime() + parsed.durationDays * 24 * 60 * 60 * 1000);
            plan.endDate = d.toISOString().slice(0, 10);
          }

          if (Array.isArray(parsed.tasks) && parsed.tasks.length) {
            tasks = parsed.tasks.map((t) => {
              const offset = Number.isFinite(t.dueInDays) ? t.dueInDays : 0;
              const due = new Date(today.getTime() + offset * 24 * 60 * 60 * 1000);
              return {
                title: t.title || `Study block for ${primarySubject}`,
                description: t.description || 'Study key concepts and practice problems.',
                dueDate: due.toISOString().slice(0, 10),
                priority: 'medium',
                subject: primarySubject,
                estimatedHours: Math.max(1, Math.round(hoursPerWeek / Math.max(2, parsed.tasks.length))),
              };
            });
          }
        } catch (parseErr) {
          console.error('AI study-plan JSON parse error:', parseErr);
          plan = { ...basePlan };
        }
      }
    } catch (err) {
      console.error('AI study-plan error:', err);
      plan = { ...basePlan };
    }
  }

  res.json({ plan, tasks, meta: { preferredDays, examDate, notes }, llmEnabled: hasOpenAIKey });
});

// AI session summary (LLM-enhanced when available)
router.post('/session-summary', authRequired, async (req, res) => {
  const { sessionId, notes, topics } = req.body || {};

  let tldr = `Summary for session ${sessionId || ''}`.trim();
  let keyPoints = [
    'Reviewed core concepts and clarified misconceptions.',
    'Worked through example problems together.',
    'Identified a few focus areas for next time.',
  ];
  let nextSteps = [
    'Complete 3–5 practice problems on today\'s topic.',
    'Review notes and create a one-page summary.',
    'Schedule a follow-up session if needed.',
  ];

  if (hasOpenAIKey) {
    try {
      const content = await chatCompletion([
        {
          role: 'system',
          content:
            'You create concise study session summaries. Respond in this exact JSON format: {"tldr": string, "keyPoints": string[], "nextSteps": string[]}.',
        },
        {
          role: 'user',
          content: `Create a summary for a tutoring session.
Session ID (may be omitted in text): ${sessionId || 'unknown'}.
Topics covered: ${(topics && topics.length ? topics.join(', ') : 'not specified')}.
Tutor notes or key moments: ${notes || 'none provided'}.
Keep the TLDR to 1-2 sentences and 3 bullet points each for key points and next steps. Reply with valid JSON only.`,
        },
      ], { maxTokens: 400 });

      if (content) {
        try {
          const parsed = JSON.parse(content);
          if (parsed.tldr) tldr = parsed.tldr;
          if (Array.isArray(parsed.keyPoints) && parsed.keyPoints.length) keyPoints = parsed.keyPoints;
          if (Array.isArray(parsed.nextSteps) && parsed.nextSteps.length) nextSteps = parsed.nextSteps;
        } catch (parseErr) {
          console.error('AI session-summary JSON parse error:', parseErr);
        }
      }
    } catch (err) {
      console.error('AI session-summary error:', err);
    }
  }

  res.json({ tldr, keyPoints, nextSteps, llmEnabled: hasOpenAIKey });
});

// TutorBot reply (LLM-backed when available)
router.post('/tutor-bot', authRequired, async (req, res) => {
  const { prompt, useSubjectContext, subject } = req.body || {};

  let reply = useSubjectContext
    ? `Using your session context, here is a generic helpful tip in response to: "${prompt || ''}".`
    : `Here is a generic study tip for your question: "${prompt || ''}".`;

  if (hasOpenAIKey && prompt) {
    try {
      const content = await chatCompletion([
        {
          role: 'system',
          content:
            'You are a friendly, concise study tutor. Give clear, practical explanations and next steps suitable for high school or college students.',
        },
        {
          role: 'user',
          content: `Student question: ${prompt} 
Subject or context: ${subject || (useSubjectContext ? 'Use their recent session context if available.' : 'General study help')}.`,
        },
      ], { maxTokens: 350 });

      if (content) {
        reply = content;
      }
    } catch (err) {
      console.error('AI tutor-bot error:', err);
    }
  }

  res.json({ reply, llmEnabled: hasOpenAIKey });
});

module.exports = router;
