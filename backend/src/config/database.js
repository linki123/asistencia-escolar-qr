import mysql from 'mysql2/promise';

const databaseConfig = {
  host: process.env.DB_HOST || process.env.MYSQLHOST,
  port: Number(process.env.DB_PORT || process.env.MYSQLPORT || 3306),
  user: process.env.DB_USER || process.env.MYSQLUSER,
  password: process.env.DB_PASSWORD_BASE64
    ? Buffer.from(process.env.DB_PASSWORD_BASE64, 'base64').toString('utf8')
    : process.env.DB_PASSWORD || process.env.MYSQLPASSWORD || '',
  database: process.env.DB_NAME || process.env.MYSQLDATABASE
};
const missingVariables = ['host', 'user', 'database']
  .filter((name) => !databaseConfig[name])
  .map((name) => `DB_${name.toUpperCase()} (o variable MYSQL equivalente)`);

if (missingVariables.length > 0) {
  throw new Error(`Faltan variables de entorno: ${missingVariables.join(', ')}`);
}

if (typeof process.env.JWT_SECRET !== 'string' || process.env.JWT_SECRET.length < 32) {
  throw new Error('JWT_SECRET debe tener al menos 32 caracteres.');
}

const pool = mysql.createPool({
  ...databaseConfig,
  waitForConnections: true,
  connectionLimit: 10,
  timezone: '-05:00',
  charset: 'utf8mb4',
  dateStrings: true
});

export default pool;
