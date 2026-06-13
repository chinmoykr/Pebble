export function handleListContinuation(textarea: HTMLTextAreaElement, e: KeyboardEvent): boolean {
	if (e.key !== 'Enter' || e.metaKey || e.ctrlKey || e.shiftKey) {
		return false;
	}

	const cursorPosition = textarea.selectionStart;
	const textBeforeCursor = textarea.value.substring(0, cursorPosition);
	const lines = textBeforeCursor.split('\n');
	const currentLine = lines[lines.length - 1];

	if (currentLine === undefined) return false;

	const todoMatch = currentLine.match(/^(\s*)([-*]\s\[[ xX]\]\s)(.*)$/);
	const bulletMatch = currentLine.match(/^(\s*)([-*]\s)(.*)$/);
	const numberMatch = currentLine.match(/^(\s*)(\d+)(\.\s)(.*)$/);

	if (todoMatch || bulletMatch || numberMatch) {
		e.preventDefault();
		
		let insertion = '\n';
		if (todoMatch) {
			const indent = todoMatch[1] || '';
			const bullet = todoMatch[2] || '';
			const content = todoMatch[3] || '';

			if (!content.trim()) {
				const newTextBefore = textBeforeCursor.substring(0, cursorPosition - bullet.length - indent.length);
				textarea.value = newTextBefore + '\n' + textarea.value.substring(textarea.selectionEnd);
				textarea.selectionStart = textarea.selectionEnd = newTextBefore.length + 1;
				return true;
			}
			
			const newBullet = bullet.replace(/\[[ xX]\]/, '[ ]');
			insertion += indent + newBullet;
		} else if (bulletMatch) {
			const indent = bulletMatch[1] || '';
			const bullet = bulletMatch[2] || '';
			const content = bulletMatch[3] || '';

			if (!content.trim()) {
				const newTextBefore = textBeforeCursor.substring(0, cursorPosition - bullet.length - indent.length);
				textarea.value = newTextBefore + '\n' + textarea.value.substring(textarea.selectionEnd);
				textarea.selectionStart = textarea.selectionEnd = newTextBefore.length + 1;
				return true;
			}
			insertion += indent + bullet;
		} else if (numberMatch) {
			const indent = numberMatch[1] || '';
			const numberStr = numberMatch[2] || '1';
			const dotSpace = numberMatch[3] || '. ';
			const content = numberMatch[4] || '';

			if (!content.trim()) {
				const newTextBefore = textBeforeCursor.substring(0, cursorPosition - numberStr.length - dotSpace.length - indent.length);
				textarea.value = newTextBefore + '\n' + textarea.value.substring(textarea.selectionEnd);
				textarea.selectionStart = textarea.selectionEnd = newTextBefore.length + 1;
				return true;
			}
			const nextNumber = parseInt(numberStr, 10) + 1;
			insertion += indent + nextNumber + dotSpace;
		}

		const textAfterCursor = textarea.value.substring(textarea.selectionEnd);
		textarea.value = textBeforeCursor + insertion + textAfterCursor;
		textarea.selectionStart = textarea.selectionEnd = cursorPosition + insertion.length;
		return true;
	}

	return false;
}
