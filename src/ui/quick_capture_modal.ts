import { App, Modal, Notice } from 'obsidian';
import { PebbleManager } from '../utils/pebble_manager';
import type PebblePlugin from '../main';
import { handleListContinuation } from '../utils/editor_helpers';
import { AttachmentManager } from '../utils/attachment_manager';
import { LinkSuggestManager } from '../utils/link_suggest';

export class QuickCaptureModal extends Modal {
	plugin: PebblePlugin;
	textarea!: HTMLTextAreaElement;
	noteReviewCheckbox: HTMLInputElement | null = null;

	constructor(app: App, plugin: PebblePlugin) {
		super(app);
		this.plugin = plugin;
	}

	onOpen() {
		const { contentEl } = this;
		contentEl.addClass('pebble-quick-capture-modal');
		contentEl.style.position = 'relative';

		this.textarea = contentEl.createEl('textarea', {
			cls: 'pebble-capture-textarea',
			attr: {
				placeholder: "Drop a new pebble...",
				rows: "3"
			}
		});

		const linkSuggest = new LinkSuggestManager(this.app, this.textarea, contentEl);
		linkSuggest.init();

		this.textarea.addEventListener('input', function () {
			const oldScrollTop = this.scrollTop;
			this.style.height = 'auto';
			this.style.height = this.scrollHeight + 'px';
			if (this.selectionStart === this.value.length) {
				this.scrollTop = this.scrollHeight;
			} else {
				this.scrollTop = oldScrollTop;
			}
		});

		const controlsEl = contentEl.createDiv('pebble-capture-controls');

		const leftControls = controlsEl.createDiv('pebble-capture-left-controls');
		const rightControls = controlsEl.createDiv('pebble-capture-right-controls');

		const fileInput = leftControls.createEl('input', {
			type: 'file',
			attr: {
				accept: 'image/*,application/pdf',
				multiple: 'multiple',
				style: 'display: none;'
			}
		});

		fileInput.onchange = async () => {
			if (fileInput.files && fileInput.files.length > 0) {
				await AttachmentManager.handleAttachments(this.app, this.plugin.settings, fileInput.files, this.textarea);
				fileInput.value = ''; // reset
			}
		};

		const attachmentBtn = leftControls.createSpan('pebble-icon-btn pebble-attachment-btn');
		attachmentBtn.innerHTML = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21.44 11.05l-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48"></path></svg>`;
		attachmentBtn.onclick = () => fileInput.click();

		const clozeBtn = leftControls.createSpan('pebble-icon-btn pebble-cloze-btn');
		clozeBtn.innerHTML = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path><circle cx="12" cy="12" r="3"></circle></svg>`;
		clozeBtn.style.display = 'none';

		clozeBtn.onclick = () => {
			const start = this.textarea.selectionStart;
			const end = this.textarea.selectionEnd;
			if (start !== end) {
				const selectedText = this.textarea.value.substring(start, end);
				const newText = `[${selectedText}](cloze:)`;
				this.textarea.setRangeText(newText, start, end, 'select');
				this.textarea.dispatchEvent(new Event('input', { bubbles: true }));
				clozeBtn.style.display = 'none';
			}
		};

		const checkClozeVisibility = () => {
			if (this.noteReviewCheckbox?.checked && this.textarea.selectionStart !== this.textarea.selectionEnd) {
				clozeBtn.style.display = 'inline-flex';
			} else {
				clozeBtn.style.display = 'none';
			}
		};

		this.textarea.addEventListener('select', checkClozeVisibility);
		this.textarea.addEventListener('keyup', checkClozeVisibility);
		this.textarea.addEventListener('mouseup', checkClozeVisibility);
		this.textarea.addEventListener('input', checkClozeVisibility);

		if (this.plugin.settings.noteReviewIntegration) {
			const noteReviewWrapper = leftControls.createDiv('pebble-note-review-wrapper');
			noteReviewWrapper.style.display = 'flex';
			noteReviewWrapper.style.alignItems = 'center';
			noteReviewWrapper.style.marginLeft = '10px';
			noteReviewWrapper.style.fontSize = 'var(--font-ui-smaller)';
			noteReviewWrapper.style.color = 'var(--text-muted)';
			noteReviewWrapper.style.cursor = 'pointer';

			const label = noteReviewWrapper.createEl('label');
			label.innerHTML = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="width: 14px; height: 14px; display: block;"><path d="M21 7.5V6a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h3.5"/><path d="M16 2v4"/><path d="M8 2v4"/><path d="M3 10h5"/><path d="M17.5 17.5 16 16.25V14"/><circle cx="16" cy="16" r="6"/></svg>`;
			label.title = 'Note review';
			label.style.cursor = 'pointer';

			this.noteReviewCheckbox = noteReviewWrapper.createEl('input', { type: 'checkbox', cls: 'pebble-note-review-checkbox' });
			this.noteReviewCheckbox.style.marginLeft = '4px';
			this.noteReviewCheckbox.style.cursor = 'pointer';
			this.noteReviewCheckbox.checked = this.plugin.settings.lastNoteReviewState;
			
			const cbId = 'pebble-note-review-modal-cb-' + Date.now();
			label.htmlFor = this.noteReviewCheckbox.id = cbId;

			const updateBorder = () => {
				if (this.noteReviewCheckbox?.checked) {
					contentEl.classList.add('is-note-review');
				} else {
					contentEl.classList.remove('is-note-review');
				}
			};

			this.noteReviewCheckbox.addEventListener('change', async () => {
				checkClozeVisibility();
				updateBorder();
				this.plugin.settings.lastNoteReviewState = this.noteReviewCheckbox?.checked || false;
				await this.plugin.saveSettings();
			});

			updateBorder();
			checkClozeVisibility();
		}

		const saveBtn = rightControls.createEl('button', { cls: 'pebble-save-btn' });
		saveBtn.innerHTML = `
			<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line></svg>
		`;

		saveBtn.onclick = () => this.savePebble();

		this.textarea.addEventListener('keydown', (e: KeyboardEvent) => {
			if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
				e.preventDefault();
				this.savePebble();
				return;
			}

			if (handleListContinuation(this.textarea, e)) {
				this.textarea.dispatchEvent(new Event('input', { bubbles: true }));
				return;
			}
		});

		this.textarea.addEventListener('dragover', (e) => {
			e.preventDefault();
		});

		this.textarea.addEventListener('drop', async (e) => {
			if (e.dataTransfer?.files && e.dataTransfer.files.length > 0) {
				const handled = await AttachmentManager.handleAttachments(this.app, this.plugin.settings, e.dataTransfer.files, this.textarea);
				if (handled) e.preventDefault();
			}
		});

		this.textarea.addEventListener('paste', async (e) => {
			if (e.clipboardData?.files && e.clipboardData.files.length > 0) {
				const handled = await AttachmentManager.handleAttachments(this.app, this.plugin.settings, e.clipboardData.files, this.textarea);
				if (handled) e.preventDefault();
			}
		});

		setTimeout(() => {
			this.textarea.focus();
		}, 100);
	}

	async savePebble() {
		const text = this.textarea.value.trim();
		if (!text) {
			new Notice('Pebble is empty!');
			return;
		}

		const isNoteReview = this.noteReviewCheckbox ? this.noteReviewCheckbox.checked : false;

		try {
			await PebbleManager.savePebble(this.app, this.plugin.settings, text, isNoteReview);
			new Notice('Pebble saved');
			this.textarea.style.height = 'auto'; // Reset height
			this.close();
		} catch (e) {
			console.error(e);
			new Notice('Failed to save pebble');
		}
	}

	onClose() {
		const { contentEl } = this;
		contentEl.empty();
	}
}
