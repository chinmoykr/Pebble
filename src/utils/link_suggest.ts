import { App, TFile } from 'obsidian';

export class LinkSuggestManager {
	app: App;
	textarea: HTMLTextAreaElement;
	container: HTMLElement;
	popupEl: HTMLElement | null = null;
	suggestions: TFile[] = [];
	selectedIndex: number = 0;
	isActive: boolean = false;
	
	matchIndex: number = -1;
	matchLength: number = 0;

	constructor(app: App, textarea: HTMLTextAreaElement, container: HTMLElement) {
		this.app = app;
		this.textarea = textarea;
		this.container = container;
	}

	init() {
		this.textarea.addEventListener('input', this.onInput.bind(this));
		this.textarea.addEventListener('keydown', this.onKeyDown.bind(this));
		
		document.addEventListener('click', (e) => {
			if (this.isActive && this.popupEl && !this.popupEl.contains(e.target as Node) && e.target !== this.textarea) {
				this.hideSuggest();
			}
		});
	}

	onInput() {
		const val = this.textarea.value;
		const cursor = this.textarea.selectionStart;
		
		const textBeforeCursor = val.substring(0, cursor);
		const lastOpen = textBeforeCursor.lastIndexOf('[[');
		const lastClose = textBeforeCursor.lastIndexOf(']]');
		
		if (lastOpen !== -1 && lastOpen > lastClose) {
			const query = textBeforeCursor.substring(lastOpen + 2);
			this.matchIndex = lastOpen + 2;
			this.matchLength = query.length;
			this.showSuggest(query);
		} else {
			this.hideSuggest();
		}
	}

	onKeyDown(e: KeyboardEvent) {
		if (!this.isActive) return;

		if (e.key === 'ArrowDown') {
			e.preventDefault();
			this.selectedIndex = (this.selectedIndex + 1) % this.suggestions.length;
			this.renderSuggestions();
		} else if (e.key === 'ArrowUp') {
			e.preventDefault();
			this.selectedIndex = (this.selectedIndex - 1 + this.suggestions.length) % this.suggestions.length;
			this.renderSuggestions();
		} else if (e.key === 'Enter') {
			e.preventDefault();
			e.stopPropagation();
			const suggestion = this.suggestions[this.selectedIndex];
			if (suggestion) {
				this.selectSuggestion(suggestion);
			}
		} else if (e.key === 'Escape') {
			e.preventDefault();
			this.hideSuggest();
		}
	}

	showSuggest(query: string) {
		const files = this.app.vault.getMarkdownFiles();
		const lowerQuery = query.toLowerCase();
		
		this.suggestions = files.filter(f => f.basename.toLowerCase().includes(lowerQuery));
		
		this.suggestions.sort((a, b) => {
			const aBase = a.basename.toLowerCase();
			const bBase = b.basename.toLowerCase();
			if (aBase.startsWith(lowerQuery) && !bBase.startsWith(lowerQuery)) return -1;
			if (!aBase.startsWith(lowerQuery) && bBase.startsWith(lowerQuery)) return 1;
			return aBase.localeCompare(bBase);
		});
		
		this.suggestions = this.suggestions.slice(0, 10);
		
		if (this.suggestions.length === 0) {
			this.hideSuggest();
			return;
		}

		this.isActive = true;
		
		// Only reset selectedIndex if it's out of bounds
		if (this.selectedIndex >= this.suggestions.length) {
			this.selectedIndex = 0;
		}
		
		if (!this.popupEl) {
			this.popupEl = this.container.createDiv('pebble-suggest-popup');
		}
		
		this.popupEl.style.display = 'block';
		this.renderSuggestions();
	}

	hideSuggest() {
		this.isActive = false;
		if (this.popupEl) {
			this.popupEl.style.display = 'none';
		}
	}

	renderSuggestions() {
		if (!this.popupEl) return;
		this.popupEl.empty();
		
		this.suggestions.forEach((file, idx) => {
			const itemEl = this.popupEl!.createDiv('pebble-suggest-item');
			if (idx === this.selectedIndex) {
				itemEl.addClass('is-selected');
			}
			
			const titleEl = itemEl.createDiv('pebble-suggest-title');
			titleEl.setText(file.basename);
			
			const pathEl = itemEl.createDiv('pebble-suggest-path');
			pathEl.setText(file.path);
			
			itemEl.onclick = (e) => {
				e.preventDefault();
				this.selectSuggestion(file);
			};
		});
	}

	selectSuggestion(file: TFile) {
		const val = this.textarea.value;
		const before = val.substring(0, this.matchIndex);
		const after = val.substring(this.matchIndex + this.matchLength);
		
		const insertText = file.basename + ']]';
		
		this.textarea.value = before + insertText + after;
		this.hideSuggest();
		
		const newCursor = before.length + insertText.length;
		this.textarea.setSelectionRange(newCursor, newCursor);
		this.textarea.focus();
		this.textarea.dispatchEvent(new Event('input', { bubbles: true }));
	}
}
