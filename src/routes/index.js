const express = require('express');

const router = express.Router();

router.use('/auth', require('./auth'));
router.use('/users', require('./users'));
router.use('/subjects', require('./subjects'));
router.use('/tutors', require('./tutors'));
router.use('/availability', require('./availability'));
router.use('/sessions', require('./sessions'));
router.use('/study-plans', require('./studyPlans'));
router.use('/notifications', require('./notifications'));
router.use('/payments', require('./payments'));
router.use('/ai', require('./ai'));
router.use('/marketing', require('./marketing'));

module.exports = router;
