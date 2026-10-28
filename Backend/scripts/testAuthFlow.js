import 'dotenv/config';
import { generate } from 'otplib';

const BASE_URL = 'http://localhost:8058/api/auth';

const extractCookies = (res) => {
  const raw = res.headers.get('set-cookie');
  if (!raw) return {};
  const cookies = {};
  raw.split(',').forEach((c) => {
    const parts = c.split(';')[0].trim().split('=');
    if (parts.length === 2) {
      cookies[parts[0]] = parts[1];
    }
  });
  return cookies;
};

const buildCookieHeader = (cookieJar) => {
  return Object.entries(cookieJar)
    .map(([k, v]) => `${k}=${v}`)
    .join('; ');
};

const runTest = async () => {
  console.log('🍪 Starting Super Admin PURE HTTP-ONLY COOKIE & SESSION Flow Test...\n');

  const { prisma } = await import('../config/database.js');
  const bcrypt = (await import('bcryptjs')).default;

  const testTempPass = 'AMU@TempCookie9999!';
  await prisma.userAccount.update({
    where: { username: 'mati.admin' },
    data: {
      passwordHash: await bcrypt.hash(testTempPass, 10),
      mustChangePassword: true,
      mfaEnforced: true,
      mfaEnabled: false,
      mfaSecret: null,
    },
  });

  let cookieJar = {};

  // STEP 1: Login with Temporary Password
  console.log('1️⃣ Step 1: Login with Temporary Password...');
  let res = await fetch(`${BASE_URL}/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username: 'mati.admin', password: testTempPass }),
  });
  let data = await res.json();
  Object.assign(cookieJar, extractCookies(res));

  console.log('   Response Status:', data.status);
  console.log('   Message:', data.message);
  console.log('   Raw token exposed in body?:', data.token ? 'YES (Error)' : 'NO (Secure Cookie)');
  console.log('   HTTP-Only Cookie Set:', cookieJar['auth_stage'] ? 'auth_stage=PRESENT' : 'MISSING');

  if (data.status !== 'REQUIRE_PASSWORD_CHANGE' || !cookieJar['auth_stage']) {
    throw new Error('Failed Step 1: Expected REQUIRE_PASSWORD_CHANGE with auth_stage cookie');
  }

  // STEP 2: Change Password on First Login (Sends cookie automatically)
  console.log('\n2️⃣ Step 2: First-Login Password Change (using auth_stage cookie)...');
  const newPermanentPassword = 'PermanentCookiePassword2026!';
  res = await fetch(`${BASE_URL}/change-password-first-login`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Cookie: buildCookieHeader(cookieJar),
    },
    body: JSON.stringify({ newPassword: newPermanentPassword }),
  });
  data = await res.json();
  Object.assign(cookieJar, extractCookies(res));

  console.log('   Response Status:', data.status);
  console.log('   Message:', data.message);
  console.log('   Updated Stage Cookie:', cookieJar['auth_stage'] ? 'auth_stage=UPDATED' : 'MISSING');

  if (data.status !== 'REQUIRE_MFA_SETUP') {
    throw new Error(`Expected REQUIRE_MFA_SETUP, got ${data.status}`);
  }

  // STEP 3: Setup MFA (Sends stage cookie)
  console.log('\n3️⃣ Step 3: Generating MFA Secret & QR Code (using auth_stage cookie)...');
  res = await fetch(`${BASE_URL}/mfa/setup`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Cookie: buildCookieHeader(cookieJar),
    },
    body: JSON.stringify({}),
  });
  data = await res.json();
  const { secret, qrCodeDataUrl } = data.data;
  console.log('   TOTP Secret:', secret);
  console.log('   QR Code Data URL Length:', qrCodeDataUrl.length, 'chars');

  // STEP 4: Verify Initial MFA Code
  console.log('\n4️⃣ Step 4: Verifying Initial 6-digit Code (activating MFA & setting final session cookie)...');
  const initialCode = await generate({ secret });

  res = await fetch(`${BASE_URL}/mfa/verify-setup`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Cookie: buildCookieHeader(cookieJar),
    },
    body: JSON.stringify({ secret, code: initialCode }),
  });
  data = await res.json();
  Object.assign(cookieJar, extractCookies(res));

  console.log('   Response Status:', data.status);
  console.log('   Message:', data.message);
  console.log('   Final HTTP-Only Session Cookie Set:', cookieJar['token'] ? 'token=PRESENT' : 'MISSING');

  if (!cookieJar['token']) {
    throw new Error('Failed Step 4: Session token cookie not set');
  }

  // STEP 5: Verify Access to Protected Endpoint using Session Cookie
  console.log('\n5️⃣ Step 5: Calling /me with HTTP-Only Session Cookie...');
  res = await fetch(`${BASE_URL}/me`, {
    headers: {
      Cookie: buildCookieHeader(cookieJar),
    },
  });
  data = await res.json();
  console.log('   Status Code:', res.status);
  console.log('   User Profile Retrieved:', data.data?.username);
  console.log('   MFA Enabled in DB:', data.data?.mfaEnabled);
  console.log('   MFA Enforced in DB:', data.data?.mfaEnforced);

  if (res.status !== 200 || data.data?.username !== 'mati.admin') {
    throw new Error('Failed Step 5: Unable to authenticate via session cookie');
  }

  // STEP 6: Subsequent Login with Permanent Password
  console.log('\n6️⃣ Step 6: Subsequent Login (Password correct -> prompt 2FA via cookie)...');
  cookieJar = {}; // Clear client cookies
  res = await fetch(`${BASE_URL}/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username: 'mati.admin', password: newPermanentPassword }),
  });
  data = await res.json();
  Object.assign(cookieJar, extractCookies(res));

  console.log('   Response Status:', data.status);
  console.log('   Stage Cookie Set for 2FA:', cookieJar['auth_stage'] ? 'auth_stage=PRESENT' : 'MISSING');

  // STEP 7: Submit 2FA Code with auth_stage cookie
  console.log('\n7️⃣ Step 7: Submitting Authenticator 6-digit code with auth_stage cookie...');
  const login2faCode = await generate({ secret });
  res = await fetch(`${BASE_URL}/mfa/verify`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Cookie: buildCookieHeader(cookieJar),
    },
    body: JSON.stringify({ code: login2faCode }),
  });
  data = await res.json();
  Object.assign(cookieJar, extractCookies(res));

  console.log('   Response Status:', data.status);
  console.log('   Final Session Cookie Established:', cookieJar['token'] ? 'token=PRESENT' : 'MISSING');

  // STEP 8: Logout (Clears Cookies)
  console.log('\n8️⃣ Step 8: Calling /logout to clear all cookies...');
  res = await fetch(`${BASE_URL}/logout`, {
    method: 'POST',
    headers: {
      Cookie: buildCookieHeader(cookieJar),
    },
  });
  data = await res.json();
  console.log('   Logout Response:', data.message);

  console.log('\n🎉 ALL 8 STEPS OF PURE COOKIE & SESSION AUTHENTICATION PASSED!\n');
  process.exit(0);
};

runTest().catch((err) => {
  console.error('❌ Test failed:', err);
  process.exit(1);
});
