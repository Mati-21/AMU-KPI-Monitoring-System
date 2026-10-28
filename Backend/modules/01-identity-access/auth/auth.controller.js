import * as authService from './auth.service.js';

const isProduction = process.env.NODE_ENV === 'production';

// HTTP-Only Cookie Configuration Options
const SESSION_COOKIE_OPTIONS = {
  httpOnly: true,
  secure: isProduction,
  sameSite: 'lax',
  path: '/',
  maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days active session
};

const STAGE_COOKIE_OPTIONS = {
  httpOnly: true,
  secure: isProduction,
  sameSite: 'lax',
  path: '/',
  maxAge: 15 * 60 * 1000, // 15 minutes for intermediate first-login/MFA steps
};

export const login = async (req, res, next) => {
  try {
    const identifier = req.body.username || req.body.email;
    const { password } = req.body;
    if (!identifier || !password) {
      return res.status(400).json({ message: 'All inputs are required' });
    }

    const result = await authService.authenticate({
      username: req.body.username,
      email: req.body.email,
      password,
    });

    // Handle intermediate state: First-login password change or MFA
    if (result.tempToken) {
      res.cookie('auth_stage', result.tempToken, STAGE_COOKIE_OPTIONS);
      res.clearCookie('token');
      const { tempToken, ...response } = result;
      return res.json(response);
    }

    // Normal successful login: Set final session cookie
    if (result.token) {
      res.cookie('token', result.token, SESSION_COOKIE_OPTIONS);
      res.clearCookie('auth_stage');
      const { token, ...response } = result;
      return res.json(response);
    }

    res.json(result);
  } catch (error) {
    res.status(401).json({ message: error.message });
  }
};

export const changePassword = async (req, res, next) => {
  try {
    const { currentPassword, newPassword, code, mfaCode } = req.body;
    const stageCookie = req.cookies?.auth_stage;
    const sessionToken = req.cookies?.token;

    if (!newPassword) {
      return res.status(400).json({ message: 'newPassword is required' });
    }

    // Case 1: First-time password change (auth_stage cookie present)
    if (stageCookie) {
      try {
        const decoded = (await import('jsonwebtoken')).default.verify(stageCookie, process.env.JWT_SECRET || 'amu_kpi_jwt_secret');
        if (decoded.scope === 'MFA_SETUP') {
          return res.json({
            status: 'REQUIRE_MFA_SETUP',
            mfa_required: true,
            message: 'Password was already updated. Please proceed to MFA Setup (POST /api/auth/mfa/setup).',
          });
        }
      } catch (e) {
        // Fall through if token expired
      }

      const result = await authService.changePasswordFirstLogin({ tempToken: stageCookie, newPassword });

      if (result.tempToken) {
        res.cookie('auth_stage', result.tempToken, STAGE_COOKIE_OPTIONS);
        const { tempToken, ...response } = result;
        return res.json(response);
      }

      if (result.token) {
        res.cookie('token', result.token, SESSION_COOKIE_OPTIONS);
        res.clearCookie('auth_stage');
        const { token, ...response } = result;
        return res.json(response);
      }

      return res.json(result);
    }

    // Case 2: Regular password change (active session cookie or req.user present)
    let userId = req.user?.id;
    if (!userId && sessionToken) {
      try {
        const decoded = (await import('jsonwebtoken')).default.verify(sessionToken, process.env.JWT_SECRET || 'amu_kpi_jwt_secret');
        userId = decoded.id;
      } catch (e) {
        return res.status(401).json({ message: 'Invalid or expired session cookie. Please login again.' });
      }
    }

    if (userId) {
      const result = await authService.changePasswordRegular({
        userId,
        currentPassword,
        newPassword,
        code: code || mfaCode,
      });

      if (result.token) {
        res.cookie('token', result.token, SESSION_COOKIE_OPTIONS);
        const { token, ...response } = result;
        return res.json(response);
      }

      return res.json(result);
    }

    // Case 3: Direct password change with username & currentPassword (if cookie is missing/expired)
    const username = req.body?.username || (currentPassword && 'mati.admin');
    if (username && currentPassword) {
      const user = await authService.findUserByUsername(username);
      if (user) {
        const bcrypt = (await import('bcryptjs')).default;
        const isMatch = await bcrypt.compare(currentPassword, user.passwordHash);
        if (isMatch) {
          if (user.mustChangePassword) {
            const tempToken = authService.generateTempToken(user.id, 'FIRST_LOGIN_PASSWORD_CHANGE');
            const result = await authService.changePasswordFirstLogin({ tempToken, newPassword });

            if (result.tempToken) {
              res.cookie('auth_stage', result.tempToken, STAGE_COOKIE_OPTIONS);
              const { tempToken, ...response } = result;
              return res.json(response);
            }
            if (result.token) {
              res.cookie('token', result.token, SESSION_COOKIE_OPTIONS);
              res.clearCookie('auth_stage');
              const { token, ...response } = result;
              return res.json(response);
            }
            return res.json(result);
          } else {
            const result = await authService.changePasswordRegular({
              userId: user.id,
              currentPassword,
              newPassword,
              code: code || mfaCode,
            });

            if (result.token) {
              res.cookie('token', result.token, SESSION_COOKIE_OPTIONS);
              const { token, ...response } = result;
              return res.json(response);
            }
            return res.json(result);
          }
        }
      }
    }

    return res.status(401).json({
      message: 'Missing session or stage cookie. Please execute POST /api/auth/login first, or provide currentPassword.',
    });
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
};

export const changePasswordFirstLogin = async (req, res, next) => {
  return changePassword(req, res, next);
};

export const setupMfa = async (req, res, next) => {
  try {
    let userId = req.user?.id;
    const stageCookie = req.cookies?.auth_stage;

    if (!userId && stageCookie) {
      const decoded = authService.verifyTempToken(stageCookie, 'MFA_SETUP');
      userId = decoded.id;
    }

    if (!userId) {
      return res.status(401).json({ message: 'Authentication session cookie or MFA stage cookie required' });
    }

    const mfaData = await authService.generateMfaSetup({ userId });
    res.json({
      status: 'success',
      data: mfaData,
    });
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
};

export const verifyMfaSetup = async (req, res, next) => {
  try {
    const stageCookie = req.cookies?.auth_stage;
    let userId = req.user?.id;

    if (!userId && stageCookie) {
      const decoded = authService.verifyTempToken(stageCookie, 'MFA_SETUP');
      userId = decoded.id;
    }

    const { secret, code } = req.body;
    if (!userId) {
      return res.status(401).json({ message: 'Missing MFA setup session cookie. Please complete previous step.' });
    }
    if (!code) {
      return res.status(400).json({ message: '6-digit verification code is required' });
    }

    const result = await authService.verifyAndEnableMfa({ userId, code, secret });

    if (result.token) {
      res.cookie('token', result.token, SESSION_COOKIE_OPTIONS);
      res.clearCookie('auth_stage');
      const { token, ...response } = result;
      return res.json(response);
    }

    res.json(result);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
};

export const verifyMfa = async (req, res, next) => {
  try {
    const stageCookie = req.cookies?.auth_stage;
    const { code } = req.body;

    if (!stageCookie) {
      return res.status(401).json({ message: 'Missing MFA verification session cookie. Please login again.' });
    }
    if (!code) {
      return res.status(400).json({ message: '6-digit verification code is required' });
    }

    const result = await authService.verifyMfaLogin({ tempToken: stageCookie, code });

    if (result.token) {
      res.cookie('token', result.token, SESSION_COOKIE_OPTIONS);
      res.clearCookie('auth_stage');
      const { token, ...response } = result;
      return res.json(response);
    }

    res.json(result);
  } catch (error) {
    res.status(401).json({ message: error.message });
  }
};

export const disableMfa = async (req, res, next) => {
  try {
    const { code } = req.body;
    if (!code) {
      return res.status(400).json({ message: 'Verification code required to disable MFA' });
    }

    const result = await authService.disableMfa({ userId: req.user.id, code });
    res.json({ status: 'success', ...result });
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
};

export const enforceUserMfa = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { enforced } = req.body;
    const updated = await authService.setMfaEnforced({ userId: id, enforced });
    res.json({
      status: 'success',
      message: `MFA enforcement for user set to ${Boolean(enforced)}`,
      data: { id: updated.id, mfaEnforced: updated.mfaEnforced },
    });
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
};

export const enforceRoleMfa = async (req, res, next) => {
  try {
    const { roleName, roleId, enforced = true } = req.body;
    const result = await authService.setMfaEnforcedForRole({ roleName, roleId, enforced });
    res.json({
      status: 'success',
      message: `2FA enforcement for role "${result.roleName}" set to ${result.mfaEnforced} (${result.affectedUsersCount} users updated)`,
      data: result,
    });
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
};

export const logout = async (req, res, next) => {
  try {
    res.clearCookie('token', { path: '/' });
    res.clearCookie('auth_stage', { path: '/' });
    res.json({ status: 'success', message: 'Logged out successfully' });
  } catch (error) {
    next(error);
  }
};

export const getMe = async (req, res, next) => {
  try {
    const user = await authService.findUserById(req.user.id);
    if (!user) return res.status(404).json({ message: 'User not found' });
    res.json({
      status: 'success',
      data: {
        id: user.id,
        username: user.username,
        isActive: user.isActive,
        mfaEnabled: user.mfaEnabled,
        mfaEnforced: user.mfaEnforced,
        person: user.person,
      },
    });
  } catch (error) {
    next(error);
  }
};

export default {
  login,
  changePassword,
  changePasswordFirstLogin,
  setupMfa,
  verifyMfaSetup,
  verifyMfa,
  disableMfa,
  enforceUserMfa,
  enforceRoleMfa,
  logout,
  getMe,
};

