// Shared check for exact copied prose across topic boundaries.
function normaliseSentence(value: string) {
	return value
		.toLocaleLowerCase()
		.replace(/[^a-z0-9\s]/g, ' ')
		.replace(/\s+/g, ' ')
		.trim();
}

function sentenceUnits(value: string) {
	return String(value || '')
		.split(/(?<=[.!?])\s+/)
		.map((part) => part.trim())
		.filter((part) => part.length >= 45);
}

export function findExactCrossTopicSentenceDuplication(
	rows: Array<{ ref: string; understanding: string; editable: boolean }>
) {
	const owners = new Map<string, Set<string>>();
	for (const row of rows) {
		for (const sentence of sentenceUnits(row.understanding)) {
			const key = normaliseSentence(sentence);
			if (key.length < 40) continue;
			const refs = owners.get(key) ?? new Set<string>();
			refs.add(row.ref);
			owners.set(key, refs);
		}
	}

	const groups: Array<{ sentenceKey: string; refs: string[]; editableRefs: string[] }> = [];
	for (const [sentenceKey, refs] of owners.entries()) {
		if (refs.size < 2) continue;
		const duplicated = rows.filter((row) => refs.has(row.ref));
		const editableRefs = duplicated.filter((row) => row.editable).map((row) => row.ref);
		if (editableRefs.length) groups.push({ sentenceKey, refs: [...refs], editableRefs });
	}
	return groups;
}
