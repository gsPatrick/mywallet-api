const { ManualTransaction, BankAccount } = require('./src/models');

async function debug() {
    try {
        const txId = '0613502b-875e-4ccd-999e-63b3f1abfac5';
        const tx = await ManualTransaction.findByPk(txId);
        if (!tx) {
            console.log('Transaction not found');
            return;
        }
        console.log('--- Transaction ---');
        console.log('ID:', tx.id);
        console.log('Description:', tx.description);
        console.log('bankAccountId:', tx.bankAccountId);
        console.log('profileId:', tx.profileId);
        
        const accounts = await BankAccount.findAll();
        console.log('--- Bank Accounts ---');
        accounts.forEach(a => {
            console.log(`ID: ${a.id} | Name: ${a.bankName} | Nick: ${a.nickname}`);
        });
    } catch (e) {
        console.error(e);
    }
}

debug();
