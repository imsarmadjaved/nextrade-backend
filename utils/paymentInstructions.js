const getPaymentInstructions = (ad) => {
    return {
        bankName: process.env.BANK_NAME || "SadaPay",
        accountNumber: process.env.ACCOUNT_NUMBER || "03064288122",
        accountName: process.env.ACCOUNT_NAME || "Muhammad Sarmad Javed",
        amount: ad.totalCost,
        reference: `AD${ad._id}`,
        dueDate: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000),
        instructions: "Please include the reference number in payment remarks"
    };
};

module.exports = { getPaymentInstructions };
