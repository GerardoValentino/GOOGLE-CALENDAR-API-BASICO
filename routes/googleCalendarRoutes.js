const express = require('express');
const calendarController = require('../controllers/calendarController');

const router = express.Router();

router.route('/calendars').get(calendarController.calendars);
router.route('/events').get(calendarController.events);

module.exports = router;