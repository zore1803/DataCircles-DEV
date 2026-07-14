const COLORS = [
    { bg: "bg-blue-100", text: "text-blue-800" },
    { bg: "bg-green-100", text: "text-green-800" },
    { bg: "bg-purple-100", text: "text-purple-800" },
    { bg: "bg-yellow-100", text: "text-yellow-800" },
    { bg: "bg-pink-100", text: "text-pink-800" },
    { bg: "bg-indigo-100", text: "text-indigo-800" },
    { bg: "bg-red-100", text: "text-red-800" },
    { bg: "bg-orange-100", text: "text-orange-800" },
    { bg: "bg-teal-100", text: "text-teal-800" },
    { bg: "bg-cyan-100", text: "text-cyan-800" },
    { bg: "bg-lime-100", text: "text-lime-800" },
    { bg: "bg-emerald-100", text: "text-emerald-800" },
    { bg: "bg-violet-100", text: "text-violet-800" },
    { bg: "bg-fuchsia-100", text: "text-fuchsia-800" },
    { bg: "bg-rose-100", text: "text-rose-800" },
];

export const getIndustryStyle = (industryName) => {
    if (!industryName) {
        return { bg: "bg-gray-100", text: "text-gray-800" };
    }

    // Simple hash function
    let hash = 0;
    for (let i = 0; i < industryName.length; i++) {
        hash = industryName.charCodeAt(i) + ((hash << 5) - hash);
    }

    // Get pseudo-deterministic index
    const index = Math.abs(hash) % COLORS.length;
    return COLORS[index];
};
