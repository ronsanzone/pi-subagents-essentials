type StepStatus = "pending" | "running" | "complete" | "completed" | "failed" | "paused";
type StepStatusLike = { status: StepStatus };

function isFailedStepStatus(status: StepStatus): boolean {
	return status === "failed";
}

function isRunningStepStatus(status: StepStatus): boolean {
	return status === "running";
}

function isPausedStepStatus(status: StepStatus): boolean {
	return status === "paused";
}

function isCompletedStepStatus(status: StepStatus): boolean {
	return status === "completed" || status === "complete";
}

export function aggregateStepStatus(steps: StepStatusLike[]): StepStatus {
	if (steps.some((step) => isFailedStepStatus(step.status))) return "failed";
	if (steps.some((step) => isPausedStepStatus(step.status))) return "paused";
	if (steps.some((step) => isRunningStepStatus(step.status))) return "running";
	if (steps.length > 0 && steps.every((step) => isCompletedStepStatus(step.status))) return "completed";
	return "pending";
}
