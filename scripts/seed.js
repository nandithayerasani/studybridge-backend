require('dotenv').config();

const bcrypt = require('bcryptjs');
const { getConnection } = require('../src/config/db');

const SUBJECT_IDS = {
  Mathematics: 1,
  'Computer Science': 2,
  Physics: 3,
  Chemistry: 4,
  English: 5,
  Spanish: 6,
  History: 7,
  Biology: 8,
};

const FUTURE_MIN = new Date('2025-12-15T00:00:00Z');

function bumpToFuture(str) {
  if (!str) return null;
  const d = new Date(str);
  if (Number.isNaN(d.getTime())) return null;
  while (d <= FUTURE_MIN) {
    d.setFullYear(d.getFullYear() + 1);
  }
  return d;
}

function toDateTime(str) {
  // Convert ISO-like strings to 'YYYY-MM-DD HH:MM:SS'
  const d = bumpToFuture(str);
  if (!d) return null;
  return d.toISOString().slice(0, 19).replace('T', ' ');
}

function toDate(str) {
  const d = bumpToFuture(str);
  if (!d) return null;
  return d.toISOString().slice(0, 10);
}

async function clearTables(conn) {
  console.log('Clearing existing data...');
  await conn.query('SET FOREIGN_KEY_CHECKS = 0');
  await conn.query('TRUNCATE TABLE payments');
  await conn.query('TRUNCATE TABLE session_reviews');
  await conn.query('TRUNCATE TABLE messages');
  await conn.query('TRUNCATE TABLE notifications');
  await conn.query('TRUNCATE TABLE tasks');
  await conn.query('TRUNCATE TABLE study_plans');
  await conn.query('TRUNCATE TABLE sessions');
  await conn.query('TRUNCATE TABLE availability_slots');
  await conn.query('TRUNCATE TABLE tutor_subjects');
  await conn.query('TRUNCATE TABLE subjects');
  await conn.query('TRUNCATE TABLE users');
  await conn.query('SET FOREIGN_KEY_CHECKS = 1');
}

async function seedUsers(conn) {
  console.log('Seeding users...');
  const passwordStudent = await bcrypt.hash('student123', 10);
  const passwordTutor = await bcrypt.hash('tutor123', 10);

  const users = [
    {
      id: 1,
      name: 'Alice Johnson',
      email: 'alice@studybridge.com',
      role: 'student',
      avatarUrl:
        'https://images.unsplash.com/photo-1494790108755-2616b1e6f06e?w=150&h=150&fit=crop&crop=face',
      bio: null,
      verified: 0,
      joined: '2024-01-15 00:00:00',
      passwordHash: passwordStudent,
    },
    {
      id: 2,
      name: 'Dr. Sarah Chen',
      email: 'sarah.chen@studybridge.com',
      role: 'tutor',
      avatarUrl:
        'https://images.unsplash.com/photo-1559839734-2b71ea197ec2?w=150&h=150&fit=crop&crop=face',
      bio: 'PhD in Mathematics with 8+ years of tutoring experience. Specializes in calculus and linear algebra.',
      verified: 1,
      joined: '2023-08-20 00:00:00',
      passwordHash: passwordTutor,
    },
    {
      id: 3,
      name: 'Prof. Michael Rodriguez',
      email: 'michael.r@studybridge.com',
      role: 'tutor',
      avatarUrl:
        'https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=150&h=150&fit=crop&crop=face',
      bio: 'Computer Science professor with expertise in algorithms, data structures, and machine learning.',
      verified: 1,
      joined: '2023-06-10 00:00:00',
      passwordHash: passwordTutor,
    },
    {
      id: 4,
      name: 'Emma Thompson',
      email: 'emma.t@studybridge.com',
      role: 'tutor',
      avatarUrl:
        'https://images.unsplash.com/photo-1438761681033-6461ffad8d80?w=150&h=150&fit=crop&crop=face',
      bio: 'Certified English teacher with specialization in academic writing and literature analysis.',
      verified: 1,
      joined: '2023-09-05 00:00:00',
      passwordHash: passwordTutor,
    },
    {
      id: 5,
      name: 'David Kim',
      email: 'david.kim@studybridge.com',
      role: 'student',
      avatarUrl:
        'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150&h=150&fit=crop&crop=face',
      bio: null,
      verified: 0,
      joined: '2024-02-28 00:00:00',
      passwordHash: passwordStudent,
    },
  ];

  for (const u of users) {
    const joinedAt = toDateTime(u.joined);
    await conn.execute(
      'INSERT INTO users (id, name, email, password_hash, role, avatar_url, bio, verified, joined_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
      [
        u.id,
        u.name,
        u.email,
        u.passwordHash,
        u.role,
        u.avatarUrl,
        u.bio,
        u.verified,
        joinedAt,
        joinedAt,
      ]
    );
  }
}

async function seedSubjects(conn) {
  console.log('Seeding subjects...');
  const subjects = [
    { id: 1, name: 'Mathematics', category: 'STEM', description: 'Algebra, Calculus, Geometry, Statistics', icon: '📊' },
    { id: 2, name: 'Computer Science', category: 'STEM', description: 'Programming, Algorithms, Data Structures', icon: '💻' },
    { id: 3, name: 'Physics', category: 'STEM', description: 'Classical Mechanics, Quantum Physics, Thermodynamics', icon: '⚛️' },
    { id: 4, name: 'Chemistry', category: 'STEM', description: 'Organic, Inorganic, Physical Chemistry', icon: '🧪' },
    { id: 5, name: 'English', category: 'Language Arts', description: 'Literature, Writing, Grammar, Essay Writing', icon: '📚' },
    { id: 6, name: 'Spanish', category: 'Language Arts', description: 'Conversational Spanish, Grammar, Literature', icon: '🇪🇸' },
    { id: 7, name: 'History', category: 'Social Studies', description: 'World History, American History, European History', icon: '📜' },
    { id: 8, name: 'Biology', category: 'STEM', description: 'Cell Biology, Genetics, Ecology, Anatomy', icon: '🧬' },
  ];

  for (const s of subjects) {
    await conn.execute(
      'INSERT INTO subjects (id, name, category, description, icon) VALUES (?, ?, ?, ?, ?)',
      [s.id, s.name, s.category, s.description, s.icon]
    );
  }

  console.log('Seeding tutor_subjects...');
  const tutorSubjects = [
    // Sarah Chen
    { tutorId: 2, subjectName: 'Mathematics' },
    { tutorId: 2, subjectName: 'Calculus' },
    { tutorId: 2, subjectName: 'Linear Algebra' },
    { tutorId: 2, subjectName: 'Statistics' },
    // Michael Rodriguez
    { tutorId: 3, subjectName: 'Computer Science' },
    { tutorId: 3, subjectName: 'Python' },
    { tutorId: 3, subjectName: 'Algorithms' },
    { tutorId: 3, subjectName: 'Machine Learning' },
    // Emma Thompson
    { tutorId: 4, subjectName: 'English' },
    { tutorId: 4, subjectName: 'Writing' },
    { tutorId: 4, subjectName: 'Literature' },
    { tutorId: 4, subjectName: 'Essay Writing' },
  ];

  // Map some subject names to IDs where possible; others will be skipped if not found
  const nameToId = SUBJECT_IDS;

  for (const ts of tutorSubjects) {
    const subjectId = nameToId[ts.subjectName];
    if (!subjectId) continue;
    await conn.execute('INSERT INTO tutor_subjects (tutor_id, subject_id) VALUES (?, ?)', [ts.tutorId, subjectId]);
  }
}

async function seedAvailability(conn) {
  console.log('Seeding availability slots...');
  const slots = [
    // Sarah (2)
    { id: 1, tutorId: 2, start: '2024-09-17T14:00:00Z', end: '2024-09-17T15:00:00Z', price: 65, isBooked: 1 },
    { id: 2, tutorId: 2, start: '2024-09-17T15:30:00Z', end: '2024-09-17T16:30:00Z', price: 65, isBooked: 0 },
    { id: 3, tutorId: 2, start: '2024-09-18T10:00:00Z', end: '2024-09-18T11:00:00Z', price: 65, isBooked: 0 },
    { id: 4, tutorId: 2, start: '2024-09-18T14:00:00Z', end: '2024-09-18T15:30:00Z', price: 97.5, isBooked: 0 },
    // Michael (3)
    { id: 5, tutorId: 3, start: '2024-09-16T16:00:00Z', end: '2024-09-16T17:30:00Z', price: 112.5, isBooked: 0 },
    { id: 6, tutorId: 3, start: '2024-09-17T11:00:00Z', end: '2024-09-17T12:00:00Z', price: 75, isBooked: 0 },
    { id: 7, tutorId: 3, start: '2024-09-18T16:00:00Z', end: '2024-09-18T17:30:00Z', price: 112.5, isBooked: 1 },
    // Emma (4)
    { id: 8, tutorId: 4, start: '2024-09-16T13:00:00Z', end: '2024-09-16T14:00:00Z', price: 45, isBooked: 0 },
    { id: 9, tutorId: 4, start: '2024-09-17T15:00:00Z', end: '2024-09-17T16:00:00Z', price: 45, isBooked: 0 },
    { id: 10, tutorId: 4, start: '2024-09-19T10:00:00Z', end: '2024-09-19T11:30:00Z', price: 67.5, isBooked: 0 },
  ];

  for (const s of slots) {
    await conn.execute(
      'INSERT INTO availability_slots (id, tutor_id, start_time, end_time, price, is_booked, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, NOW(), NOW())',
      [s.id, s.tutorId, toDateTime(s.start), toDateTime(s.end), s.price, s.isBooked]
    );
  }
}

async function seedSessions(conn) {
  console.log('Seeding sessions...');
  const sessions = [
    {
      id: 1,
      studentId: 1,
      tutorId: 2,
      subject: 'Mathematics',
      title: 'Calculus - Derivatives and Limits',
      status: 'scheduled',
      start: '2024-09-17T14:00:00Z',
      end: '2024-09-17T15:00:00Z',
      duration: 60,
      price: 65,
      meetingLink: 'https://meet.studybridge.com/session-1',
      notes: null,
    },
    {
      id: 5,
      studentId: 1,
      tutorId: 2,
      subject: 'Mathematics',
      title: 'Practice: Chain Rule Drills',
      status: 'scheduled',
      start: '2024-09-19T14:30:00Z',
      end: '2024-09-19T15:15:00Z',
      duration: 45,
      price: 48.75,
      meetingLink: 'https://meet.studybridge.com/session-5',
      notes: null,
    },
    {
      id: 6,
      studentId: 1,
      tutorId: 3,
      subject: 'Computer Science',
      title: 'Algorithms: Big-O Basics',
      status: 'completed',
      start: '2024-09-05T17:00:00Z',
      end: '2024-09-05T18:00:00Z',
      duration: 60,
      price: 75,
      meetingLink: null,
      notes: 'Reviewed time complexity and practiced analyzing simple loops.',
    },
    {
      id: 8,
      studentId: 1,
      tutorId: 2,
      subject: 'Mathematics',
      title: 'Limits and Continuity — Review',
      status: 'completed',
      start: '2024-09-02T14:00:00Z',
      end: '2024-09-02T15:00:00Z',
      duration: 60,
      price: 65,
      meetingLink: null,
      notes: 'Solved 10 practice problems. Focused on epsilon-delta intuition.',
    },
    {
      id: 7,
      studentId: 1,
      tutorId: 4,
      subject: 'English',
      title: 'Literature Analysis: Theme and Tone',
      status: 'scheduled',
      start: '2024-09-20T19:00:00Z',
      end: '2024-09-20T20:00:00Z',
      duration: 60,
      price: 45,
      meetingLink: 'https://meet.studybridge.com/session-7',
      notes: null,
    },
    {
      id: 2,
      studentId: 1,
      tutorId: 3,
      subject: 'Computer Science',
      title: 'Python Data Structures',
      status: 'scheduled',
      start: '2024-09-18T16:00:00Z',
      end: '2024-09-18T17:30:00Z',
      duration: 90,
      price: 112.5,
      meetingLink: 'https://meet.studybridge.com/session-2',
      notes: null,
    },
    {
      id: 3,
      studentId: 1,
      tutorId: 4,
      subject: 'English',
      title: 'Essay Writing Techniques',
      status: 'completed',
      start: '2024-09-10T13:00:00Z',
      end: '2024-09-10T14:00:00Z',
      duration: 60,
      price: 45,
      meetingLink: null,
      notes: 'Worked on thesis statement development and paragraph structure.',
    },
    {
      id: 4,
      studentId: 5,
      tutorId: 2,
      subject: 'Mathematics',
      title: 'Linear Algebra - Matrix Operations',
      status: 'scheduled',
      start: '2024-09-16T10:00:00Z',
      end: '2024-09-16T11:30:00Z',
      duration: 90,
      price: 97.5,
      meetingLink: null,
      notes: null,
    },
  ];

  for (const s of sessions) {
    await conn.execute(
      'INSERT INTO sessions (id, student_id, tutor_id, subject_id, title, status, start_time, end_time, duration_minutes, price, location, meeting_link, notes) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
      [
        s.id,
        s.studentId,
        s.tutorId,
        SUBJECT_IDS[s.subject] || null,
        s.title,
        s.status,
        toDateTime(s.start),
        toDateTime(s.end),
        s.duration,
        s.price,
        'online',
        s.meetingLink,
        s.notes,
      ]
    );
  }
}

async function seedStudyPlansAndTasks(conn) {
  console.log('Seeding study plans and tasks...');
  const plans = [
    {
      id: 1,
      studentId: 1,
      title: 'Calculus Mastery',
      description:
        'Master fundamental calculus concepts including limits, derivatives, and integrals',
      subject: 'Mathematics',
      startDate: toDate('2024-09-01'),
      endDate: toDate('2024-12-15'),
      status: 'active',
      progress: 35,
    },
    {
      id: 2,
      studentId: 1,
      title: 'Python Programming',
      description:
        'Learn Python from basics to intermediate level with focus on data structures',
      subject: 'Computer Science',
      startDate: toDate('2024-09-10'),
      endDate: toDate('2024-11-30'),
      status: 'active',
      progress: 20,
    },
    {
      id: 3,
      studentId: 1,
      title: 'Academic Writing Skills',
      description: 'Improve essay writing and academic communication skills',
      subject: 'English',
      startDate: toDate('2024-08-15'),
      endDate: toDate('2024-10-31'),
      status: 'active',
      progress: 75,
    },
  ];

  for (const p of plans) {
    await conn.execute(
      'INSERT INTO study_plans (id, student_id, title, description, subject_id, start_date, end_date, status, progress_percent, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, NOW(), NOW())',
      [
        p.id,
        p.studentId,
        p.title,
        p.description,
        SUBJECT_IDS[p.subject] || null,
        p.startDate,
        p.endDate,
        p.status,
        p.progress,
      ]
    );
  }

  const tasks = [
    {
      id: 1,
      planId: 1,
      studentId: 1,
      title: 'Complete Chapter 3 Exercises',
      description: 'Work through derivative problems 1-25',
      dueDate: toDate('2024-09-18'),
      status: 'in_progress',
      priority: 'high',
      subject: 'Mathematics',
      sessionId: 1,
      estimatedHours: 2,
    },
    {
      id: 2,
      planId: 1,
      studentId: 1,
      title: 'Review Limit Theorems',
      description:
        'Study and memorize key limit theorems for the upcoming quiz',
      dueDate: toDate('2024-09-20'),
      status: 'todo',
      priority: 'medium',
      subject: 'Mathematics',
      sessionId: null,
      estimatedHours: 1.5,
    },
    {
      id: 3,
      planId: 2,
      studentId: 1,
      title: 'Practice Dictionary Operations',
      description:
        'Complete coding exercises on nested dictionaries and iteration',
      dueDate: toDate('2024-09-19'),
      status: 'todo',
      priority: 'high',
      subject: 'Computer Science',
      sessionId: 2,
      estimatedHours: 3,
    },
    {
      id: 4,
      planId: 3,
      studentId: 1,
      title: 'Revise Essay Draft',
      description:
        'Apply feedback from Emma on thesis statement and paragraph structure',
      dueDate: toDate('2024-09-17'),
      status: 'completed',
      priority: 'medium',
      subject: 'English',
      sessionId: null,
      estimatedHours: 2,
    },
    {
      id: 5,
      planId: 1,
      studentId: 1,
      title: 'Chain Rule Practice Problems',
      description: 'Solve 15 chain rule problems from textbook',
      dueDate: toDate('2024-09-19'),
      status: 'todo',
      priority: 'high',
      subject: 'Mathematics',
      sessionId: null,
      estimatedHours: 2.5,
    },
  ];

  for (const t of tasks) {
    await conn.execute(
      'INSERT INTO tasks (id, plan_id, student_id, title, description, due_date, status, priority, subject_id, session_id, estimated_hours, created_at, updated_at)' +
        ' VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW(), NOW())',
      [
        t.id,
        t.planId,
        t.studentId,
        t.title,
        t.description,
        t.dueDate,
        t.status,
        t.priority,
        SUBJECT_IDS[t.subject] || null,
        t.sessionId,
        t.estimatedHours,
      ]
    );
  }
}

async function seedNotifications(conn) {
  console.log('Seeding notifications...');
  const notifications = [
    {
      id: 1,
      userId: 1,
      title: 'Session Reminder',
      message: 'Your calculus session with Dr. Sarah Chen starts in 1 hour',
      type: 'reminder',
      read: 0,
      timestamp: '2024-09-17T13:00:00Z',
      actionUrl: '/student/session/1',
      actionText: 'Join Session',
    },
    {
      id: 2,
      userId: 1,
      title: 'Booking Confirmed',
      message:
        'Your Python session with Prof. Michael Rodriguez has been confirmed for tomorrow at 4:00 PM',
      type: 'booking',
      read: 0,
      timestamp: '2024-09-16T18:30:00Z',
      actionUrl: '/student/session/2',
      actionText: 'View Details',
    },
    {
      id: 3,
      userId: 1,
      title: 'Rate Your Session',
      message: 'How was your essay writing session with Emma Thompson?',
      type: 'rating',
      read: 1,
      timestamp: '2024-09-10T15:30:00Z',
      actionUrl: '/student/history',
      actionText: 'Rate Session',
    },
    {
      id: 4,
      userId: 1,
      title: 'Task Due Soon',
      message: 'Your calculus homework is due tomorrow',
      type: 'reminder',
      read: 1,
      timestamp: '2024-09-16T09:00:00Z',
      actionUrl: '/student/planner/plan-1',
      actionText: 'View Tasks',
    },
    {
      id: 5,
      userId: 1,
      title: 'Payment Processed',
      message: 'Payment of $45.00 for your English session has been processed',
      type: 'payment',
      read: 1,
      timestamp: '2024-09-10T14:00:00Z',
      actionUrl: null,
      actionText: null,
    },
    {
      id: 6,
      userId: 1,
      title: 'New Study Plan',
      message: 'Your "Calculus Mastery" study plan is now active',
      type: 'system',
      read: 1,
      timestamp: '2024-09-01T10:00:00Z',
      actionUrl: '/student/planner/plan-1',
      actionText: 'View Plan',
    },
    {
      id: 7,
      userId: 1,
      title: 'New Message from Tutor',
      message: 'Dr. Sarah Chen sent you resources for practice.',
      type: 'system',
      read: 0,
      timestamp: '2024-09-16T20:45:00Z',
      actionUrl: null,
      actionText: null,
    },
    {
      id: 8,
      userId: 1,
      title: 'Schedule Change',
      message:
        'Your Literature Analysis session moved to 7:00 PM on Sep 20.',
      type: 'reminder',
      read: 0,
      timestamp: '2024-09-16T19:15:00Z',
      actionUrl: '/student/sessions',
      actionText: 'Review Schedule',
    },
    {
      id: 9,
      userId: 1,
      title: 'Recommended Tutor',
      message: 'Based on your study plan, check out Algebra specialists.',
      type: 'system',
      read: 1,
      timestamp: '2024-09-15T12:00:00Z',
      actionUrl: '/student/find-tutor',
      actionText: 'Browse Tutors',
    },
  ];

  for (const n of notifications) {
    await conn.execute(
      'INSERT INTO notifications (id, user_id, type, title, message, action_url, action_text, is_read, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
      [
        n.id,
        n.userId,
        n.type,
        n.title,
        n.message,
        n.actionUrl,
        n.actionText,
        n.read,
        toDateTime(n.timestamp),
      ]
    );
  }
}

async function seedMessagesAndReviews(conn) {
  console.log('Seeding messages and reviews...');
  const messages = [
    {
      sessionId: 1,
      senderId: 2,
      senderName: 'Dr. Sarah Chen',
      content: 'Hi Alice! Ready to dive into derivatives today?',
      timestamp: '2024-09-17T14:01:00Z',
      type: 'text',
    },
    {
      sessionId: 1,
      senderId: 1,
      senderName: 'Alice Johnson',
      content:
        "Yes! I'm excited to learn. I've been struggling with the chain rule.",
      timestamp: '2024-09-17T14:02:00Z',
      type: 'text',
    },
    {
      sessionId: 1,
      senderId: 2,
      senderName: 'Dr. Sarah Chen',
      content:
        "Perfect! Let's start with a simple example. The chain rule is actually quite intuitive once you see the pattern.",
      timestamp: '2024-09-17T14:03:00Z',
      type: 'text',
    },
    {
      sessionId: 1,
      senderId: null,
      senderName: 'System',
      content: 'Session started at 2:00 PM',
      timestamp: '2024-09-17T14:00:00Z',
      type: 'system',
    },
    {
      sessionId: 2,
      senderId: 3,
      senderName: 'Prof. Michael Rodriguez',
      content:
        "Hello Alice! Today we'll explore Python data structures. Have you worked with dictionaries before?",
      timestamp: '2024-09-18T16:01:00Z',
      type: 'text',
    },
    {
      sessionId: 2,
      senderId: 1,
      senderName: 'Alice Johnson',
      content: 'A little bit, but I get confused with nested dictionaries.',
      timestamp: '2024-09-18T16:02:00Z',
      type: 'text',
    },
  ];

  for (const m of messages) {
    await conn.execute(
      'INSERT INTO messages (session_id, sender_id, sender_name, content, type, created_at) VALUES (?, ?, ?, ?, ?, ?)',
      [m.sessionId, m.senderId, m.senderName, m.content, m.type, toDateTime(m.timestamp)],
    );
  }

  const reviews = [
    {
      sessionId: 3,
      studentId: 1,
      tutorId: 4,
      rating: 5,
      review:
        'Excellent session! Emma helped me understand how to structure my arguments better. She provided clear examples and gave constructive feedback on my essay draft.',
      date: '2024-09-10T15:00:00Z',
      helpful: 3,
    },
    {
      sessionId: 8,
      studentId: 1,
      tutorId: 2,
      rating: 5,
      review:
        'Crystal clear explanation of limits. Loved the intuitive approach!',
      date: '2024-09-02T16:00:00Z',
      helpful: 2,
    },
    {
      sessionId: 6,
      studentId: 1,
      tutorId: 3,
      rating: 4,
      review:
        'Good session on Big-O. Would appreciate more real-world examples.',
      date: '2024-09-05T19:00:00Z',
      helpful: 1,
    },
  ];

  for (const r of reviews) {
    await conn.execute(
      'INSERT INTO session_reviews (session_id, student_id, tutor_id, rating, review, helpful_count, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)',
      [r.sessionId, r.studentId, r.tutorId, r.rating, r.review, r.helpful, toDateTime(r.date)]
    );
  }
}

async function seedPayments(conn) {
  console.log('Seeding payments...');
  const payments = [
    { sessionId: 3, studentId: 1, tutorId: 4, amount: 45, status: 'completed' },
    { sessionId: 6, studentId: 1, tutorId: 3, amount: 75, status: 'completed' },
    { sessionId: 8, studentId: 1, tutorId: 2, amount: 65, status: 'completed' },
  ];

  for (const p of payments) {
    await conn.execute(
      "INSERT INTO payments (session_id, student_id, tutor_id, amount, currency, status, provider, provider_charge_id, created_at) VALUES (?, ?, ?, ?, 'USD', ?, 'seed', NULL, NOW())",
      [p.sessionId, p.studentId, p.tutorId, p.amount, p.status]
    );
  }
}

async function main() {
  const conn = await getConnection();
  try {
    await clearTables(conn);
    await seedUsers(conn);
    await seedSubjects(conn);
    await seedAvailability(conn);
    await seedSessions(conn);
    await seedStudyPlansAndTasks(conn);
    await seedNotifications(conn);
    await seedMessagesAndReviews(conn);
    await seedPayments(conn);
    console.log('Database seeding complete.');
  } catch (err) {
    console.error('Seeding failed:', err);
    process.exitCode = 1;
  } finally {
    conn.release();
  }
}

main();
