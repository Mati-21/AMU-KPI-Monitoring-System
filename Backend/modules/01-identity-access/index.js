import { Router } from 'express';
import authRoutes from './auth/auth.routes.js';
import userRoutes from './user/user.routes.js';

const router = Router();

router.use('/auth', authRoutes);
router.use('/users', userRoutes);

export { authRoutes, userRoutes };
export default router;
