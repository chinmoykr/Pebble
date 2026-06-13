import { ItemView, WorkspaceLeaf, Notice, MarkdownRenderer, setIcon, moment } from 'obsidian';
import { PebbleManager } from '../utils/pebble_manager';
import type PebblePlugin from '../main';
import { PebbleMetadata } from '../types';
import { handleListContinuation } from '../utils/editor_helpers';

export const PEBBLE_VIEW_TYPE = 'pebble-view';

export class PebbleView extends ItemView {
	plugin: PebblePlugin;
	
	captureTextarea!: HTMLTextAreaElement;
	feedContainer!: HTMLDivElement;
	tagsContainer!: HTMLDivElement;
	
	allPebbles: PebbleMetadata[] = [];
	displayedPebbles: PebbleMetadata[] = [];
	
	activeTagFilters: Set<string> = new Set();
	currentPage = 0;
	isTagsExpanded = false;
	
	private refreshTimeout: NodeJS.Timeout | null = null;

	constructor(leaf: WorkspaceLeaf, plugin: PebblePlugin) {
		super(leaf);
		this.plugin = plugin;
	}

	getViewType(): string {
		return PEBBLE_VIEW_TYPE;
	}

	getDisplayText(): string {
		return 'Pebble';
	}

	getIcon(): string {
		return 'zap';
	}

	async onOpen() {
		const container = this.contentEl;
		container.empty();
		container.addClass('pebble-view-container');

		const innerWrapper = container.createDiv('pebble-view-inner');

		// Capture Area
		const captureArea = innerWrapper.createDiv('pebble-capture-area');
		this.captureTextarea = captureArea.createEl('textarea', {
			cls: 'pebble-capture-textarea',
			attr: {
				placeholder: "Drop a new pebble...",
				rows: "3"
			}
		});
		
		this.captureTextarea.addEventListener('input', (e) => {
			const target = e.target as HTMLTextAreaElement;
			const oldScrollTop = target.scrollTop;
			target.style.height = 'auto';
			target.style.height = target.scrollHeight + 'px';
			if (target.selectionStart === target.value.length) {
				target.scrollTop = target.scrollHeight;
			} else {
				target.scrollTop = oldScrollTop;
			}
		});
		
		const controls = captureArea.createDiv('pebble-capture-controls');
		
		const rightControls = controls.createDiv('pebble-capture-right-controls');

		const saveBtn = rightControls.createEl('button', { cls: 'pebble-save-btn' });
		saveBtn.innerHTML = `
			<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line></svg>
		`;
		
		saveBtn.onclick = () => this.savePebble();
		this.captureTextarea.addEventListener('keydown', (e: KeyboardEvent) => {
			if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
				e.preventDefault();
				this.savePebble();
				return;
			}
			
			if (handleListContinuation(this.captureTextarea, e)) {
				this.captureTextarea.dispatchEvent(new Event('input', { bubbles: true }));
				return;
			}
		});

		this.tagsContainer = innerWrapper.createDiv('pebble-tags-container');
		this.feedContainer = innerWrapper.createDiv('pebble-feed-container');
		
		container.addEventListener('scroll', () => {
			if (container.scrollTop + container.clientHeight >= container.scrollHeight - 50) {
				this.loadMoreCards();
			}
		});

		this.allPebbles = PebbleManager.getPebbles(this.app, this.plugin.settings);
		await this.renderFeed();
		
		this.registerEvent(this.app.vault.on('create', (file) => this.onVaultChange(file, 'create')));
		this.registerEvent(this.app.vault.on('delete', (file) => this.onVaultChange(file, 'delete')));
		this.registerEvent(this.app.vault.on('modify', (file) => this.onVaultChange(file, 'modify')));
		this.registerEvent(this.app.metadataCache.on('changed', (file) => this.onVaultChange(file, 'modify')));
	}

	onVaultChange(file: any, action: 'create' | 'delete' | 'modify') {
		if (file.path && file.path.startsWith(this.plugin.settings.folderPath + '/')) {
			this.allPebbles = this.allPebbles.filter(p => p.file.path !== file.path);
			
			if (action === 'delete') {
				const cards = Array.from(this.feedContainer.querySelectorAll('.pebble-card'));
				const cardEl = cards.find(c => c.getAttribute('data-path') === file.path);
				if (cardEl) {
					const dayGroup = cardEl.closest('.pebble-day-group');
					cardEl.remove();
					if (dayGroup) {
						const remaining = dayGroup.querySelectorAll('.pebble-card').length;
						if (remaining === 0) {
							dayGroup.remove();
						} else {
							const countEl = dayGroup.querySelector('.pebble-date-count');
							if (countEl) countEl.textContent = String(remaining);
						}
					}
				}
				
				this.displayedPebbles = this.displayedPebbles.filter(p => p.file.path !== file.path);
				this.updateTagsFilter();
				
				if (this.allPebbles.length === 0) {
					this.feedContainer.empty();
					const emptyState = this.feedContainer.createDiv('pebble-empty-state');
					emptyState.setText('Create your first pebble!');
				} else if (this.displayedPebbles.length === 0) {
					this.feedContainer.empty();
					const emptyState = this.feedContainer.createDiv('pebble-empty-state');
					emptyState.setText('No pebbles found for selected tags.');
				}
				return;
			}
			
			const updatedPebble = PebbleManager.getPebble(this.app, file);
			if (updatedPebble) {
				this.allPebbles.push(updatedPebble);
			}
			
			this.allPebbles.sort((a, b) => b.created - a.created);

			if (this.refreshTimeout) clearTimeout(this.refreshTimeout);
			this.refreshTimeout = setTimeout(() => {
				this.renderFeed();
			}, 300);
		}
	}

	async savePebble() {
		const text = this.captureTextarea.value.trim();
		if (!text) return;
		
		try {
			await PebbleManager.savePebble(this.app, this.plugin.settings, text);
			this.captureTextarea.value = '';
			this.captureTextarea.style.height = 'auto'; // Reset height after save
		} catch (e) {
			console.error(e);
			new Notice('Failed to save pebble');
		}
	}

	async renderFeed() {
		this.updateTagsFilter();

		const filtered = this.allPebbles.filter(p => {
			if (this.activeTagFilters.size === 0) return true;
			return Array.from(this.activeTagFilters).every(t => p.tags.includes(t));
		});

		this.currentPage = 0;
		this.displayedPebbles = filtered;
		
		if (this.allPebbles.length === 0) {
			this.feedContainer.empty();
			const emptyState = this.feedContainer.createDiv('pebble-empty-state');
			emptyState.setText('Create your first pebble!');
		} else if (this.displayedPebbles.length === 0) {
			this.feedContainer.empty();
			const emptyState = this.feedContainer.createDiv('pebble-empty-state');
			emptyState.setText('No pebbles found for selected tags.');
		} else {
			await this.loadMoreCards(true);
		}
	}

	updateTagsFilter() {
		this.tagsContainer.empty();
		
		const allTags = new Set<string>();
		for (const pebble of this.allPebbles) {
			pebble.tags.forEach(t => allTags.add(t));
		}
		
		if (allTags.size === 0) {
			return;
		}
		
		const allChip = this.tagsContainer.createSpan({ cls: 'pebble-tag-chip' });
		allChip.setText('All');
		if (this.activeTagFilters.size === 0) allChip.addClass('is-active');
		allChip.onclick = () => {
			this.activeTagFilters.clear();
			this.renderFeed();
		};

		const sortedTags = Array.from(allTags).sort();
		const maxVisible = 8;
		const tagsToShow = this.isTagsExpanded ? sortedTags : sortedTags.slice(0, maxVisible);

		tagsToShow.forEach(tag => {
			const chip = this.tagsContainer.createSpan({ cls: 'pebble-tag-chip' });
			chip.setText('#' + tag);
			if (this.activeTagFilters.has(tag)) chip.addClass('is-active');
			chip.onclick = () => {
				if (this.activeTagFilters.has(tag)) {
					this.activeTagFilters.delete(tag);
				} else {
					this.activeTagFilters.add(tag);
				}
				this.renderFeed();
			};
		});

		if (!this.isTagsExpanded && sortedTags.length > maxVisible) {
			const showMoreChip = this.tagsContainer.createSpan({ cls: 'pebble-show-more-tags-btn' });
			showMoreChip.setText('Show more...');
			showMoreChip.onclick = () => {
				this.isTagsExpanded = true;
				this.updateTagsFilter();
			};
		} else if (this.isTagsExpanded && sortedTags.length > maxVisible) {
			const showLessChip = this.tagsContainer.createSpan({ cls: 'pebble-show-more-tags-btn' });
			showLessChip.setText('Show less');
			showLessChip.onclick = () => {
				this.isTagsExpanded = false;
				this.updateTagsFilter();
			};
		}
	}

	async loadMoreCards(clearFirst = false) {
		const perPage = this.plugin.settings.cardsPerPage;
		const start = this.currentPage * perPage;
		const end = start + perPage;
		const toLoad = this.displayedPebbles.slice(start, end);
		
		if (toLoad.length === 0) {
			if (clearFirst) this.feedContainer.empty();
			return;
		}
		
		let lastRenderedDateStr = '';
		let currentDayGroup: HTMLElement | null = null;
		
		if (!clearFirst && this.feedContainer.lastElementChild && this.feedContainer.lastElementChild.hasClass('pebble-day-group')) {
			const lastGroup = this.feedContainer.lastElementChild as HTMLElement;
			lastRenderedDateStr = lastGroup.getAttribute('data-date') || '';
			currentDayGroup = lastGroup;
		}

		const fragment = document.createDocumentFragment();
		let fragmentGroup: HTMLElement | null = null;
		const cardsToRender: { el: HTMLElement, pebble: PebbleMetadata }[] = [];

		for (const pebble of toLoad) {
			const pebbleDateStr = this.getRelativeDateString(pebble.created);
			if (pebbleDateStr !== lastRenderedDateStr) {
				fragmentGroup = createDiv('pebble-day-group');
				fragmentGroup.setAttribute('data-date', pebbleDateStr);
				this.renderDateSeparator(fragmentGroup, pebbleDateStr, this.countPebblesForDate(pebble.created));
				fragment.appendChild(fragmentGroup);
				lastRenderedDateStr = pebbleDateStr;
			}
			
			const targetGroup = fragmentGroup || currentDayGroup!;
			const cardEl = this.buildCardStructure(targetGroup, pebble, pebbleDateStr);
			cardsToRender.push({ el: cardEl, pebble });
		}
		
		// Render markdown BEFORE appending so the UI doesn't blink with empty cards
		for (const item of cardsToRender) {
			await this.renderMarkdownContent(item.el, item.pebble);
		}

		if (clearFirst) {
			this.feedContainer.empty();
		}
		
		if (fragment.children.length > 0) {
			this.feedContainer.appendChild(fragment);
		}
		
		this.currentPage++;
	}

	countPebblesForDate(timestamp: number): number {
		const targetDateStr = this.getRelativeDateString(timestamp);
		return this.displayedPebbles.filter(p => this.getRelativeDateString(p.created) === targetDateStr).length;
	}

	getRelativeDateString(timestamp: number): string {
		const m = moment(timestamp);
		const today = moment().startOf('day');
		const yesterday = moment().subtract(1, 'days').startOf('day');
		
		if (m.isSame(today, 'd')) {
			return 'TODAY';
		} else if (m.isSame(yesterday, 'd')) {
			return 'YESTERDAY';
		} else {
			return m.format('DD MMM YYYY').toUpperCase();
		}
	}

	renderDateSeparator(container: HTMLElement, dateStr: string, count: number) {
		const sepWrapper = container.createDiv('pebble-date-separator-wrapper');
		const sep = sepWrapper.createDiv('pebble-date-separator');
		
		const iconEl = sep.createSpan('pebble-date-icon');
		setIcon(iconEl, 'calendar-days');
		
		sep.createSpan({ text: dateStr, cls: 'pebble-date-text' });
		
		const countEl = sep.createSpan('pebble-date-count');
		countEl.setText(String(count));
	}

	buildCardStructure(container: HTMLElement, pebble: PebbleMetadata, dateStr: string): HTMLElement {
		const card = container.createDiv('pebble-card');
		card.setAttribute('data-date', dateStr);
		card.setAttribute('data-path', pebble.file.path);
		
		const header = card.createDiv('pebble-card-header');
		const timeEl = header.createSpan('pebble-card-time');
		timeEl.setText(moment(pebble.created).format('DD MMM YYYY [at] hh:mm A'));

		const actions = header.createDiv('pebble-card-actions');
		
		const copyBtn = actions.createSpan('pebble-icon-btn');
		setIcon(copyBtn, 'copy');
		copyBtn.onclick = async (e) => {
			e.stopPropagation();
			const content = await this.app.vault.cachedRead(pebble.file);
			const body = content.replace(/^---[\s\S]+?---\n/, '');
			navigator.clipboard.writeText(body.trim());
			new Notice('Copied to clipboard');
		};

		const deleteBtn = actions.createSpan('pebble-icon-btn');
		setIcon(deleteBtn, 'trash');
		deleteBtn.onclick = async (e) => {
			e.stopPropagation();
			if (confirm('Delete this pebble?')) {
				await PebbleManager.deletePebble(this.app, pebble.file);
			}
		};

		card.createDiv('pebble-card-content');
		return card;
	}

	async renderMarkdownContent(card: HTMLElement, pebble: PebbleMetadata) {
		const contentPreview = card.querySelector('.pebble-card-content') as HTMLElement;
		if (!contentPreview) return;

		const content = await this.app.vault.cachedRead(pebble.file);
		const body = content.replace(/^---[\s\S]+?---\n/, '');
		
		const renderDiv = contentPreview.createDiv('pebble-rendered-markdown is-collapsed');
		
		const showMoreBtn = contentPreview.createEl('button', { cls: 'pebble-show-more-btn', text: 'Show more' });
		showMoreBtn.style.display = 'none';

		await MarkdownRenderer.render(this.app, body, renderDiv, pebble.file.path, this.plugin);

		renderDiv.addEventListener('click', (e: MouseEvent) => {
			const target = e.target as HTMLElement;
			if (target.matches('.tag')) {
				e.preventDefault();
				e.stopPropagation();
				const tagText = target.innerText.replace(/^#/, '');
				if (this.activeTagFilters.has(tagText)) {
					this.activeTagFilters.delete(tagText);
				} else {
					this.activeTagFilters.add(tagText);
				}
				this.renderFeed();
			}
		});

		setTimeout(() => {
			if (renderDiv.scrollHeight > 250) {
				showMoreBtn.style.display = 'block';
			} else {
				renderDiv.removeClass('is-collapsed');
			}
		}, 50);

		showMoreBtn.onclick = () => {
			if (renderDiv.hasClass('is-collapsed')) {
				renderDiv.removeClass('is-collapsed');
				showMoreBtn.setText('Show less');
			} else {
				renderDiv.addClass('is-collapsed');
				showMoreBtn.setText('Show more');
			}
		};
	}

	async onClose() {
		if (this.refreshTimeout) clearTimeout(this.refreshTimeout);
	}

	focusCaptureArea() {
		if (this.captureTextarea) {
			this.captureTextarea.focus();
		}
	}
}
