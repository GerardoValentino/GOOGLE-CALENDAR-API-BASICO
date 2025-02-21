const express = require('express');
const router = express.Router();
const authController = require('../controllers/authController');
const calendarController = require('../controllers/calendarController');

router.route('/').get(authController.login);
router.route('/redirect').get(authController.redirect);
router.route('/calendars').get(calendarController.calendars);
router.route('/events').get(calendarController.events);

module.exports = router;