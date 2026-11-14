const express = require('express');
const readingController = require('../controllers/readingController');
const authMiddleware = require('../middleware/authMiddleware');

const router = express.Router();

router.use(authMiddleware);

router.get('/reports', readingController.getReports);
router.post('/', readingController.createReading);
router.get('/', readingController.getReadings);
router.put('/:id', readingController.updateReading);
router.delete('/:id', readingController.deleteReading);

module.exports = router;
