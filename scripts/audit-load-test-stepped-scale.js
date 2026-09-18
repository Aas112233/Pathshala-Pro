import http from 'k6/http';
import { check, sleep } from 'k6';
import encoding from 'k6/encoding';
import crypto from 'k6/crypto';

// Reusable user pool for tenant 'amsc'
const USERS = [
  {
    id: 'cmu5tz8ib0002hy2o5qzriypb',
    email: 'principleamsc@pathshalapro.edu',
    tenantId: 'amsc',
    role: 'ADMIN',
  },
  {
    id: 'cmu7grfny0001hyh4puikjvtr',
    email: 'teacher@pathshalapro.com',
    tenantId: 'amsc',
    role: 'CLERK',
  },
];

// Production API endpoints
const ENDPOINTS = [
  '/api/students?limit=10',
  '/api/classes?limit=10',
  '/api/sections?limit=10',
  '/api/exams?limit=10',
  '/api/subjects?limit=10',
  '/api/dashboard/summary',
];

function generateToken(user) {
  const iat = Math.floor(Date.now() / 1000);
  const exp = iat + 86400;

  const header = { alg: 'HS256', typ: 'JWT' };
  const payload = {
    userId: user.id,
    tenantId: user.tenantId,
    role: user.role,
    email: user.email,
    iat,
    exp,
  };

  const headerB64 = encoding.b64encode(JSON.stringify(header), 'rawurl');
  const payloadB64 = encoding.b64encode(JSON.stringify(payload), 'rawurl');
  const signingInput = `${headerB64}.${payloadB64}`;

  const secret = __ENV.JWT_SECRET || 'pathshala-pro-jwt-secret-key-2026-change-in-production';
  const signature = crypto.hmac('sha256', secret, signingInput, 'base64rawurl');

  return `${signingInput}.${signature}`;
}

export const options = {
  // Stepped realistic scale test: 5 -> 15 -> 30 VUs
  stages: [
    { duration: '10s', target: 5 },   // 5 concurrent users
    { duration: '20s', target: 15 },  // 15 concurrent users
    { duration: '15s', target: 30 },  // 30 concurrent users
    { duration: '10s', target: 0 },   // Cool down
  ],
  thresholds: {
    'http_req_duration': ['p(95)<3000'],
    'http_req_failed': ['rate<0.05'],
  },
};

export default function () {
  const user = USERS[__VU % USERS.length];
  const token = generateToken(user);
  const endpoint = ENDPOINTS[Math.floor(Math.random() * ENDPOINTS.length)];

  const res = http.get(`http://localhost:3001${endpoint}`, {
    headers: {
      'Authorization': `Bearer ${token}`,
      'x-forwarded-for': `192.168.1.${(__VU % 250) + 1}`,
    },
    timeout: '10s',
  });

  check(res, {
    'status is 200': (r) => r.status === 200,
    'not rate limited': (r) => r.status !== 429,
  });

  sleep(0.3);
}
