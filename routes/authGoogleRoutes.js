const express = require('express');
const router = express.Router();
const authController = require('../controllers/authController');

router.route('/').get(authController.login);
router.route('/redirect').get(authController.redirect);

module.exports = router;