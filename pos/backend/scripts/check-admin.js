const { pool } = require('../src/db');

(async () => {
  try {
    const [rows] = await pool.query("SELECT id, email, name, role_id, is_active FROM users WHERE email = 'admin@billiardpos.com'");
    if (rows.length === 0) {
      console.log('Admin user not found.');
    } else {
      console.log('Admin user:');
      console.log(rows[0]);
    }
    process.exit(0);
  } catch (e) {
    console.error('Error checking admin:', e.message);
    process.exit(1);
  }
})();
