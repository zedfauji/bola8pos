// Enable debug logging for all database queries
process.env.DEBUG = 'sequelize:*';
process.env.DEBUG_DEPTH = '10';

// Start the server
require('../src/server.js');

console.log('Server started with debug logging enabled');
