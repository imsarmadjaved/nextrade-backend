const pricingTiers = [
    { duration: 7, price: 500, name: "1 Week" },
    { duration: 14, price: 900, name: "2 Weeks" },
    { duration: 30, price: 1500, name: "1 Month" },
    { duration: 60, price: 2500, name: "2 Months" },
    { duration: 90, price: 3000, name: "3 Months" }
];

// Calculate price based on duration
const calculatePrice = (duration) => {
    const tier = pricingTiers.find(t => t.duration === duration);
    if (tier) return tier.price;

    // Fallback: 50 rupees per day
    return duration * 50;
};

module.exports = { pricingTiers, calculatePrice };
