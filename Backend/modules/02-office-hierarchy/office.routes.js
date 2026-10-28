import { Router } from 'express';
import * as officeController from './office.controller.js';
import { protect } from '../../middleware/authMiddleware.js';

const router = Router();

router.get('/tree', protect, officeController.getOfficeTree);
router.get('/', protect, officeController.getOffices);
router.post('/', protect, officeController.createOffice);
router.get('/:id', protect, officeController.getOfficeById);
router.put('/:id', protect, officeController.updateOffice);
router.delete('/:id', protect, officeController.deleteOffice);

export default router;
