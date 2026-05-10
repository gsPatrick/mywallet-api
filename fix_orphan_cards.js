/**
 * Maintenance Script: Link Orphaned Cards
 * ========================================
 * Finds all credit cards with bankAccountId: null
 * and links them to the first active bank account of their profile.
 * ========================================
 */

const { CreditCard, BankAccount } = require('./src/models');

async function repairOrphanedCards() {
    console.log('🔍 [MAINTENANCE] Checking for orphaned credit cards...');
    
    try {
        const orphanCards = await CreditCard.findAll({
            where: { bankAccountId: null }
        });

        if (orphanCards.length === 0) {
            console.log('✅ [MAINTENANCE] No orphaned cards found.');
            return;
        }

        console.log(`🛠️ [MAINTENANCE] Found ${orphanCards.length} orphaned cards. Repairing...`);

        for (const card of orphanCards) {
            // Find a bank account for this profile
            const bank = await BankAccount.findOne({
                where: { profileId: card.profileId, isActive: true },
                order: [['isDefault', 'DESC'], ['createdAt', 'ASC']]
            });

            if (bank) {
                card.bankAccountId = bank.id;
                await card.save();
                console.log(`✅ [MAINTENANCE] Linked card "${card.name}" to bank "${bank.nickname}" (Profile: ${card.profileId})`);
            } else {
                console.log(`⚠️ [MAINTENANCE] Could not find a bank for card "${card.name}" in profile ${card.profileId}`);
            }
        }

        console.log('✨ [MAINTENANCE] Repair complete.');
    } catch (error) {
        console.error('❌ [MAINTENANCE] Error during repair:', error);
    }
}

// Execute if run directly
if (require.main === module) {
    repairOrphanedCards().then(() => process.exit(0));
}

module.exports = repairOrphanedCards;
