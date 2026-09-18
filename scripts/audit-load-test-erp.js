import http from 'k6/http';
import { check, sleep, group } from 'k6';
import encoding from 'k6/encoding';
import crypto from 'k6/crypto';

// Direct JWT generation matching production algorithm & .env secret
function generateAuthToken(userId, tenantId, role, email) {
  const iat = Math.floor(Date.now() / 1000);
  const exp = iat + 24 * 60 * 60; // 24 hours

  const payload = {
    userId,
    tenantId,
    role,
    email,
    iat,
    exp,
  };

  const header = { alg: 'HS256', typ: 'JWT' };
  const headerB64 = encoding.b64encode(JSON.stringify(header), 'rawurl');
  const payloadB64 = encoding.b64encode(JSON.stringify(payload), 'rawurl');
  const signingInput = `${headerB64}.${payloadB64}`;

  const secret = __ENV.JWT_SECRET || 'pathshala-pro-jwt-secret-key-2026-change-in-production';
  const signature = crypto.hmac('sha256', secret, signingInput, 'base64rawurl');

  return `${signingInput}.${signature}`;
}

export const options = {
  stages: [
    { duration: '10s', target: 5 },  // Ramp up to 5 concurrent VUs
    { duration: '20s', target: 10 }, // Sustained load at 10 VUs
    { duration: '10s', target: 0 },  // Ramp down to 0
  ],
  thresholds: {
    'http_req_duration': ['p(95)<1500'], // 95% of queries under 1.5s
    'http_req_failed': ['rate<0.05'],    // Under 5% failures
  },
};

// Valid users from active database
const USERS = [
  {
    id: 'cmu5tz8ib0002hy2o5qzriypb',
    email: 'principleamsc@pathshalapro.edu',
    tenantId: 'amsc',
    role: 'ADMIN',
    name: 'SchoolAdmin',
  },
  {
    id: 'cmu7grfny0001hyh4puikjvtr',
    email: 'teacher@pathshalapro.com',
    tenantId: 'amsc',
    role: 'CLERK',
    name: 'Teacher',
  },
];

// Production API endpoints with query parameters
const ENDPOINTS = [
  '/api/students?limit=10',
  '/api/classes?limit=10',
  '/api/sections?limit=10',
  '/api/exams?limit=10',
  '/api/subjects?limit=10',
  '/api/staff?limit=10',
];

export default function () {
  const user = USERS[__VU % USERS.length];
  const token = generateAuthToken(user.id, user.tenantId, user.role, user.email);

  // Filter endpoints according to RBAC: Clerks don't have access to staff HR endpoint
  const allowedEndpoints = ENDPOINTS.filter(ep => !(ep.startsWith('/api/staff') && user.role === 'CLERK'));

  for (let i = 0; i < allowedEndpoints.length; i++) {
    const endpoint = allowedEndpoints[i];

    const res = http.get(`http://localhost:3001${endpoint}`, {
      headers: {
        'Authorization': `Bearer ${token}`,
        'x-forwarded-for': `10.0.${__VU}.${Math.floor(Math.random() * 250) + 1}`,
      },
    });

    check(res, {
      'status is 200': (r) => r.status === 200,
      'response time < 1.5s': (r) => r.timings.duration < 1500,
      'not rate limited': (r) => r.status !== 429,
    });
  }

  sleep(0.5);
}
