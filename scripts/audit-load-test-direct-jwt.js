import http from 'k6/http';
import { check, sleep, group } from 'k6';
import encoding from 'k6/encoding';
import crypto from 'k6/crypto';

// Direct JWT generation using the same logic as the application
function generateAuthToken(userId, tenantId, role, email) {
  const iat = Math.floor(Date.now() / 1000);
  const exp = iat + 24 * 60 * 60; // 24 hours
  
  // Create JWT payload
  const payload = {
    userId,
    tenantId,
    role,
    email,
    iat,
    exp,
  };

  // Create header and payload base64url strings (RFC 7519 standard)
  const header = { alg: 'HS256', typ: 'JWT' };
  const headerB64 = encoding.b64encode(JSON.stringify(header), 'rawurl');
  const payloadB64 = encoding.b64encode(JSON.stringify(payload), 'rawurl');

  // Create signing input
  const signingInput = `${headerB64}.${payloadB64}`;

  // In k6 crypto.hmac: crypto.hmac(algorithm, secret, data, outputEncoding)
  const secret = __ENV.JWT_SECRET || 'pathshala-pro-jwt-secret-key-2026-change-in-production';
  const signature = crypto.hmac('sha256', secret, signingInput, 'base64rawurl');
  
  // Return properly formatted JWT
  return `${signingInput}.${signature}`;
}

export const options = {
  stages: [
    { duration: '30s', target: 5 },
    { duration: '1m', target: 20 },
    { duration: '30s', target: 5 },
  ],
  thresholds: {
    'http_req_duration': ['p(95)<1000'], // 95% of requests under 1s
    'http_req_failed': ['rate<0.01'], // Less than 1% failure rate
  },
};

// User data with real IDs and roles from DB
const USERS = [
  {
    id: 'cmtd6adx70001hynwosj8pnkx',
    email: 'superadmin@pathshalapro.net',
    tenantId: 'system-platform',
    role: 'SYSTEM_ADMIN',
    name: 'Superadmin'
  },
  {
    id: 'cmu5tz8ib0002hy2o5qzriypb',
    email: 'principleamsc@pathshalapro.edu',
    tenantId: 'amsc',
    role: 'ADMIN',
    name: 'SchoolAdmin'
  },
  {
    id: 'cmu7grfny0001hyh4puikjvtr',
    email: 'teacher@pathshalapro.com',
    tenantId: 'amsc',
    role: 'CLERK',
    name: 'Teacher'
  },
];

// Critical endpoints to test
const ENDPOINTS = [
  '/api/students',
  '/api/attendance',
  '/api/fees/collection',
  '/api/exams',
  '/api/dashboard',
];

export default function () {
  // Test each user with direct JWT token
  for (let i = 0; i < USERS.length; i++) {
    const user = USERS[i];

    group(`Direct JWT - ${user.name}`, () => {
      // Generate JWT token directly
      const token = generateAuthToken(user.id, user.tenantId, user.role, user.email);

      // Test endpoints with direct JWT
      for (let j = 0; j < ENDPOINTS.length; j++) {
        const endpoint = ENDPOINTS[j];

        group(`${user.name} - ${endpoint}`, () => {
          const res = http.get(`http://localhost:3001${endpoint}?limit=10`, {
            headers: {
              'Authorization': `Bearer ${token}`,
              'x-forwarded-for': `192.168.1.${Math.floor(Math.random() * 254) + 1}`
            },
          });

          check(res, {
            [`${user.name} ${endpoint} status was 200`]: (r) => r.status === 200,
            [`${user.name} ${endpoint} response time < 1s`]: (r) => r.timings.duration < 1000,
            [`${user.name} ${endpoint} not rate limited`]: (r) => r.status !== 429,
          });
        });
      }
    });

    sleep(1); // Small delay between user tests
  }
}