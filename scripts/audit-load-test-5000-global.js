import http from 'k6/http';
import { check, sleep } from 'k6';
import encoding from 'k6/encoding';
import crypto from 'k6/crypto';

// ==============================================================================
// 🌍 GLOBAL 5,000 CONCURRENT VIRTUAL USERS (SPIKE & STRESS TEST ARCHITECTURE)
// Simulating global traffic across North America, Europe, Asia, and MEA
// ==============================================================================

// Realistic global geo-IP pools to test geo-distributed traffic & rate limiters
const GLOBAL_IP_POOLS = [
  // US / North America (AWS us-east-1, Cloudflare, Fastly)
  () => `198.51.100.${Math.floor(Math.random() * 250) + 1}`,
  () => `203.0.113.${Math.floor(Math.random() * 250) + 1}`,
  // Europe (Frankfurt, London)
  () => `185.199.${Math.floor(Math.random() * 4) + 108}.${Math.floor(Math.random() * 250) + 1}`,
  // South Asia / Middle East (Bangladesh, India, UAE)
  () => `103.${Math.floor(Math.random() * 250)}.${Math.floor(Math.random() * 250)}.${Math.floor(Math.random() * 250) + 1}`,
  () => `118.179.${Math.floor(Math.random() * 250)}.${Math.floor(Math.random() * 250) + 1}`,
];

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

// Direct cryptographic JWT generator (bypasses bcrypt CPU bottleneck for 5k load)
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
  // Scenario: Rapid ramp-up to 5,000 global VUs with sustained peak
  stages: [
    { duration: '15s', target: 500 },   // Warm-up: 500 users
    { duration: '30s', target: 2500 },  // Scale: 2,500 users
    { duration: '45s', target: 5000 },  // Peak: 5,000 concurrent global users
    { duration: '30s', target: 5000 },  // Sustained 5,000 users worldwide
    { duration: '15s', target: 0 },     // Ramp-down
  ],
  thresholds: {
    'http_req_duration': ['p(95)<5000'],
  },
};

export default function () {
  const user = USERS[__VU % USERS.length];
  const token = generateToken(user);
  const randomGeoIp = GLOBAL_IP_POOLS[__VU % GLOBAL_IP_POOLS.length]();
  const endpoint = ENDPOINTS[Math.floor(Math.random() * ENDPOINTS.length)];

  const res = http.get(`http://localhost:3001${endpoint}`, {
    headers: {
      'Authorization': `Bearer ${token}`,
      'x-forwarded-for': randomGeoIp,
      'User-Agent': 'k6-global-load-test/1.0',
    },
    timeout: '10s',
  });

  check(res, {
    'status is 200': (r) => r.status === 200,
    'not rate limited (status != 429)': (r) => r.status !== 429,
    'server not crashed (status < 500)': (r) => r.status < 500,
  });

  // Randomized human think time (0.2s - 1s)
  sleep(0.2 + Math.random() * 0.8);
}
