const { sequelize } = require('./src/models');
async function addColumn() {
  try {
    await sequelize.query('ALTER TABLE bank_accounts ADD COLUMN "includeInTotals" BOOLEAN NOT NULL DEFAULT true;');
    console.log('Column added successfully');
  } catch (e) {
    console.log('Error:', e.message);
  }
  process.exit();
}
addColumn();
