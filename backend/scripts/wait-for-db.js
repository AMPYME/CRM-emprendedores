/**
 * Espera a PostgreSQL antes de prisma migrate deploy (Dokploy / Docker).
 *
 * Prisma P1001 suele ser: DNS IPv6, postgres aún no listo, o timeout de 5s.
 * Reescribe DATABASE_URL a IPv4 + connect_timeout y reintenta la conexión.
 *
 * Uso: node scripts/wait-for-db.js [archivo-url]
 *   - escribe la URL preparada en el archivo (default /tmp/emprendedores-database-url)
 *   - logs en stderr; el shell debe `export DATABASE_URL="$(cat archivo)"`
 */
const dns = require('dns');
const fs = require('fs');
const net = require('net');
const { PrismaClient } = require('@prisma/client');

const MAX_ATTEMPTS = Number(process.env.DB_WAIT_ATTEMPTS || 40);
const DELAY_MS = Number(process.env.DB_WAIT_DELAY_MS || 3000);
const OUT_FILE = process.argv[2] || '/tmp/emprendedores-database-url';

function redact(url) {
  return String(url || '').replace(/:([^:@/]+)@/, ':***@');
}

function toHttpUrl(raw) {
  return new URL(raw.replace(/^postgres(ql)?:/i, 'http:'));
}

function fromHttpUrl(raw, httpUrl) {
  const proto = /^postgresql:/i.test(raw) ? 'postgresql:' : 'postgres:';
  return proto + httpUrl.toString().slice('http:'.length);
}

function prepareUrl(raw) {
  if (!raw || !String(raw).trim()) {
    throw new Error('DATABASE_URL no está definida');
  }
  const httpUrl = toHttpUrl(raw);
  if (!httpUrl.searchParams.has('connect_timeout')) {
    httpUrl.searchParams.set('connect_timeout', '60');
  }
  if (!httpUrl.searchParams.has('pool_timeout')) {
    httpUrl.searchParams.set('pool_timeout', '30');
  }
  return fromHttpUrl(raw, httpUrl);
}

function lookupIpv4(hostname) {
  return new Promise((resolve) => {
    if (!hostname || hostname === 'localhost' || net.isIP(hostname) === 4) {
      resolve(hostname);
      return;
    }
    dns.lookup(hostname, { family: 4 }, (err, address) => {
      if (err || !address) {
        console.error(`⚠️  DNS IPv4 de ${hostname}: ${err ? err.message : 'sin dirección'}`);
        resolve(hostname);
        return;
      }
      if (address !== hostname) {
        console.error(`🔗 PostgreSQL ${hostname} → ${address}`);
      }
      resolve(address);
    });
  });
}

function withHost(raw, hostname) {
  const httpUrl = toHttpUrl(raw);
  httpUrl.hostname = hostname;
  return fromHttpUrl(raw, httpUrl);
}

function tcpProbe(host, port, timeoutMs) {
  return new Promise((resolve) => {
    const socket = net.connect({ host, port, family: 4 }, () => {
      socket.end();
      resolve(true);
    });
    socket.setTimeout(timeoutMs);
    socket.on('error', () => {
      socket.destroy();
      resolve(false);
    });
    socket.on('timeout', () => {
      socket.destroy();
      resolve(false);
    });
  });
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function prismaPing(url) {
  const prisma = new PrismaClient({ datasources: { db: { url } } });
  try {
    await prisma.$queryRawUnsafe('SELECT 1');
    return true;
  } catch (err) {
    console.error(`   Prisma: ${err && err.message ? err.message.split('\n')[0] : err}`);
    return false;
  } finally {
    await prisma.$disconnect().catch(() => {});
  }
}

async function main() {
  const prepared = prepareUrl(process.env.DATABASE_URL);
  const parsed = toHttpUrl(prepared);
  const ipv4 = await lookupIpv4(parsed.hostname);
  const finalUrl = ipv4 && ipv4 !== parsed.hostname ? withHost(prepared, ipv4) : prepared;
  const host = toHttpUrl(finalUrl).hostname;
  const port = Number(toHttpUrl(finalUrl).port || 5432);

  fs.writeFileSync(OUT_FILE, finalUrl, 'utf8');
  console.error(`🗄️  Destino: ${redact(finalUrl)}`);

  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt += 1) {
    process.stderr.write(`⏳ PostgreSQL intento ${attempt}/${MAX_ATTEMPTS}… `);
    const tcpOk = await tcpProbe(host, port, 4000);
    if (!tcpOk) {
      console.error(`TCP cerrado en ${host}:${port}`);
    } else {
      const ok = await prismaPing(finalUrl);
      if (ok) {
        console.error('✅ PostgreSQL disponible');
        return;
      }
    }
    if (attempt < MAX_ATTEMPTS) await sleep(DELAY_MS);
  }

  console.error('');
  console.error('❌ No se alcanzó PostgreSQL (Prisma P1001).');
  console.error('   En Dokploy:');
  console.error('   1) El backend debe estar en el mismo Environment que la BD.');
  console.error('   2) DATABASE_URL debe usar el hostname interno actual (si recreaste la BD, cópialo de nuevo).');
  console.error('   3) En el servicio backend: Advanced → Linked services / Network, enlaza la base de datos.');
  process.exit(1);
}

main().catch((err) => {
  console.error('❌ wait-for-db:', err && err.message ? err.message : err);
  process.exit(1);
});
