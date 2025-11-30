const express = require('express');

const router = express.Router();

router.get('/hero', (req, res) => {
  res.json({
    headline: 'Personalized tutoring that bridges the gap in your learning',
    subheading:
      'StudyBridge connects students with expert tutors. Plan your study, book sessions, and track progress — all in one place.',
    primaryCta: 'Find a Tutor',
    secondaryCta: 'Get Started Free',
  });
});

router.get('/testimonials', (req, res) => {
  res.json([
    {
      name: 'Alice Johnson',
      title: 'Student',
      quote: 'My grades improved after just a few sessions. The planner keeps me on track.',
    },
    {
      name: 'David Kim',
      title: 'Student',
      quote: 'The AI summaries save me time and help me focus on what matters.',
    },
    {
      name: 'Dr. Sarah Chen',
      title: 'Tutor',
      quote: 'As a tutor, scheduling and reviews are seamless.',
    },
  ]);
});

router.get('/partners', (req, res) => {
  res.json(['MIT', 'Stanford', 'Berkeley', 'UCLA', 'CMU', 'Harvard']);
});

router.get('/metrics/public', (req, res) => {
  res.json({
    activeTutors: 250,
    studentsHelped: 10000,
    averageRating: 4.9,
  });
});

module.exports = router;
