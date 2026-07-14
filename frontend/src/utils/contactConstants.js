export const lifecycleStageOptions = {
    Lead: ["New", "Contacted", "Interested", "Unqualified", "Lost Lead"],
    "Sales Qualified Lead": ["Qualified", "Lost"],
    Customer: ["Won", "Won Lead", "Churned"],
};

export const allLifecycleStages = Object.keys(lifecycleStageOptions);
export const allStageStatuses = Object.values(lifecycleStageOptions).flat();

export const lifecycleStageStatuses = allStageStatuses;

export const getLifecycleStageForStatus = (status) => {
    for (const [stage, statuses] of Object.entries(lifecycleStageOptions)) {
        if (statuses.includes(status)) {
            return stage;
        }
    }
    return "Lead";
};

export const getColumnColor = (column) => {
    switch (column) {
        case "New":
        case "Unqualified":
        case "Lost":
        case "Lost Lead":
            return "bg-red-50 border-red-200";
        case "Contacted":
            return "bg-amber-50 border-amber-200";
        case "Interested":
        case "Qualified":
            return "bg-blue-50 border-blue-200";
        case "Won":
        case "Won Lead":
            return "bg-green-50 border-green-200";
        case "Churned":
            return "bg-gray-50 border-gray-200";
        default:
            return "bg-gray-50 border-gray-200";
    }
};

export const getBadgeColor = (column) => {
    switch (column) {
        case "New":
        case "Unqualified":
        case "Lost":
        case "Lost Lead":
            return "bg-red-500";
        case "Contacted":
            return "bg-amber-500";
        case "Interested":
        case "Qualified":
            return "bg-blue-500";
        case "Won":
        case "Won Lead":
            return "bg-green-500";
        case "Churned":
            return "bg-gray-500";
        default:
            return "bg-gray-500";
    }
};
