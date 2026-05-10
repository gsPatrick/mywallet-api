const { sequelize } = require('./src/models');

async function addColumns() {
  const columns = [
    { name: 'includeInTotals', type: 'BOOLEAN NOT NULL DEFAULT true' },
    { name: 'pin', type: 'STRING(4)' },
    { name: 'hideBalance', type: 'BOOLEAN NOT NULL DEFAULT false' }
  ];

  for (const col of columns) {
    try {
      console.log(`Adding column ${col.name}...`);
      await sequelize.query(`ALTER TABLE bank_accounts ADD COLUMN "${col.name}" ${col.type};`);
      console.log(`Column ${col.name} added successfully`);
    } catch (e) {
      if (e.message.includes('duplicate column name') || e.message.includes('already exists')) {
        console.log(`Column ${col.name} already exists, skipping.`);
      } else {
        console.log(`Error adding ${col.name}:`, e.message);
      }
    }
  }
  process.exit();
}

addColumns();
